import type { Ref } from 'vue'

import type {
  QuotationAgentAction,
  QuotationAgentActionResult,
  QuotationAgentApi,
  QuotationAgentSetTaxModeOptions,
  QuotationAgentSnapshot,
  QuotationAgentSummary,
} from '@/shared/contracts/quotationApp'
import type { RuntimeSaveFileResult } from '@/shared/runtime/quotationRuntime'
import { cloneSerializable } from '@/shared/utils/clone'

import type {
  ExchangeRateTable,
  MajorItemSummary,
  MixedTaxDocumentColumn,
  QuotationDraft,
  QuotationOutputItemDetailLevel,
  QuotationRootItem,
  TaxMode,
  QuotationTotals,
} from '../types'
import { parseCurrencyCode } from '../utils/currencyCodes'
import { isMixedTaxDocumentColumn, normalizeMixedTaxDocumentColumns } from '../utils/quotationDocumentColumns'
import { getQuotationRootItems, isQuotationItem } from '../utils/quotationItems'
import {
  isQuotationOutputItemDetailLevel,
  normalizeQuotationOutputSettings,
} from '../utils/quotationOutputSettings'
import { clampNumber, MAX_EXCHANGE_RATE, MIN_EXCHANGE_RATE } from '../utils/pricingLimits'
import type { LineItemsImportResult } from './useQuotationFileActions'

type TranslateFn = (key: string, params?: Record<string, string | number>) => string

interface UseQuotationAgentApiOptions {
  quotation: Ref<QuotationDraft>
  itemSummaries: Ref<MajorItemSummary[]>
  totals: Ref<QuotationTotals>
  currentFilePath: Ref<string>
  statusMessage: Ref<string>
  saveCurrentQuotation: () => void
  importQuotationFile: (filePath: string) => Promise<boolean>
  importQuotationContent: (content: string, filePath?: string) => Promise<boolean>
  importLineItemsCsvFile: (filePath: string) => Promise<LineItemsImportResult>
  importLineItemsCsvContent: (content: string, filePath?: string) => Promise<LineItemsImportResult>
  importLineItemsXlsxFile: (filePath: string) => Promise<LineItemsImportResult>
  importLineItemsXlsxContent: (content: Uint8Array, filePath?: string) => Promise<LineItemsImportResult>
  setLogoDataUrl: (logoDataUrl: string) => void
  exportPdfToFile: (filePath: string) => Promise<RuntimeSaveFileResult | null>
  setTaxMode: (mode: TaxMode, options?: QuotationAgentSetTaxModeOptions) => 'updated' | 'requires_tax_class'
  setQuotationCurrency: (currency: string, exchangeRates?: ExchangeRateTable) => boolean
  setOutputItemDetailLevel: (level: QuotationOutputItemDetailLevel) => boolean
  setMixedTaxDocumentColumns: (columns: MixedTaxDocumentColumn[]) => boolean
  t: TranslateFn
}

