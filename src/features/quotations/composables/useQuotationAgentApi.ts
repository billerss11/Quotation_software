import { nextTick } from 'vue'
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
  importLineItemsCsvFile: (filePath: string) => Promise<boolean>
  importLineItemsCsvContent: (content: string, filePath?: string) => Promise<boolean>
  exportPdfToFile: (filePath: string) => Promise<RuntimeSaveFileResult | null>
  setTaxMode: (mode: TaxMode, options?: QuotationAgentSetTaxModeOptions) => 'updated' | 'requires_tax_class'
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
      return createActionResult('importLineItemsCsvFile', await options.importLineItemsCsvFile(filePath))
    },
    async importLineItemsCsvContent(content: string, filePath = 'agent-import.csv') {
      return createActionResult('importLineItemsCsvContent', await options.importLineItemsCsvContent(content, filePath))
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

      options.quotation.value.header.currency = baseCurrency
      await nextTick()

      const warnings = applyAgentExchangeRates(options.quotation.value.exchangeRates, baseCurrency, exchangeRates)
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

      options.quotation.value.outputSettings = {
        ...normalizeQuotationOutputSettings(options.quotation.value.outputSettings),
        itemDetailLevel: level,
      }
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
      options.quotation.value.totalsConfig = {
        ...options.quotation.value.totalsConfig,
        mixedTaxColumns: selectedColumns,
      }
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

function applyAgentExchangeRates(
  target: ExchangeRateTable,
  baseCurrency: string,
  exchangeRates?: ExchangeRateTable,
) {
  const warnings: string[] = []

  if (exchangeRates) {
    for (const [rawCurrency, rawRate] of Object.entries(exchangeRates)) {
      const currency = parseCurrencyCode(rawCurrency)

      if (!currency) {
        warnings.push(`Unsupported currency: ${rawCurrency}`)
        continue
      }

      target[currency] = currency === baseCurrency ? 1 : normalizeRate(rawRate)
    }
  }

  target[baseCurrency] = 1
  return warnings
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