export function useQuotationAgentApi(options: UseQuotationAgentApiOptions): QuotationAgentApi {
  function createActionResult(
    action: QuotationAgentAction,
    ok: boolean,
    extras: Partial<Pick<QuotationAgentActionResult, 'error' | 'filePath' | 'warnings'>> = {},
  ): QuotationAgentActionResult {
    return {
      ok,
      action,
      currentFilePath: options.currentFilePath.value,
      statusMessage: options.statusMessage.value,
      summary: createQuotationSummary(options),
      warnings: extras.warnings ?? [],
      ...(extras.filePath ? { filePath: extras.filePath } : {}),
      ...(extras.error ? { error: extras.error } : {}),
    }
  }

  return {
    async importQuotationFile(filePath: string) {
      return createActionResult('importQuotationFile', await options.importQuotationFile(filePath))
    },
    async importQuotationContent(content: string, filePath = 'agent-import.json') {
      return createActionResult('importQuotationContent', await options.importQuotationContent(content, filePath))
    },
    async importLineItemsCsvFile(filePath: string) {
      const result = await options.importLineItemsCsvFile(filePath)

      return createActionResult('importLineItemsCsvFile', result.ok, {
        warnings: result.warnings,
        error: result.ok ? undefined : 'csv_import_failed',
      })
    },
    async importLineItemsCsvContent(content: string, filePath = 'agent-import.csv') {
      const result = await options.importLineItemsCsvContent(content, filePath)

      return createActionResult('importLineItemsCsvContent', result.ok, {
        warnings: result.warnings,
        error: result.ok ? undefined : 'csv_import_failed',
      })
    },
    async importLineItemsXlsxFile(filePath: string) {
      const result = await options.importLineItemsXlsxFile(filePath)

      return createActionResult('importLineItemsXlsxFile', result.ok, {
        warnings: result.warnings,
        error: result.ok ? undefined : 'xlsx_import_failed',
      })
    },
    async importLineItemsXlsxContent(base64: string, filePath = 'agent-import.xlsx') {
      const content = decodeRawBase64(base64)
      if (!content) {
        return createActionResult('importLineItemsXlsxContent', false, {
          error: 'invalid_xlsx_base64',
          warnings: ['XLSX content must be a valid raw base64 string'],
        })
      }

      const result = await options.importLineItemsXlsxContent(content, filePath)

      return createActionResult('importLineItemsXlsxContent', result.ok, {
        warnings: result.warnings,
        error: result.ok ? undefined : 'xlsx_import_failed',
      })
    },
    async uploadLogo(logoDataUrl: string) {
      if (!isImageDataUrl(logoDataUrl)) {
        return createActionResult('uploadLogo', false, {
          error: 'invalid_logo_data_url',
          warnings: ['Logo must be a base64 image data URL'],
        })
      }

      options.setLogoDataUrl(logoDataUrl)
      options.saveCurrentQuotation()
      options.statusMessage.value = options.t('quotations.statuses.logoAdded')

      return createActionResult('uploadLogo', true)
    },
    async exportPdfToFile(filePath: string) {
      const result = await options.exportPdfToFile(filePath)

      if (!result || result.canceled) {
        return createActionResult('exportPdfToFile', false, {
          error: result?.canceled ? 'canceled' : 'export_failed',
        })
      }

      return createActionResult('exportPdfToFile', true, {
        filePath: result.filePath,
      })
    },
    async setBaseCurrency(currency: string, exchangeRates?: ExchangeRateTable) {
      const baseCurrency = parseCurrencyCode(currency)

      if (!baseCurrency) {
        return createActionResult('setBaseCurrency', false, {
          error: 'unsupported_currency',
          warnings: [`Unsupported currency: ${currency}`],
        })
      }

      const { rates, warnings } = normalizeAgentExchangeRates(baseCurrency, exchangeRates)
      options.setQuotationCurrency(baseCurrency, rates)
      options.saveCurrentQuotation()
      options.statusMessage.value = options.t('quotations.statuses.agentCurrencyUpdated', { currency: baseCurrency })

      return createActionResult('setBaseCurrency', true, { warnings })
    },
    async setTaxMode(mode: TaxMode, taxModeOptions?: QuotationAgentSetTaxModeOptions) {
      if (!isTaxMode(mode)) {
        return createActionResult('setTaxMode', false, {
          error: 'invalid_tax_mode',
          warnings: [`Unsupported tax mode: ${String(mode)}`],
        })
      }

      const result = options.setTaxMode(mode, taxModeOptions)

      if (result === 'requires_tax_class') {
        return createActionResult('setTaxMode', false, {
          error: 'tax_class_required',
          warnings: ['Single tax mode requires a valid taxClassId when line items use multiple tax classes'],
        })
      }

      options.saveCurrentQuotation()
      options.statusMessage.value = options.t('quotations.statuses.agentTaxModeUpdated', { mode })

      return createActionResult('setTaxMode', true)
    },
    async setOutputItemDetailLevel(level: QuotationOutputItemDetailLevel) {
      if (!isQuotationOutputItemDetailLevel(level)) {
        return createActionResult('setOutputItemDetailLevel', false, {
          error: 'invalid_output_item_detail_level',
          warnings: [`Unsupported item detail level: ${String(level)}`],
        })
      }

      options.setOutputItemDetailLevel(level)
      options.saveCurrentQuotation()
      options.statusMessage.value = options.t('quotations.statuses.agentOutputDetailUpdated', { level })

      return createActionResult('setOutputItemDetailLevel', true)
    },
    async setMixedTaxDocumentColumns(columns: readonly string[]) {
      if (!Array.isArray(columns)) {
        return createActionResult('setMixedTaxDocumentColumns', false, {
          error: 'invalid_mixed_tax_document_columns',
          warnings: ['Mixed-tax document columns must be an array'],
        })
      }

      const warnings = getUnsupportedMixedTaxDocumentColumnWarnings(columns)

      if (warnings.length > 0) {
        return createActionResult('setMixedTaxDocumentColumns', false, {
          error: 'invalid_mixed_tax_document_columns',
          warnings,
        })
      }

      const selectedColumns = normalizeMixedTaxDocumentColumns(columns)
      options.setMixedTaxDocumentColumns(selectedColumns)
      options.saveCurrentQuotation()
      options.statusMessage.value = options.t('quotations.statuses.agentDocumentColumnsUpdated', {
        count: selectedColumns.length,
      })

      return createActionResult('setMixedTaxDocumentColumns', true)
    },
    getQuotationSummary() {
      return createQuotationSummary(options)
    },
    getTotals() {
      return cloneSerializable(options.totals.value)
    },
    getLineItems() {
      return cloneSerializable(options.quotation.value.majorItems)
    },
    getOutputSettings() {
      return cloneSerializable(normalizeQuotationOutputSettings(options.quotation.value.outputSettings))
    },
    getQuotationSnapshot() {
      return {
        currentFilePath: options.currentFilePath.value,
        statusMessage: options.statusMessage.value,
        summary: createQuotationSummary(options),
        quotation: cloneSerializable(options.quotation.value),
        itemSummaries: cloneSerializable(options.itemSummaries.value),
        totals: cloneSerializable(options.totals.value),
      } satisfies QuotationAgentSnapshot
    },
  }
}

function isImageDataUrl(value: string) {
  const match = /^data:image\/[a-z0-9.+-]+;base64,([a-z0-9+/]+={0,2})$/i.exec(value)

  return Boolean(match && match[1].length % 4 === 0)
}

function decodeRawBase64(value: string) {
  if (
    value.length === 0
    || value.length % 4 === 1
    || !/^[a-z0-9+/]*={0,2}$/i.test(value)
    || (value.includes('=') && value.length % 4 !== 0)
  ) {
    return null
  }

  const firstPadding = value.indexOf('=')
  if (firstPadding >= 0 && firstPadding < value.length - 2) {
    return null
  }

  try {
    const paddedValue = value.padEnd(value.length + ((4 - value.length % 4) % 4), '=')
    const decoded = atob(paddedValue)
    return Uint8Array.from(decoded, character => character.charCodeAt(0))
  } catch {
    return null
  }
}

function createQuotationSummary(options: Pick<
  UseQuotationAgentApiOptions,
  'quotation' | 'totals'
>): QuotationAgentSummary {
  const quotation = options.quotation.value
  const totals = options.totals.value

  return {
    quotationId: quotation.id,
    quotationNumber: quotation.header.quotationNumber,
    projectName: quotation.header.projectName,
    customerCompany: quotation.header.customerCompany,
    currency: quotation.header.currency,
    topLevelItemCount: getQuotationRootItems(quotation.majorItems).length,
    itemCount: countQuotationItems(quotation.majorItems),
    outputItemDetailLevel: normalizeQuotationOutputSettings(quotation.outputSettings).itemDetailLevel,
    subtotalAfterMarkup: totals.subtotalAfterMarkup,
    taxAmount: totals.taxAmount,
    grandTotal: totals.grandTotal,
    exchangeRates: cloneSerializable(quotation.exchangeRates),
  }
}

function countQuotationItems(items: QuotationRootItem[]): number {
  return items.reduce((count, item) => {
    if (!isQuotationItem(item)) {
      return count
    }

    return count + 1 + countQuotationItems(item.children)
  }, 0)
}

function normalizeAgentExchangeRates(
  baseCurrency: string,
  exchangeRates?: ExchangeRateTable,
) {
  const warnings: string[] = []
  const rates: ExchangeRateTable = {}

  if (exchangeRates) {
    for (const [rawCurrency, rawRate] of Object.entries(exchangeRates)) {
      const currency = parseCurrencyCode(rawCurrency)

      if (!currency) {
        warnings.push(`Unsupported currency: ${rawCurrency}`)
        continue
      }

      rates[currency] = currency === baseCurrency ? 1 : normalizeRate(rawRate)
    }
  }

  rates[baseCurrency] = 1
  return { rates, warnings }
}

function normalizeRate(rate: number) {
  return Number.isFinite(rate) && rate > 0 ? clampNumber(rate, MIN_EXCHANGE_RATE, MAX_EXCHANGE_RATE) : 1
}

function isTaxMode(value: unknown): value is TaxMode {
  return value === 'single' || value === 'mixed'
}

function getUnsupportedMixedTaxDocumentColumnWarnings(columns: readonly string[]) {
  return columns.flatMap((column) =>
    isMixedTaxDocumentColumn(column)
      ? []
      : [`Unsupported mixed-tax document column: ${String(column)}`],
  )
}
