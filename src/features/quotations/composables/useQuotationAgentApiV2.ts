import type { Ref } from 'vue'

import type {
  AutomationIssue,
  AutomationResult,
  AddLineItemInput,
  AddSectionHeaderInput,
  ApplyOperationsRequest,
  CreateQuotationInput,
  ExtraChargePatch,
  ItemGoalSeekInput,
  MoveItemTarget,
  NewExtraCharge,
  NewTaxClass,
  QuotationGoalSeekInput,
  QuotationAgentApiV2,
  QuotationAutomationApiInfo,
  QuotationAutomationHost,
  QuotationAutomationSnapshot,
  QuotationBrandingPatch,
  QuotationItemPatch,
  QuotationOperation,
  QuotationOutputSettingsPatch,
  TaxClassPatch,
  QuotationValidationReport,
  SerializedQuotation,
} from '@/shared/contracts/quotationAutomation'
import { QUOTATION_AUTOMATION_API_VERSION } from '@/shared/contracts/quotationAutomation'
import { SUPPORTED_LOCALES } from '@/shared/i18n/locale'
import type { SupportedLocale } from '@/shared/i18n/locale'
import type { QuotationRuntime } from '@/shared/runtime/quotationRuntime'
import { cloneSerializable } from '@/shared/utils/clone'

import { fetchLatestExchangeRates } from '../services/onlineExchangeRates'
import { QUOTATION_TEMPLATE_IDS } from '../templates/templateIds'
import type {
  LineItemEntryMode,
  ExchangeRateTable,
  MajorItemSummary,
  MixedTaxDocumentColumn,
  QuotationDraft,
  QuotationExtraCharge,
  QuotationHeader,
  QuotationItem,
  QuotationOutputSettings,
  QuotationRootItem,
  QuotationTemplateId,
  QuotationTotals,
  PricingMethod,
  TaxClass,
  TaxMode,
} from '../types'
import { parseCurrencyCode } from '../utils/currencyCodes'
import {
  calculateQuotationItemUnitSellingPrice,
  getEffectiveMarkupRate,
} from '../utils/quotationCalculations'
import { addCurrencyToRateTable } from '../utils/exchangeRates'
import { normalizeQuotationDraft } from '../utils/quotationDraft'
import {
  createQuotationItem,
  createQuotationSectionHeader,
  duplicateQuotationItem,
  getQuotationRootItems,
  isQuotationItem,
} from '../utils/quotationItems'
import {
  solveItemGoalSeekMarkup,
  solveQuotationGoalSeekGlobalMarkup,
} from '../utils/quotationGoalSeek'
import { MAX_EXCHANGE_RATE, MAX_MARKUP_RATE, MAX_TAX_RATE, MIN_EXCHANGE_RATE } from '../utils/pricingLimits'
import { canUseSingleTaxMode, createTaxClass } from '../utils/quotationTaxes'
import { MIXED_TAX_DOCUMENT_COLUMNS } from '../utils/quotationDocumentColumns'
import {
  createQuotationFileContent,
  parseQuotationFileContent,
  QUOTATION_FILE_SCHEMA_VERSION,
  QuotationFileError,
  type QuotationFileErrorCode,
} from '../utils/quotationFile'

interface UseQuotationAgentApiV2Options {
  quotation: Ref<QuotationDraft>
  itemSummaries: Ref<MajorItemSummary[]>
  totals: Ref<QuotationTotals>
  currentFilePath: Ref<string>
  runtime: Pick<QuotationRuntime, 'capabilities' | 'getAppVersion'>
  host?: QuotationAutomationHost
  createNewQuotation?: (input?: CreateQuotationInput) => unknown
  updateHeaderFields?: (patch: Partial<QuotationHeader>) => unknown
  setTemplateId?: (templateId: QuotationTemplateId) => unknown
  setBranding?: (patch: QuotationBrandingPatch) => unknown
  setLineItemEntryMode?: (mode: LineItemEntryMode) => unknown
  setOutputSettings?: (patch: QuotationOutputSettingsPatch) => unknown
  commitMutationHistory?: () => void
  insertLineItem?: (
    parentItemId: string | null,
    index: number,
    patch: QuotationItemPatch,
  ) => string | null
  insertSectionHeader?: (index: number, title: string) => string | null
  updateItemFields?: (itemId: string, patch: QuotationItemPatch) => unknown
  setItemPricingMethod?: (itemId: string, method: QuotationItem['pricingMethod']) => unknown
  updateSectionHeaderTitle?: (itemId: string, title: string) => unknown
  removeItem?: (itemId: string) => unknown
  duplicateItem?: (itemId: string) => string | null
  moveQuotationTreeRow?: (
    itemId: string,
    targetParentId: string | null,
    targetIndex: number,
    dropMode: 'before' | 'inside' | 'after',
  ) => unknown
  setGlobalMarkupRate?: (rate: number) => unknown
  updateExchangeRate?: (currency: string, rate: number) => unknown
  addExchangeRate?: (currency: string) => 'added' | 'exists' | 'invalid' | 'unavailable'
  removeExchangeRate?: (currency: string) => 'removed' | 'in_use' | 'base_currency'
  setQuotationCurrency?: (currency: string, rates?: ExchangeRateTable) => unknown
  updateExchangeRates?: (rates: ExchangeRateTable) => unknown
  setTaxMode?: (mode: TaxMode, options?: { taxClassId?: string }) => 'updated' | 'requires_tax_class'
  setMixedTaxDocumentColumns?: (columns: MixedTaxDocumentColumn[]) => unknown
  addTaxClass?: (taxClass: TaxClass) => unknown
  updateTaxClassField?: (id: string, field: 'label' | 'rate', value: string | number) => unknown
  removeTaxClass?: (id: string) => unknown
  setDefaultTaxClass?: (id: string) => unknown
  addExtraCharge?: (charge: QuotationExtraCharge) => unknown
  updateExtraChargeField?: (id: string, field: 'label' | 'amount', value: string | number) => unknown
  removeExtraCharge?: (id: string) => unknown
  applyItemGoalSeek?: (updates: Array<{ itemId: string; markupRate: number }>) => unknown
  applyQuotationGoalSeek?: (markupRate: number) => unknown
  replaceQuotationDraft?: (quotation: QuotationDraft) => unknown
}

const SUPPORTED_TAX_MODES = ['single', 'mixed'] as const

export function useQuotationAgentApiV2(options: UseQuotationAgentApiV2Options): QuotationAgentApiV2 {
  let revision = 0
  let quotationFingerprint = createQuotationFingerprint(options.quotation.value)
  let mutationQueue = Promise.resolve()

  function currentRevision() {
    const nextFingerprint = createQuotationFingerprint(options.quotation.value)
    if (nextFingerprint !== quotationFingerprint) {
      revision += 1
      quotationFingerprint = nextFingerprint
    }

    return revision
  }

  async function getApiInfo(): Promise<QuotationAutomationApiInfo> {
    return {
      apiVersion: QUOTATION_AUTOMATION_API_VERSION,
      appVersion: await getAppVersion(options.runtime),
      quotationSchemaVersion: QUOTATION_FILE_SCHEMA_VERSION,
      capabilities: createCapabilities(options),
      supportedTemplates: [...QUOTATION_TEMPLATE_IDS],
      supportedLocales: [...SUPPORTED_LOCALES],
      supportedTaxModes: [...SUPPORTED_TAX_MODES],
      supportedMixedTaxColumns: [...MIXED_TAX_DOCUMENT_COLUMNS],
    }
  }

  function enqueueMutation<T>(mutation: () => Promise<AutomationResult<T>> | AutomationResult<T>) {
    const runMutation = async () => {
      try {
        return await mutation()
      } catch (error) {
        return createFailureResult<T>(
          'internal_error',
          'The automation mutation could not be completed.',
          currentRevision(),
          error,
        )
      }
    }
    const result = mutationQueue.then(runMutation, runMutation)
    mutationQueue = result.then(() => undefined, () => undefined)
    return result
  }

  function createSnapshot(snapshotRevision: number): QuotationAutomationSnapshot {
    return {
      schemaVersion: QUOTATION_FILE_SCHEMA_VERSION,
      revision: snapshotRevision,
      currentFilePath: options.currentFilePath.value,
      quotation: cloneSerializable(options.quotation.value),
      itemSummaries: cloneSerializable(options.itemSummaries.value),
      totals: cloneSerializable(options.totals.value),
    }
  }

  return {
    getApiInfo,
    waitUntilReady: getApiInfo,
    createQuotation(input = {}) {
      return enqueueMutation(async () => {
        const observedRevision = currentRevision()
        const validation = validateCreateQuotationInput(input)
        if (!validation.ok) {
          return createFailureResult(validation.code, validation.message, observedRevision, undefined, validation.fieldPath)
        }
        if (!options.createNewQuotation) {
          return createFailureResult('unsupported_operation', 'Creating quotations is not available in this host.', observedRevision)
        }

        await options.createNewQuotation(validation.value)
        options.commitMutationHistory?.()
        const nextRevision = currentRevision()
        return createSuccessResult(createSnapshot(nextRevision), nextRevision)
      })
    },
    updateHeader(patch) {
      return enqueueMutation(async () => {
        const observedRevision = currentRevision()
        const validation = validateHeaderPatch(patch)
        if (!validation.ok) {
          return createFailureResult(validation.code, validation.message, observedRevision, undefined, validation.fieldPath)
        }
        if (!options.updateHeaderFields) {
          return createFailureResult('unsupported_operation', 'Updating the quotation header is not available in this host.', observedRevision)
        }

        await options.updateHeaderFields(validation.value)
        options.commitMutationHistory?.()
        const nextRevision = currentRevision()
        return createSuccessResult(cloneSerializable(options.quotation.value.header), nextRevision)
      })
    },
    setTemplate(templateId) {
      return enqueueMutation(async () => {
        const observedRevision = currentRevision()
        if (!QUOTATION_TEMPLATE_IDS.includes(templateId)) {
          return createFailureResult('invalid_argument', 'The quotation template is not supported.', observedRevision, undefined, 'templateId')
        }
        if (!options.setTemplateId) {
          return createFailureResult('unsupported_operation', 'Changing the quotation template is not available in this host.', observedRevision)
        }

        await options.setTemplateId(templateId)
        options.commitMutationHistory?.()
        const nextRevision = currentRevision()
        return createSuccessResult({ templateId: options.quotation.value.templateId }, nextRevision)
      })
    },
    setDocumentLocale(locale) {
      return enqueueMutation(async () => {
        const observedRevision = currentRevision()
        if (!SUPPORTED_LOCALES.includes(locale)) {
          return createFailureResult('invalid_argument', 'The document locale is not supported.', observedRevision, undefined, 'locale')
        }
        if (!options.updateHeaderFields) {
          return createFailureResult('unsupported_operation', 'Changing the document locale is not available in this host.', observedRevision)
        }

        await options.updateHeaderFields({ documentLocale: locale })
        options.commitMutationHistory?.()
        const nextRevision = currentRevision()
        return createSuccessResult({ documentLocale: options.quotation.value.header.documentLocale }, nextRevision)
      })
    },
    setBranding(patch) {
      return enqueueMutation(async () => {
        const observedRevision = currentRevision()
        const validation = validateBrandingPatch(patch)
        if (!validation.ok) {
          return createFailureResult(validation.code, validation.message, observedRevision, undefined, validation.fieldPath)
        }
        if (!options.setBranding) {
          return createFailureResult('unsupported_operation', 'Changing quotation branding is not available in this host.', observedRevision)
        }

        await options.setBranding(validation.value)
        options.commitMutationHistory?.()
        const nextRevision = currentRevision()
        return createSuccessResult(cloneSerializable(options.quotation.value.branding), nextRevision)
      })
    },
    setLineItemEntryMode(mode) {
      return enqueueMutation(async () => {
        const observedRevision = currentRevision()
        if (!isLineItemEntryMode(mode)) {
          return createFailureResult('invalid_argument', 'The line-item entry mode is invalid.', observedRevision, undefined, 'mode')
        }
        if (!options.setLineItemEntryMode) {
          return createFailureResult('unsupported_operation', 'Changing line-item entry mode is not available in this host.', observedRevision)
        }

        await options.setLineItemEntryMode(mode)
        options.commitMutationHistory?.()
        const nextRevision = currentRevision()
        return createSuccessResult({ mode: options.quotation.value.lineItemEntryMode ?? 'detailed' }, nextRevision)
      })
    },
    setOutputSettings(patch) {
      return enqueueMutation(async () => {
        const observedRevision = currentRevision()
        const validation = validateOutputSettingsPatch(patch)
        if (!validation.ok) {
          return createFailureResult(validation.code, validation.message, observedRevision, undefined, validation.fieldPath)
        }
        if (!options.setOutputSettings) {
          return createFailureResult('unsupported_operation', 'Changing output settings is not available in this host.', observedRevision)
        }

        await options.setOutputSettings(validation.value)
        options.commitMutationHistory?.()
        const nextRevision = currentRevision()
        return createSuccessResult(
          cloneSerializable(options.quotation.value.outputSettings ?? { itemDetailLevel: 3 }),
          nextRevision,
        )
      })
    },
    addLineItem(input = {}) {
      return enqueueMutation(async () => {
        const observedRevision = currentRevision()
        const validation = validateAddLineItemInput(input, options.quotation.value)
        if (!validation.ok) {
          return createFailureResult(validation.code, validation.message, observedRevision, undefined, validation.fieldPath)
        }
        if (!options.insertLineItem) {
          return createFailureResult('unsupported_operation', 'Adding line items is not available in this host.', observedRevision)
        }

        const itemId = await options.insertLineItem(
          validation.value.parentId,
          validation.value.index,
          validation.value.item,
        )
        if (!itemId) {
          return createFailureResult('mutation_failed', 'The line item could not be added.', currentRevision())
        }
        options.commitMutationHistory?.()
        const nextRevision = currentRevision()
        return createSuccessResult({ itemId }, nextRevision)
      })
    },
    addSectionHeader(input) {
      return enqueueMutation(async () => {
        const observedRevision = currentRevision()
        const validation = validateAddSectionHeaderInput(input, options.quotation.value)
        if (!validation.ok) {
          return createFailureResult(validation.code, validation.message, observedRevision, undefined, validation.fieldPath)
        }
        if (!options.insertSectionHeader) {
          return createFailureResult('unsupported_operation', 'Adding section headers is not available in this host.', observedRevision)
        }

        const itemId = await options.insertSectionHeader(validation.value.index, validation.value.title)
        if (!itemId) {
          return createFailureResult('mutation_failed', 'The section header could not be added.', currentRevision())
        }
        options.commitMutationHistory?.()
        const nextRevision = currentRevision()
        return createSuccessResult({ itemId }, nextRevision)
      })
    },
    async getItem(itemId) {
      await mutationQueue
      const observedRevision = currentRevision()
      if (!isNonEmptyString(itemId)) {
        return createFailureResult('invalid_argument', 'Item ID must be a non-empty string.', observedRevision, undefined, 'itemId')
      }
      const item = findQuotationRow(options.quotation.value.majorItems, itemId)
      if (!item) {
        return createFailureResult('item_not_found', 'The quotation item was not found.', observedRevision, undefined, 'itemId')
      }
      return createSuccessResult(cloneSerializable(item), observedRevision)
    },
    async getItemTree() {
      await mutationQueue
      const observedRevision = currentRevision()
      return createSuccessResult(cloneSerializable(options.quotation.value.majorItems), observedRevision)
    },
    updateLineItem(itemId, patch) {
      return enqueueMutation(async () => {
        const observedRevision = currentRevision()
        const item = findQuotationRow(options.quotation.value.majorItems, itemId)
        if (!isQuotationItem(item)) {
          return createFailureResult(
            item ? 'invalid_item_type' : 'item_not_found',
            item ? 'The requested row is not a line item.' : 'The quotation item was not found.',
            observedRevision,
            undefined,
            'itemId',
          )
        }
        const validation = validateQuotationItemPatch(patch, options.quotation.value, item)
        if (!validation.ok) {
          return createFailureResult(validation.code, validation.message, observedRevision, undefined, validation.fieldPath)
        }
        if (!options.updateItemFields) {
          return createFailureResult('unsupported_operation', 'Updating line items is not available in this host.', observedRevision)
        }

        const { pricingMethod, ...fieldPatch } = validation.value
        if (pricingMethod !== undefined && options.setItemPricingMethod) {
          await options.setItemPricingMethod(itemId, pricingMethod)
          await options.updateItemFields(itemId, fieldPatch)
        } else {
          await options.updateItemFields(itemId, validation.value)
        }
        options.commitMutationHistory?.()
        const nextRevision = currentRevision()
        const updatedItem = findQuotationRow(options.quotation.value.majorItems, itemId)
        if (!isQuotationItem(updatedItem)) {
          return createFailureResult('mutation_failed', 'The line item could not be updated.', nextRevision)
        }
        return createSuccessResult(cloneSerializable(updatedItem), nextRevision)
      })
    },
    updateSectionHeader(itemId, patch) {
      return enqueueMutation(async () => {
        const observedRevision = currentRevision()
        const section = findQuotationRow(options.quotation.value.majorItems, itemId)
        if (!section) {
          return createFailureResult('item_not_found', 'The section header was not found.', observedRevision, undefined, 'itemId')
        }
        if (isQuotationItem(section)) {
          return createFailureResult('invalid_item_type', 'The requested row is not a section header.', observedRevision, undefined, 'itemId')
        }
        const validation = validateSectionHeaderPatch(patch)
        if (!validation.ok) {
          return createFailureResult(validation.code, validation.message, observedRevision, undefined, validation.fieldPath)
        }
        if (!options.updateSectionHeaderTitle) {
          return createFailureResult('unsupported_operation', 'Updating section headers is not available in this host.', observedRevision)
        }

        await options.updateSectionHeaderTitle(itemId, validation.value.title)
        options.commitMutationHistory?.()
        const nextRevision = currentRevision()
        const updatedSection = findQuotationRow(options.quotation.value.majorItems, itemId)
        if (!updatedSection || isQuotationItem(updatedSection)) {
          return createFailureResult('mutation_failed', 'The section header could not be updated.', nextRevision)
        }
        return createSuccessResult(cloneSerializable(updatedSection), nextRevision)
      })
    },
    removeItem(itemId) {
      return enqueueMutation(async () => {
        const observedRevision = currentRevision()
        if (!findQuotationRow(options.quotation.value.majorItems, itemId)) {
          return createFailureResult('item_not_found', 'The quotation item was not found.', observedRevision, undefined, 'itemId')
        }
        if (!options.removeItem) {
          return createFailureResult('unsupported_operation', 'Removing quotation items is not available in this host.', observedRevision)
        }

        await options.removeItem(itemId)
        options.commitMutationHistory?.()
        const nextRevision = currentRevision()
        return createSuccessResult({ itemId }, nextRevision)
      })
    },
    duplicateItem(itemId) {
      return enqueueMutation(async () => {
        const observedRevision = currentRevision()
        const item = findQuotationRow(options.quotation.value.majorItems, itemId)
        if (!item) {
          return createFailureResult('item_not_found', 'The quotation item was not found.', observedRevision, undefined, 'itemId')
        }
        if (!isQuotationItem(item)) {
          return createFailureResult('invalid_item_type', 'Only line items can be duplicated.', observedRevision, undefined, 'itemId')
        }
        if (!options.duplicateItem) {
          return createFailureResult('unsupported_operation', 'Duplicating line items is not available in this host.', observedRevision)
        }

        const duplicatedItemId = await options.duplicateItem(itemId)
        if (!duplicatedItemId) {
          return createFailureResult('mutation_failed', 'The line item could not be duplicated.', currentRevision())
        }
        options.commitMutationHistory?.()
        const nextRevision = currentRevision()
        return createSuccessResult({ itemId: duplicatedItemId }, nextRevision)
      })
    },
    moveItem(itemId, target) {
      return enqueueMutation(async () => {
        const observedRevision = currentRevision()
        const validation = validateMoveItem(itemId, target, options.quotation.value)
        if (!validation.ok) {
          return createFailureResult(validation.code, validation.message, observedRevision, undefined, validation.fieldPath)
        }
        if (!options.moveQuotationTreeRow) {
          return createFailureResult('unsupported_operation', 'Moving quotation items is not available in this host.', observedRevision)
        }

        await options.moveQuotationTreeRow(itemId, validation.value.parentId, validation.value.index, 'inside')
        options.commitMutationHistory?.()
        const nextRevision = currentRevision()
        return createSuccessResult({ itemId, ...validation.value }, nextRevision)
      })
    },
    setGlobalMarkupRate(rate) {
      return enqueueMutation(async () => {
        const observedRevision = currentRevision()
        if (!isFiniteNumber(rate) || rate < 0 || rate > MAX_MARKUP_RATE) {
          return createFailureResult('invalid_argument', `Global markup rate must be between 0 and ${MAX_MARKUP_RATE}.`, observedRevision, undefined, 'rate')
        }
        if (!options.setGlobalMarkupRate) {
          return createFailureResult('unsupported_operation', 'Changing global markup is not available in this host.', observedRevision)
        }
        await options.setGlobalMarkupRate(rate)
        options.commitMutationHistory?.()
        const nextRevision = currentRevision()
        return createSuccessResult({ rate: options.quotation.value.totalsConfig.globalMarkupRate }, nextRevision)
      })
    },
    setItemPricingMethod(itemId, method) {
      return enqueueMutation(async () => {
        const observedRevision = currentRevision()
        const item = findQuotationRow(options.quotation.value.majorItems, itemId)
        if (!isQuotationItem(item)) {
          return createFailureResult(item ? 'invalid_item_type' : 'item_not_found', 'A leaf line item is required.', observedRevision, undefined, 'itemId')
        }
        if (item.children.length > 0) {
          return createFailureResult('invalid_item_type', 'Pricing method can only be changed on leaf line items.', observedRevision, undefined, 'itemId')
        }
        if (!isPricingMethod(method)) {
          return createFailureResult('invalid_argument', 'Pricing method must be cost_plus or manual_price.', observedRevision, undefined, 'method')
        }
        if (!options.setItemPricingMethod) {
          return createFailureResult('unsupported_operation', 'Changing item pricing method is not available in this host.', observedRevision)
        }
        await options.setItemPricingMethod(itemId, method)
        options.commitMutationHistory?.()
        const nextRevision = currentRevision()
        return createSuccessResult({ itemId, method: item.pricingMethod ?? 'cost_plus' }, nextRevision)
      })
    },
    updateExchangeRate(currency, rate) {
      return enqueueMutation(async () => {
        const observedRevision = currentRevision()
        const validation = validateExchangeRate(currency, rate)
        if (!validation.ok) {
          return createFailureResult(validation.code, validation.message, observedRevision, undefined, validation.fieldPath)
        }
        if (
          validation.value.currency === options.quotation.value.header.currency
          && validation.value.rate !== 1
        ) {
          return createFailureResult(
            'base_currency_locked',
            'The quotation currency exchange rate must remain 1.',
            observedRevision,
            undefined,
            'rate',
          )
        }
        if (!options.updateExchangeRate) {
          return createFailureResult('unsupported_operation', 'Updating exchange rates is not available in this host.', observedRevision)
        }
        await options.updateExchangeRate(validation.value.currency, validation.value.rate)
        options.commitMutationHistory?.()
        const nextRevision = currentRevision()
        return createSuccessResult(validation.value, nextRevision)
      })
    },
    addExchangeRate(currency, rate) {
      return enqueueMutation(async () => {
        const observedRevision = currentRevision()
        const normalizedCurrency = parseCurrencyCode(currency)
        if (!normalizedCurrency) {
          return createFailureResult('invalid_argument', 'Exchange-rate currency is invalid.', observedRevision, undefined, 'currency')
        }
        if (rate !== undefined) {
          const validation = validateExchangeRate(normalizedCurrency, rate)
          if (!validation.ok) {
            return createFailureResult(validation.code, validation.message, observedRevision, undefined, validation.fieldPath)
          }
          if (normalizedCurrency === options.quotation.value.header.currency && validation.value.rate !== 1) {
            return createFailureResult('base_currency_locked', 'The quotation currency exchange rate must remain 1.', observedRevision, undefined, 'rate')
          }
          if (!options.updateExchangeRate) {
            return createFailureResult('unsupported_operation', 'Adding exchange rates is not available in this host.', observedRevision)
          }
          await options.updateExchangeRate(normalizedCurrency, validation.value.rate)
        } else {
          if (!options.addExchangeRate) {
            return createFailureResult('unsupported_operation', 'Adding exchange rates is not available in this host.', observedRevision)
          }
          const result = await options.addExchangeRate(normalizedCurrency)
          if (result === 'invalid' || result === 'unavailable') {
            return createFailureResult('exchange_rate_unavailable', 'No default exchange rate is available for this currency.', observedRevision, undefined, 'currency')
          }
        }
        options.commitMutationHistory?.()
        const nextRevision = currentRevision()
        return createSuccessResult({
          currency: normalizedCurrency,
          rate: options.quotation.value.exchangeRates[normalizedCurrency]!,
        }, nextRevision)
      })
    },
    removeExchangeRate(currency) {
      return enqueueMutation(async () => {
        const observedRevision = currentRevision()
        const normalizedCurrency = parseCurrencyCode(currency)
        if (!normalizedCurrency) {
          return createFailureResult('invalid_argument', 'Exchange-rate currency is invalid.', observedRevision, undefined, 'currency')
        }
        if (!options.removeExchangeRate) {
          return createFailureResult('unsupported_operation', 'Removing exchange rates is not available in this host.', observedRevision)
        }
        const result = await options.removeExchangeRate(normalizedCurrency)
        if (result === 'base_currency') {
          return createFailureResult('base_currency_locked', 'The quotation currency rate cannot be removed.', observedRevision, undefined, 'currency')
        }
        if (result === 'in_use') {
          return createFailureResult('currency_in_use', 'The exchange rate is used by a line item.', observedRevision, undefined, 'currency')
        }
        options.commitMutationHistory?.()
        const nextRevision = currentRevision()
        return createSuccessResult({ currency: normalizedCurrency }, nextRevision)
      })
    },
    setQuotationCurrency(currency, rates) {
      return enqueueMutation(async () => {
        const observedRevision = currentRevision()
        const normalizedCurrency = parseCurrencyCode(currency)
        if (!normalizedCurrency) {
          return createFailureResult('invalid_argument', 'Quotation currency is invalid.', observedRevision, undefined, 'currency')
        }
        const ratesValidation = validateExchangeRateTable(rates)
        if (!ratesValidation.ok) {
          return createFailureResult(ratesValidation.code, ratesValidation.message, observedRevision, undefined, ratesValidation.fieldPath)
        }
        if (!options.setQuotationCurrency) {
          return createFailureResult('unsupported_operation', 'Changing quotation currency is not available in this host.', observedRevision)
        }
        const changed = await options.setQuotationCurrency(normalizedCurrency, ratesValidation.value)
        if (changed === false && normalizedCurrency !== options.quotation.value.header.currency) {
          return createFailureResult('exchange_rate_required', 'A conversion rate to the new quotation currency is required.', observedRevision, undefined, 'rates')
        }
        options.commitMutationHistory?.()
        const nextRevision = currentRevision()
        return createSuccessResult({
          currency: options.quotation.value.header.currency,
          ratesToQuotationCurrency: cloneSerializable(options.quotation.value.exchangeRates),
        }, nextRevision)
      })
    },
    refreshExchangeRates() {
      return enqueueMutation(async () => {
        const observedRevision = currentRevision()
        if (!options.updateExchangeRates) {
          return createFailureResult('unsupported_operation', 'Refreshing exchange rates is not available in this host.', observedRevision)
        }
        const baseCurrency = options.quotation.value.header.currency
        const currencies = Object.keys(options.quotation.value.exchangeRates)
        if (currencies.every((currency) => currency === baseCurrency)) {
          return createSuccessResult({
            rates: cloneSerializable(options.quotation.value.exchangeRates),
            date: '',
            missingCurrencies: [],
          }, observedRevision)
        }
        try {
          const result = await fetchLatestExchangeRates(baseCurrency, currencies)
          await options.updateExchangeRates(result.rates)
          options.commitMutationHistory?.()
          const nextRevision = currentRevision()
          return createSuccessResult({
            rates: cloneSerializable(options.quotation.value.exchangeRates),
            date: result.date,
            missingCurrencies: [...result.missingCurrencies],
          }, nextRevision)
        } catch (error) {
          return createFailureResult('exchange_rate_fetch_failed', 'Unable to refresh exchange rates.', observedRevision, error)
        }
      })
    },
    setTaxMode(mode, taxClassId) {
      return enqueueMutation(async () => {
        const observedRevision = currentRevision()
        if (mode !== 'single' && mode !== 'mixed') {
          return createFailureResult('invalid_argument', 'Tax mode must be single or mixed.', observedRevision, undefined, 'mode')
        }
        if (taxClassId !== undefined && !hasTaxClass(options.quotation.value, taxClassId)) {
          return createFailureResult('tax_class_not_found', 'The tax class was not found.', observedRevision, undefined, 'taxClassId')
        }
        if (!options.setTaxMode) {
          return createFailureResult('unsupported_operation', 'Changing tax mode is not available in this host.', observedRevision)
        }
        const result = await options.setTaxMode(mode, taxClassId ? { taxClassId } : undefined)
        if (result === 'requires_tax_class') {
          return createFailureResult('tax_class_required', 'A tax class is required to use single-tax mode.', observedRevision, undefined, 'taxClassId')
        }
        options.commitMutationHistory?.()
        const nextRevision = currentRevision()
        return createSuccessResult({ mode: options.quotation.value.totalsConfig.taxMode ?? 'single' }, nextRevision)
      })
    },
    setMixedTaxDocumentColumns(columns) {
      return enqueueMutation(async () => {
        const observedRevision = currentRevision()
        if (!Array.isArray(columns) || columns.some((column) => !MIXED_TAX_DOCUMENT_COLUMNS.includes(column))) {
          return createFailureResult('invalid_argument', 'Mixed-tax document columns contain an unsupported value.', observedRevision, undefined, 'columns')
        }
        if (!options.setMixedTaxDocumentColumns) {
          return createFailureResult('unsupported_operation', 'Changing mixed-tax columns is not available in this host.', observedRevision)
        }
        const normalizedColumns = [...new Set(columns)]
        await options.setMixedTaxDocumentColumns(normalizedColumns)
        options.commitMutationHistory?.()
        const nextRevision = currentRevision()
        return createSuccessResult({ columns: [...(options.quotation.value.totalsConfig.mixedTaxColumns ?? [])] }, nextRevision)
      })
    },
    addTaxClass(input) {
      return enqueueMutation(async () => {
        const observedRevision = currentRevision()
        const validation = validateNewTaxClass(input)
        if (!validation.ok) {
          return createFailureResult(validation.code, validation.message, observedRevision, undefined, validation.fieldPath)
        }
        if (!options.addTaxClass) {
          return createFailureResult('unsupported_operation', 'Adding tax classes is not available in this host.', observedRevision)
        }
        const taxClass = createTaxClass(validation.value)
        await options.addTaxClass(taxClass)
        options.commitMutationHistory?.()
        const nextRevision = currentRevision()
        return createSuccessResult({ taxClassId: taxClass.id }, nextRevision)
      })
    },
    updateTaxClass(id, patch) {
      return enqueueMutation(async () => {
        const observedRevision = currentRevision()
        const taxClass = options.quotation.value.totalsConfig.taxClasses?.find((entry) => entry.id === id)
        if (!taxClass) {
          return createFailureResult('tax_class_not_found', 'The tax class was not found.', observedRevision, undefined, 'id')
        }
        const validation = validateTaxClassPatch(patch)
        if (!validation.ok) {
          return createFailureResult(validation.code, validation.message, observedRevision, undefined, validation.fieldPath)
        }
        if (!options.updateTaxClassField) {
          return createFailureResult('unsupported_operation', 'Updating tax classes is not available in this host.', observedRevision)
        }
        if (validation.value.label !== undefined) await options.updateTaxClassField(id, 'label', validation.value.label)
        if (validation.value.rate !== undefined) await options.updateTaxClassField(id, 'rate', validation.value.rate)
        options.commitMutationHistory?.()
        const nextRevision = currentRevision()
        return createSuccessResult(cloneSerializable(taxClass), nextRevision)
      })
    },
    removeTaxClass(id) {
      return enqueueMutation(async () => {
        const observedRevision = currentRevision()
        const taxClasses = options.quotation.value.totalsConfig.taxClasses ?? []
        if (!taxClasses.some((entry) => entry.id === id)) {
          return createFailureResult('tax_class_not_found', 'The tax class was not found.', observedRevision, undefined, 'id')
        }
        if (taxClasses.length <= 1) {
          return createFailureResult('last_tax_class', 'The last tax class cannot be removed.', observedRevision, undefined, 'id')
        }
        if (!options.removeTaxClass) {
          return createFailureResult('unsupported_operation', 'Removing tax classes is not available in this host.', observedRevision)
        }
        await options.removeTaxClass(id)
        options.commitMutationHistory?.()
        const nextRevision = currentRevision()
        return createSuccessResult({ taxClassId: id }, nextRevision)
      })
    },
    setDefaultTaxClass(id) {
      return enqueueMutation(async () => {
        const observedRevision = currentRevision()
        if (!hasTaxClass(options.quotation.value, id)) {
          return createFailureResult('tax_class_not_found', 'The tax class was not found.', observedRevision, undefined, 'id')
        }
        if (!options.setDefaultTaxClass) {
          return createFailureResult('unsupported_operation', 'Changing the default tax class is not available in this host.', observedRevision)
        }
        await options.setDefaultTaxClass(id)
        options.commitMutationHistory?.()
        const nextRevision = currentRevision()
        return createSuccessResult({ taxClassId: id }, nextRevision)
      })
    },
    assignItemTaxClass(itemId, taxClassId) {
      return enqueueMutation(async () => {
        const observedRevision = currentRevision()
        const item = findQuotationRow(options.quotation.value.majorItems, itemId)
        if (!isQuotationItem(item)) {
          return createFailureResult('item_not_found', 'The line item was not found.', observedRevision, undefined, 'itemId')
        }
        if (!hasTaxClass(options.quotation.value, taxClassId)) {
          return createFailureResult('tax_class_not_found', 'The tax class was not found.', observedRevision, undefined, 'taxClassId')
        }
        if (!options.updateItemFields) {
          return createFailureResult('unsupported_operation', 'Assigning item tax classes is not available in this host.', observedRevision)
        }
        await options.updateItemFields(itemId, { taxClassId })
        options.commitMutationHistory?.()
        const nextRevision = currentRevision()
        return createSuccessResult({ itemId, taxClassId }, nextRevision)
      })
    },
    addExtraCharge(input) {
      return enqueueMutation(async () => {
        const observedRevision = currentRevision()
        const validation = validateNewExtraCharge(input)
        if (!validation.ok) {
          return createFailureResult(validation.code, validation.message, observedRevision, undefined, validation.fieldPath)
        }
        if (!options.addExtraCharge) {
          return createFailureResult('unsupported_operation', 'Adding extra charges is not available in this host.', observedRevision)
        }
        const charge = { id: crypto.randomUUID(), ...validation.value }
        await options.addExtraCharge(charge)
        options.commitMutationHistory?.()
        const nextRevision = currentRevision()
        return createSuccessResult({ extraChargeId: charge.id }, nextRevision)
      })
    },
    updateExtraCharge(id, patch) {
      return enqueueMutation(async () => {
        const observedRevision = currentRevision()
        const charge = options.quotation.value.totalsConfig.extraCharges?.find((entry) => entry.id === id)
        if (!charge) {
          return createFailureResult('extra_charge_not_found', 'The extra charge was not found.', observedRevision, undefined, 'id')
        }
        const validation = validateExtraChargePatch(patch)
        if (!validation.ok) {
          return createFailureResult(validation.code, validation.message, observedRevision, undefined, validation.fieldPath)
        }
        if (!options.updateExtraChargeField) {
          return createFailureResult('unsupported_operation', 'Updating extra charges is not available in this host.', observedRevision)
        }
        if (validation.value.label !== undefined) await options.updateExtraChargeField(id, 'label', validation.value.label)
        if (validation.value.amount !== undefined) await options.updateExtraChargeField(id, 'amount', validation.value.amount)
        options.commitMutationHistory?.()
        const nextRevision = currentRevision()
        return createSuccessResult(cloneSerializable(charge), nextRevision)
      })
    },
    removeExtraCharge(id) {
      return enqueueMutation(async () => {
        const observedRevision = currentRevision()
        if (!options.quotation.value.totalsConfig.extraCharges?.some((entry) => entry.id === id)) {
          return createFailureResult('extra_charge_not_found', 'The extra charge was not found.', observedRevision, undefined, 'id')
        }
        if (!options.removeExtraCharge) {
          return createFailureResult('unsupported_operation', 'Removing extra charges is not available in this host.', observedRevision)
        }
        await options.removeExtraCharge(id)
        options.commitMutationHistory?.()
        const nextRevision = currentRevision()
        return createSuccessResult({ extraChargeId: id }, nextRevision)
      })
    },
    async previewItemGoalSeek(input) {
      await mutationQueue
      const observedRevision = currentRevision()
      const validation = validateItemGoalSeekInput(input, options.quotation.value)
      if (!validation.ok) {
        return createFailureResult(validation.code, validation.message, observedRevision, undefined, validation.fieldPath)
      }
      const result = solveItemGoalSeekMarkup(
        validation.value.item,
        validation.value.targetUnitPriceBeforeTax,
        options.quotation.value.exchangeRates,
      )
      return createSuccessResult(cloneSerializable(result), observedRevision)
    },
    applyItemGoalSeek(input) {
      return enqueueMutation(async () => {
        const observedRevision = currentRevision()
        const validation = validateItemGoalSeekInput(input, options.quotation.value)
        if (!validation.ok) {
          return createFailureResult(validation.code, validation.message, observedRevision, undefined, validation.fieldPath)
        }
        const result = solveItemGoalSeekMarkup(
          validation.value.item,
          validation.value.targetUnitPriceBeforeTax,
          options.quotation.value.exchangeRates,
        )
        if (!result.ok) return createSuccessResult(cloneSerializable(result), observedRevision)
        if (!options.applyItemGoalSeek) {
          return createFailureResult('unsupported_operation', 'Applying item goal seek is not available in this host.', observedRevision)
        }
        await options.applyItemGoalSeek([{ itemId: validation.value.item.id, markupRate: result.markupRate }])
        options.commitMutationHistory?.()
        const nextRevision = currentRevision()
        return createSuccessResult(cloneSerializable(result), nextRevision)
      })
    },
    async previewQuotationGoalSeek(input) {
      await mutationQueue
      const observedRevision = currentRevision()
      const validation = validateQuotationGoalSeekInput(input)
      if (!validation.ok) {
        return createFailureResult(validation.code, validation.message, observedRevision, undefined, validation.fieldPath)
      }
      const result = solveQuotationGoalSeekGlobalMarkup(
        options.quotation.value.majorItems,
        validation.value.targetAmount,
        options.quotation.value.exchangeRates,
        { target: validation.value.target, totalsConfig: options.quotation.value.totalsConfig },
      )
      return createSuccessResult(cloneSerializable(result), observedRevision)
    },
    applyQuotationGoalSeek(input) {
      return enqueueMutation(async () => {
        const observedRevision = currentRevision()
        const validation = validateQuotationGoalSeekInput(input)
        if (!validation.ok) {
          return createFailureResult(validation.code, validation.message, observedRevision, undefined, validation.fieldPath)
        }
        const result = solveQuotationGoalSeekGlobalMarkup(
          options.quotation.value.majorItems,
          validation.value.targetAmount,
          options.quotation.value.exchangeRates,
          { target: validation.value.target, totalsConfig: options.quotation.value.totalsConfig },
        )
        if (!result.ok) return createSuccessResult(cloneSerializable(result), observedRevision)
        if (!options.applyQuotationGoalSeek) {
          return createFailureResult('unsupported_operation', 'Applying quotation goal seek is not available in this host.', observedRevision)
        }
        await options.applyQuotationGoalSeek(result.markupRate)
        options.commitMutationHistory?.()
        const nextRevision = currentRevision()
        return createSuccessResult(cloneSerializable(result), nextRevision)
      })
    },
    applyOperations(request) {
      return enqueueMutation(async () => {
        const observedRevision = currentRevision()
        const requestValidation = validateApplyOperationsRequest(request)
        if (!requestValidation.ok) {
          return createFailureResult(
            requestValidation.code,
            requestValidation.message,
            observedRevision,
            undefined,
            requestValidation.fieldPath,
          )
        }
        if (
          requestValidation.value.expectedRevision !== undefined
          && requestValidation.value.expectedRevision !== observedRevision
        ) {
          return createFailureResult(
            'revision_conflict',
            'The quotation changed after the caller observed it.',
            observedRevision,
            undefined,
            'expectedRevision',
            {
              expectedRevision: requestValidation.value.expectedRevision,
              actualRevision: observedRevision,
            },
          )
        }
        if (!options.replaceQuotationDraft) {
          return createFailureResult('unsupported_operation', 'Atomic batch operations are not available in this host.', observedRevision)
        }

        const draft = cloneSerializable(options.quotation.value)
        const operationResults: Array<{ index: number; type: QuotationOperation['type']; data?: Record<string, unknown> }> = []
        for (let index = 0; index < requestValidation.value.operations.length; index += 1) {
          const operation = requestValidation.value.operations[index]!
          const result = applyOperationToDraft(draft, operation)
          if (!result.ok) {
            return createFailureResult(
              result.code,
              result.message,
              observedRevision,
              undefined,
              result.fieldPath,
              { operationIndex: index, operationType: operation.type },
            )
          }
          operationResults.push({ index, type: operation.type, ...(result.data ? { data: result.data } : {}) })
        }

        normalizeQuotationDraft(draft)
        const validationReport = validateQuotationFileContent(createQuotationFileContent(draft))
        if (!validationReport.valid) {
          return createFailureResult(
            'validation_failed',
            'The completed batch did not produce a valid quotation.',
            observedRevision,
            undefined,
            validationReport.issues[0]?.fieldPath,
            { issues: validationReport.issues },
          )
        }

        await options.replaceQuotationDraft(draft)
        options.commitMutationHistory?.()
        const nextRevision = currentRevision()
        return createSuccessResult({
          revision: nextRevision,
          operationResults,
          snapshot: createSnapshot(nextRevision),
        }, nextRevision)
      })
    },
    async getQuotationSnapshot() {
      await mutationQueue
      const snapshotRevision = currentRevision()
      return createSuccessResult(createSnapshot(snapshotRevision), snapshotRevision)
    },
    async serializeQuotation() {
      await mutationQueue
      const serializationRevision = currentRevision()

      try {
        const quotation = cloneSerializable(options.quotation.value)
        const serialized: SerializedQuotation = {
          schemaVersion: QUOTATION_FILE_SCHEMA_VERSION,
          quotation,
          content: createQuotationFileContent(quotation),
          revision: serializationRevision,
        }

        return createSuccessResult(serialized, serializationRevision)
      } catch (error) {
        return createFailureResult('internal_error', 'Unable to serialize the active quotation.', serializationRevision, error)
      }
    },
    async validateQuotation() {
      await mutationQueue
      const validationRevision = currentRevision()

      try {
        return createSuccessResult(
          validateQuotationFileContent(createQuotationFileContent(options.quotation.value)),
          validationRevision,
        )
      } catch (error) {
        return createFailureResult('internal_error', 'Unable to validate the active quotation.', validationRevision, error)
      }
    },
    async validateQuotationContent(content: string) {
      await mutationQueue
      const validationRevision = currentRevision()
      if (typeof content !== 'string') {
        return createFailureResult(
          'invalid_argument',
          'Quotation content must be a string.',
          validationRevision,
          undefined,
          'content',
        )
      }

      return createSuccessResult(validateQuotationFileContent(content), validationRevision)
    },
  }
}

function createCapabilities(options: UseQuotationAgentApiV2Options) {
  const { capabilities } = options.runtime

  return {
    host: options.host ?? resolveAutomationHost(capabilities.isDesktop),
    pathImport: capabilities.isDesktop,
    pathExport: capabilities.isDesktop,
    directPdfExport: capabilities.supportsDirectPdfExport,
    browserPrint: capabilities.supportsBrowserPrint,
    exchangeRateRefresh: true,
    goodsReceipt: true,
    batchOperations: Boolean(options.replaceQuotationDraft),
  }
}

function resolveAutomationHost(isDesktop: boolean): QuotationAutomationHost {
  if (!isDesktop) {
    return 'web-ui'
  }

  const locationHref = typeof window === 'undefined' ? '' : window.location?.href ?? ''
  if (locationHref) {
    const mode = new URL(locationHref).searchParams.get('mode')
    if (mode === 'automation') {
      return 'headless'
    }
  }

  return 'desktop-ui'
}

async function getAppVersion(runtime: UseQuotationAgentApiV2Options['runtime']) {
  try {
    return await runtime.getAppVersion()
  } catch {
    return 'unknown'
  }
}

function createQuotationFingerprint(quotation: QuotationDraft) {
  return JSON.stringify(quotation)
}

type InputValidation<T> =
  | { ok: true; value: T }
  | { ok: false; code: string; message: string; fieldPath: string }

const CREATE_QUOTATION_KEYS = ['header', 'templateId', 'branding', 'lineItemEntryMode', 'outputSettings'] as const
const HEADER_KEYS: readonly (keyof QuotationHeader)[] = [
  'quotationNumber',
  'revisionNumber',
  'quotationDate',
  'customerCompany',
  'contactPerson',
  'contactDetails',
  'projectName',
  'validityPeriod',
  'currency',
  'documentLocale',
  'notes',
  'terms',
]
const BRANDING_KEYS: readonly (keyof QuotationDraft['branding'])[] = ['logoDataUrl', 'accentColor']
const OUTPUT_SETTINGS_KEYS: readonly (keyof QuotationOutputSettings)[] = ['itemDetailLevel']
const ITEM_PATCH_KEYS: readonly (keyof QuotationItemPatch)[] = [
  'name',
  'description',
  'quantity',
  'quantityUnit',
  'pricingMethod',
  'manualUnitPrice',
  'unitCost',
  'costCurrency',
  'markupRate',
  'taxClassId',
  'expectedTotal',
  'notes',
]

function validateCreateQuotationInput(input: CreateQuotationInput): InputValidation<CreateQuotationInput> {
  if (!isRecord(input)) {
    return invalidInput('invalid_argument', 'Create-quotation input must be an object.', 'input')
  }
  const unknownField = findUnknownField(input, CREATE_QUOTATION_KEYS)
  if (unknownField) {
    return invalidInput('unknown_field', 'Create-quotation input contains an unknown field.', unknownField)
  }

  const normalized: CreateQuotationInput = {}
  if ('header' in input) {
    const result = validateHeaderPatch(input.header as Partial<QuotationHeader>)
    if (!result.ok) return prefixValidationPath(result, 'header')
    normalized.header = result.value
  }
  if ('templateId' in input) {
    if (!QUOTATION_TEMPLATE_IDS.includes(input.templateId as QuotationTemplateId)) {
      return invalidInput('invalid_argument', 'The quotation template is not supported.', 'templateId')
    }
    normalized.templateId = input.templateId as QuotationTemplateId
  }
  if ('branding' in input) {
    const result = validateBrandingPatch(input.branding as QuotationBrandingPatch)
    if (!result.ok) return prefixValidationPath(result, 'branding')
    normalized.branding = result.value
  }
  if ('lineItemEntryMode' in input) {
    if (!isLineItemEntryMode(input.lineItemEntryMode)) {
      return invalidInput('invalid_argument', 'The line-item entry mode is invalid.', 'lineItemEntryMode')
    }
    normalized.lineItemEntryMode = input.lineItemEntryMode
  }
  if ('outputSettings' in input) {
    const result = validateOutputSettingsPatch(input.outputSettings as QuotationOutputSettingsPatch)
    if (!result.ok) return prefixValidationPath(result, 'outputSettings')
    normalized.outputSettings = result.value
  }

  return { ok: true, value: normalized }
}

function validateHeaderPatch(patch: Partial<QuotationHeader>): InputValidation<Partial<QuotationHeader>> {
  if (!isRecord(patch)) {
    return invalidInput('invalid_argument', 'The quotation header patch must be an object.', 'patch')
  }
  const unknownField = findUnknownField(patch, HEADER_KEYS)
  if (unknownField) {
    return invalidInput('unknown_field', 'The quotation header patch contains an unknown field.', unknownField)
  }

  const normalized = { ...patch } as Partial<QuotationHeader>
  for (const [field, value] of Object.entries(patch)) {
    if (field === 'revisionNumber') {
      if (!Number.isInteger(value) || (value as number) < 0) {
        return invalidInput('invalid_argument', 'Revision number must be a non-negative integer.', field)
      }
      continue
    }
    if (field === 'documentLocale') {
      if (!SUPPORTED_LOCALES.includes(value as SupportedLocale)) {
        return invalidInput('invalid_argument', 'The document locale is not supported.', field)
      }
      continue
    }
    if (field === 'currency') {
      const currency = parseCurrencyCode(value)
      if (!currency) {
        return invalidInput('invalid_argument', 'The quotation currency is invalid.', field)
      }
      normalized.currency = currency
      continue
    }
    if (typeof value !== 'string') {
      return invalidInput('invalid_argument', 'Quotation header text fields must be strings.', field)
    }
    if (field === 'quotationDate' && !isValidDateOnly(value)) {
      return invalidInput('invalid_argument', 'Quotation date must use a valid YYYY-MM-DD date.', field)
    }
  }

  return { ok: true, value: normalized }
}

function validateBrandingPatch(patch: QuotationBrandingPatch): InputValidation<QuotationBrandingPatch> {
  if (!isRecord(patch)) {
    return invalidInput('invalid_argument', 'The branding patch must be an object.', 'patch')
  }
  const unknownField = findUnknownField(patch, BRANDING_KEYS)
  if (unknownField) {
    return invalidInput('unknown_field', 'The branding patch contains an unknown field.', unknownField)
  }
  if ('logoDataUrl' in patch && typeof patch.logoDataUrl !== 'string') {
    return invalidInput('invalid_argument', 'Logo data URL must be a string.', 'logoDataUrl')
  }
  if (patch.logoDataUrl && !isImageDataUrl(patch.logoDataUrl)) {
    return invalidInput('invalid_argument', 'Logo must be a base64 image data URL.', 'logoDataUrl')
  }
  if ('accentColor' in patch && (typeof patch.accentColor !== 'string' || !/^#[0-9a-f]{6}$/i.test(patch.accentColor))) {
    return invalidInput('invalid_argument', 'Accent color must be a six-digit hex color.', 'accentColor')
  }

  return { ok: true, value: { ...patch } }
}

function validateOutputSettingsPatch(
  patch: QuotationOutputSettingsPatch,
): InputValidation<QuotationOutputSettingsPatch> {
  if (!isRecord(patch)) {
    return invalidInput('invalid_argument', 'The output-settings patch must be an object.', 'patch')
  }
  const unknownField = findUnknownField(patch, OUTPUT_SETTINGS_KEYS)
  if (unknownField) {
    return invalidInput('unknown_field', 'The output-settings patch contains an unknown field.', unknownField)
  }
  if ('itemDetailLevel' in patch && ![1, 2, 3].includes(patch.itemDetailLevel as number)) {
    return invalidInput('invalid_argument', 'Item detail level must be 1, 2, or 3.', 'itemDetailLevel')
  }

  return { ok: true, value: { ...patch } }
}

function validateAddLineItemInput(
  input: AddLineItemInput,
  quotation: QuotationDraft,
): InputValidation<{ parentId: string | null; index: number; item: QuotationItemPatch }> {
  if (!isRecord(input)) {
    return invalidInput('invalid_argument', 'Add-line-item input must be an object.', 'input')
  }
  const unknownField = findUnknownField(input, ['parentId', 'index', 'item'])
  if (unknownField) {
    return invalidInput('unknown_field', 'Add-line-item input contains an unknown field.', unknownField)
  }

  const parentId = input.parentId ?? null
  if (parentId !== null && !isNonEmptyString(parentId)) {
    return invalidInput('invalid_argument', 'Parent ID must be a non-empty string or null.', 'parentId')
  }
  const parentPath = parentId === null ? null : findQuotationItemPathById(quotation.majorItems, parentId)
  if (parentId !== null && !parentPath) {
    return invalidInput('invalid_parent', 'The parent line item was not found.', 'parentId')
  }
  if (parentPath && parentPath.length >= 3) {
    return invalidInput('invalid_depth', 'Quotation items cannot be nested deeper than three levels.', 'parentId')
  }

  const targetLength = parentPath?.at(-1)?.children.length ?? quotation.majorItems.length
  const rawIndex = input.index
  const index = rawIndex === undefined ? targetLength : rawIndex
  if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index > targetLength) {
    return invalidInput('invalid_index', 'Line-item index is outside the target collection.', 'index')
  }
  const itemValidation = validateQuotationItemPatch((input.item ?? {}) as QuotationItemPatch, quotation)
  if (!itemValidation.ok) return prefixValidationPath(itemValidation, 'item')

  return { ok: true, value: { parentId, index, item: itemValidation.value } }
}

function validateAddSectionHeaderInput(
  input: AddSectionHeaderInput,
  quotation: QuotationDraft,
): InputValidation<{ index: number; title: string }> {
  if (!isRecord(input)) {
    return invalidInput('invalid_argument', 'Add-section-header input must be an object.', 'input')
  }
  const unknownField = findUnknownField(input, ['index', 'title'])
  if (unknownField) {
    return invalidInput('unknown_field', 'Add-section-header input contains an unknown field.', unknownField)
  }
  if (!isNonEmptyString(input.title)) {
    return invalidInput('invalid_argument', 'Section title must be a non-empty string.', 'title')
  }
  const index = input.index ?? quotation.majorItems.length
  if (!Number.isInteger(index) || index < 0 || index > quotation.majorItems.length) {
    return invalidInput('invalid_index', 'Section-header index is outside the root collection.', 'index')
  }
  return { ok: true, value: { index, title: input.title } }
}

function validateQuotationItemPatch(
  patch: QuotationItemPatch,
  quotation: QuotationDraft,
  currentItem?: QuotationItem,
): InputValidation<QuotationItemPatch> {
  if (!isRecord(patch)) {
    return invalidInput('invalid_argument', 'The line-item patch must be an object.', 'patch')
  }
  const unknownField = findUnknownField(patch, ITEM_PATCH_KEYS)
  if (unknownField) {
    return invalidInput('unknown_field', 'The line-item patch contains an unknown field.', unknownField)
  }

  const normalized = { ...patch } as QuotationItemPatch
  for (const field of ['name', 'description', 'quantityUnit', 'notes'] as const) {
    if (field in patch && typeof patch[field] !== 'string') {
      return invalidInput('invalid_argument', 'Line-item text fields must be strings.', field)
    }
  }
  if ('name' in patch && !isNonEmptyString(patch.name)) {
    return invalidInput('invalid_argument', 'Line-item name must be a non-empty string.', 'name')
  }
  if ('quantity' in patch && (!isFiniteNumber(patch.quantity) || patch.quantity <= 0)) {
    return invalidInput('invalid_argument', 'Line-item quantity must be greater than zero.', 'quantity')
  }
  for (const field of ['manualUnitPrice', 'unitCost', 'expectedTotal'] as const) {
    const value = patch[field]
    if (field in patch && (!isFiniteNumber(value) || value < 0)) {
      return invalidInput('invalid_argument', 'Line-item monetary values must be non-negative numbers.', field)
    }
  }
  if ('markupRate' in patch && (!isFiniteNumber(patch.markupRate) || patch.markupRate < 0 || patch.markupRate > 1_000)) {
    return invalidInput('invalid_argument', 'Markup rate must be between 0 and 1000.', 'markupRate')
  }
  if ('pricingMethod' in patch && patch.pricingMethod !== 'cost_plus' && patch.pricingMethod !== 'manual_price') {
    return invalidInput('invalid_argument', 'Pricing method must be cost_plus or manual_price.', 'pricingMethod')
  }
  if (patch.pricingMethod && currentItem?.children.length) {
    return invalidInput('invalid_item_type', 'Pricing method can only be changed on leaf line items.', 'pricingMethod')
  }
  if ('costCurrency' in patch) {
    const currency = parseCurrencyCode(patch.costCurrency)
    if (!currency) {
      return invalidInput('invalid_argument', 'Cost currency is invalid.', 'costCurrency')
    }
    normalized.costCurrency = currency
  }
  if ('taxClassId' in patch) {
    if (!isNonEmptyString(patch.taxClassId)) {
      return invalidInput('invalid_argument', 'Tax class ID must be a non-empty string.', 'taxClassId')
    }
    const taxClassExists = quotation.totalsConfig.taxClasses?.some((taxClass) => taxClass.id === patch.taxClassId)
    if (!taxClassExists) {
      return invalidInput('tax_class_not_found', 'The tax class was not found.', 'taxClassId')
    }
  }

  return { ok: true, value: normalized }
}

function validateSectionHeaderPatch(patch: { title: string }): InputValidation<{ title: string }> {
  if (!isRecord(patch)) {
    return invalidInput('invalid_argument', 'The section-header patch must be an object.', 'patch')
  }
  const unknownField = findUnknownField(patch, ['title'])
  if (unknownField) {
    return invalidInput('unknown_field', 'The section-header patch contains an unknown field.', unknownField)
  }
  if (!isNonEmptyString(patch.title)) {
    return invalidInput('invalid_argument', 'Section title must be a non-empty string.', 'title')
  }
  return { ok: true, value: { title: patch.title } }
}

function validateMoveItem(
  itemId: string,
  target: MoveItemTarget,
  quotation: QuotationDraft,
): InputValidation<MoveItemTarget> {
  if (!isNonEmptyString(itemId)) {
    return invalidInput('invalid_argument', 'Item ID must be a non-empty string.', 'itemId')
  }
  const item = findQuotationRow(quotation.majorItems, itemId)
  if (!item) {
    return invalidInput('item_not_found', 'The quotation item was not found.', 'itemId')
  }
  if (!isRecord(target)) {
    return invalidInput('invalid_argument', 'Move target must be an object.', 'target')
  }
  const unknownField = findUnknownField(target, ['parentId', 'index'])
  if (unknownField) {
    return invalidInput('unknown_field', 'Move target contains an unknown field.', `target.${unknownField}`)
  }
  const parentId = target.parentId
  if (parentId !== null && !isNonEmptyString(parentId)) {
    return invalidInput('invalid_parent', 'Target parent ID must be a non-empty string or null.', 'target.parentId')
  }
  if (!isQuotationItem(item) && parentId !== null) {
    return invalidInput('invalid_parent', 'Section headers can only be moved at the root level.', 'target.parentId')
  }
  if (parentId === itemId || (isQuotationItem(item) && containsItemId(item.children, parentId))) {
    return invalidInput('circular_move', 'An item cannot be moved inside its own subtree.', 'target.parentId')
  }

  const parentPath = parentId === null ? null : findQuotationItemPathById(quotation.majorItems, parentId)
  if (parentId !== null && !parentPath) {
    return invalidInput('invalid_parent', 'The target parent was not found.', 'target.parentId')
  }
  if (isQuotationItem(item) && parentPath && parentPath.length + getItemSubtreeDepth(item) > 3) {
    return invalidInput('invalid_depth', 'Quotation items cannot be nested deeper than three levels.', 'target.parentId')
  }
  const targetLength = parentPath?.at(-1)?.children.length ?? quotation.majorItems.length
  if (!Number.isInteger(target.index) || target.index < 0 || target.index > targetLength) {
    return invalidInput('invalid_index', 'Move index is outside the target collection.', 'target.index')
  }

  return { ok: true, value: { parentId, index: target.index } }
}

function validateExchangeRate(
  currency: unknown,
  rate: unknown,
): InputValidation<{ currency: string; rate: number }> {
  const normalizedCurrency = parseCurrencyCode(currency)
  if (!normalizedCurrency) {
    return invalidInput('invalid_argument', 'Exchange-rate currency is invalid.', 'currency')
  }
  if (!isFiniteNumber(rate) || rate < MIN_EXCHANGE_RATE || rate > MAX_EXCHANGE_RATE) {
    return invalidInput(
      'invalid_argument',
      `Exchange rate must be between ${MIN_EXCHANGE_RATE} and ${MAX_EXCHANGE_RATE}.`,
      'rate',
    )
  }
  return { ok: true, value: { currency: normalizedCurrency, rate } }
}

function validateExchangeRateTable(
  rates: ExchangeRateTable | undefined,
): InputValidation<ExchangeRateTable | undefined> {
  if (rates === undefined) return { ok: true, value: undefined }
  if (!isRecord(rates)) {
    return invalidInput('invalid_argument', 'Exchange rates must be an object.', 'rates')
  }
  const normalized: ExchangeRateTable = {}
  for (const [currency, rate] of Object.entries(rates)) {
    const validation = validateExchangeRate(currency, rate)
    if (!validation.ok) return prefixValidationPath(validation, 'rates')
    normalized[validation.value.currency] = validation.value.rate
  }
  return { ok: true, value: normalized }
}

function validateNewTaxClass(input: NewTaxClass): InputValidation<NewTaxClass> {
  const validation = validateTaxClassPatch(input)
  if (!validation.ok) return validation as InputValidation<NewTaxClass>
  if (validation.value.label === undefined) {
    return invalidInput('invalid_argument', 'Tax class label is required.', 'label')
  }
  if (validation.value.rate === undefined) {
    return invalidInput('invalid_argument', 'Tax class rate is required.', 'rate')
  }
  return { ok: true, value: { label: validation.value.label, rate: validation.value.rate } }
}

function validateTaxClassPatch(patch: TaxClassPatch): InputValidation<TaxClassPatch> {
  if (!isRecord(patch)) {
    return invalidInput('invalid_argument', 'The tax-class patch must be an object.', 'patch')
  }
  const unknownField = findUnknownField(patch, ['label', 'rate'])
  if (unknownField) {
    return invalidInput('unknown_field', 'The tax-class patch contains an unknown field.', unknownField)
  }
  if ('label' in patch && !isNonEmptyString(patch.label)) {
    return invalidInput('invalid_argument', 'Tax class label must be a non-empty string.', 'label')
  }
  if ('rate' in patch && (!isFiniteNumber(patch.rate) || patch.rate < 0 || patch.rate > MAX_TAX_RATE)) {
    return invalidInput('invalid_argument', `Tax rate must be between 0 and ${MAX_TAX_RATE}.`, 'rate')
  }
  return { ok: true, value: { ...patch } }
}

function validateNewExtraCharge(input: NewExtraCharge): InputValidation<NewExtraCharge> {
  const validation = validateExtraChargePatch(input)
  if (!validation.ok) return validation as InputValidation<NewExtraCharge>
  if (validation.value.label === undefined) {
    return invalidInput('invalid_argument', 'Extra-charge label is required.', 'label')
  }
  if (validation.value.amount === undefined) {
    return invalidInput('invalid_argument', 'Extra-charge amount is required.', 'amount')
  }
  return { ok: true, value: { label: validation.value.label, amount: validation.value.amount } }
}

function validateExtraChargePatch(patch: ExtraChargePatch): InputValidation<ExtraChargePatch> {
  if (!isRecord(patch)) {
    return invalidInput('invalid_argument', 'The extra-charge patch must be an object.', 'patch')
  }
  const unknownField = findUnknownField(patch, ['label', 'amount'])
  if (unknownField) {
    return invalidInput('unknown_field', 'The extra-charge patch contains an unknown field.', unknownField)
  }
  if ('label' in patch && !isNonEmptyString(patch.label)) {
    return invalidInput('invalid_argument', 'Extra-charge label must be a non-empty string.', 'label')
  }
  if ('amount' in patch && (!isFiniteNumber(patch.amount) || patch.amount < 0)) {
    return invalidInput('invalid_argument', 'Extra-charge amount must be a non-negative number.', 'amount')
  }
  return { ok: true, value: { ...patch } }
}

function validateItemGoalSeekInput(
  input: ItemGoalSeekInput,
  quotation: QuotationDraft,
): InputValidation<{ item: QuotationItem; targetUnitPriceBeforeTax: number }> {
  if (!isRecord(input)) {
    return invalidInput('invalid_argument', 'Item goal-seek input must be an object.', 'input')
  }
  const unknownField = findUnknownField(input, ['itemId', 'targetUnitPriceBeforeTax'])
  if (unknownField) {
    return invalidInput('unknown_field', 'Item goal-seek input contains an unknown field.', unknownField)
  }
  if (!isNonEmptyString(input.itemId)) {
    return invalidInput('invalid_argument', 'Item ID must be a non-empty string.', 'itemId')
  }
  const item = findQuotationRow(quotation.majorItems, input.itemId)
  if (!isQuotationItem(item)) {
    return invalidInput('item_not_found', 'The line item was not found.', 'itemId')
  }
  if (!isFiniteNumber(input.targetUnitPriceBeforeTax) || input.targetUnitPriceBeforeTax < 0) {
    return invalidInput('invalid_argument', 'Target unit price must be a non-negative number.', 'targetUnitPriceBeforeTax')
  }
  return { ok: true, value: { item, targetUnitPriceBeforeTax: input.targetUnitPriceBeforeTax } }
}

function validateQuotationGoalSeekInput(
  input: QuotationGoalSeekInput,
): InputValidation<QuotationGoalSeekInput> {
  if (!isRecord(input)) {
    return invalidInput('invalid_argument', 'Quotation goal-seek input must be an object.', 'input')
  }
  const unknownField = findUnknownField(input, ['target', 'targetAmount'])
  if (unknownField) {
    return invalidInput('unknown_field', 'Quotation goal-seek input contains an unknown field.', unknownField)
  }
  if (!['subtotal_before_tax', 'total_after_tax', 'quotation_total'].includes(String(input.target))) {
    return invalidInput('invalid_argument', 'Quotation goal-seek target is invalid.', 'target')
  }
  if (!isFiniteNumber(input.targetAmount) || input.targetAmount < 0) {
    return invalidInput('invalid_argument', 'Quotation goal-seek amount must be a non-negative number.', 'targetAmount')
  }
  return {
    ok: true,
    value: {
      target: input.target as QuotationGoalSeekInput['target'],
      targetAmount: input.targetAmount,
    },
  }
}

function validateApplyOperationsRequest(
  request: ApplyOperationsRequest,
): InputValidation<ApplyOperationsRequest> {
  if (!isRecord(request)) {
    return invalidInput('invalid_argument', 'Batch request must be an object.', 'request')
  }
  const unknownField = findUnknownField(request, ['expectedRevision', 'operations'])
  if (unknownField) {
    return invalidInput('unknown_field', 'Batch request contains an unknown field.', unknownField)
  }
  if (
    request.expectedRevision !== undefined
    && (!Number.isInteger(request.expectedRevision) || request.expectedRevision < 0)
  ) {
    return invalidInput('invalid_argument', 'Expected revision must be a non-negative integer.', 'expectedRevision')
  }
  if (!Array.isArray(request.operations) || request.operations.length === 0) {
    return invalidInput('invalid_argument', 'Batch operations must be a non-empty array.', 'operations')
  }
  const supportedTypes = new Set<QuotationOperation['type']>([
    'updateHeader',
    'setTemplate',
    'setBranding',
    'setLineItemEntryMode',
    'setOutputSettings',
    'addLineItem',
    'addSectionHeader',
    'updateLineItem',
    'updateSectionHeader',
    'removeItem',
    'duplicateItem',
    'moveItem',
    'setGlobalMarkupRate',
    'updateExchangeRate',
    'setTaxMode',
    'setMixedTaxDocumentColumns',
    'addTaxClass',
    'updateTaxClass',
    'removeTaxClass',
    'setDefaultTaxClass',
    'assignItemTaxClass',
    'addExtraCharge',
    'updateExtraCharge',
    'removeExtraCharge',
    'applyItemGoalSeek',
    'applyQuotationGoalSeek',
  ])
  for (let index = 0; index < request.operations.length; index += 1) {
    const operation = request.operations[index]
    if (!isRecord(operation) || typeof operation.type !== 'string' || !supportedTypes.has(operation.type as QuotationOperation['type'])) {
      return invalidInput('unsupported_operation', 'Batch contains an unsupported operation.', `operations.${index}.type`)
    }
  }
  return {
    ok: true,
    value: {
      ...(request.expectedRevision !== undefined ? { expectedRevision: request.expectedRevision } : {}),
      operations: request.operations as QuotationOperation[],
    },
  }
}

type DraftOperationResult =
  | { ok: true; data?: Record<string, unknown> }
  | { ok: false; code: string; message: string; fieldPath?: string }

function applyOperationToDraft(draft: QuotationDraft, operation: QuotationOperation): DraftOperationResult {
  switch (operation.type) {
    case 'updateHeader': {
      const validation = validateHeaderPatch(operation.patch)
      if (!validation.ok) return validationFailure(validation)
      if (validation.value.currency !== undefined) {
        return draftOperationFailure('unsupported_operation', 'Batch header updates cannot change quotation currency.', 'patch.currency')
      }
      Object.assign(draft.header, validation.value)
      return { ok: true }
    }
    case 'setTemplate':
      if (!QUOTATION_TEMPLATE_IDS.includes(operation.templateId)) {
        return draftOperationFailure('invalid_argument', 'The quotation template is not supported.', 'templateId')
      }
      draft.templateId = operation.templateId
      return { ok: true }
    case 'setBranding': {
      const validation = validateBrandingPatch(operation.patch)
      if (!validation.ok) return validationFailure(validation)
      Object.assign(draft.branding, validation.value)
      return { ok: true }
    }
    case 'setLineItemEntryMode':
      if (!isLineItemEntryMode(operation.mode)) {
        return draftOperationFailure('invalid_argument', 'The line-item entry mode is invalid.', 'mode')
      }
      draft.lineItemEntryMode = operation.mode
      return { ok: true }
    case 'setOutputSettings': {
      const validation = validateOutputSettingsPatch(operation.patch)
      if (!validation.ok) return validationFailure(validation)
      draft.outputSettings = {
        itemDetailLevel: validation.value.itemDetailLevel ?? draft.outputSettings?.itemDetailLevel ?? 3,
      }
      return { ok: true }
    }
    case 'addLineItem': {
      const validation = validateAddLineItemInput(operation.input ?? {}, draft)
      if (!validation.ok) return validationFailure(validation)
      const parent = validation.value.parentId
        ? findQuotationRow(draft.majorItems, validation.value.parentId)
        : null
      const targetRows = isQuotationItem(parent) ? parent.children : draft.majorItems
      const fallbackCurrency = isQuotationItem(parent) ? parent.costCurrency : draft.header.currency
      const item = createQuotationItem(
        fallbackCurrency,
        { ...validation.value.item, children: [] },
        draft.header.documentLocale,
      )
      const nextRates = addCurrencyToRateTable(draft.exchangeRates, item.costCurrency, draft.header.currency)
      if (!(item.costCurrency in nextRates)) {
        return draftOperationFailure('exchange_rate_unavailable', 'No exchange rate is available for the item currency.', 'input.item.costCurrency')
      }
      draft.exchangeRates = nextRates
      targetRows.splice(validation.value.index, 0, item)
      return { ok: true, data: { itemId: item.id } }
    }
    case 'addSectionHeader': {
      const validation = validateAddSectionHeaderInput(operation.input, draft)
      if (!validation.ok) return validationFailure(validation)
      const section = createQuotationSectionHeader(draft.header.documentLocale, { title: validation.value.title })
      draft.majorItems.splice(validation.value.index, 0, section)
      return { ok: true, data: { itemId: section.id } }
    }
    case 'updateLineItem': {
      const item = findQuotationRow(draft.majorItems, operation.itemId)
      if (!isQuotationItem(item)) {
        return draftOperationFailure(item ? 'invalid_item_type' : 'item_not_found', 'The line item was not found.', 'itemId')
      }
      const validation = validateQuotationItemPatch(operation.patch, draft, item)
      if (!validation.ok) return validationFailure(validation)
      if (validation.value.pricingMethod && validation.value.pricingMethod !== item.pricingMethod) {
        applyDraftPricingMethodChange(draft, item, validation.value.pricingMethod, validation.value)
      }
      Object.assign(item, validation.value)
      if (validation.value.costCurrency) {
        const nextRates = addCurrencyToRateTable(draft.exchangeRates, validation.value.costCurrency, draft.header.currency)
        if (!(validation.value.costCurrency in nextRates)) {
          return draftOperationFailure('exchange_rate_unavailable', 'No exchange rate is available for the item currency.', 'patch.costCurrency')
        }
        draft.exchangeRates = nextRates
      }
      return { ok: true, data: { itemId: item.id } }
    }
    case 'updateSectionHeader': {
      const section = findQuotationRow(draft.majorItems, operation.itemId)
      if (!section || isQuotationItem(section)) {
        return draftOperationFailure(section ? 'invalid_item_type' : 'item_not_found', 'The section header was not found.', 'itemId')
      }
      const validation = validateSectionHeaderPatch(operation.patch)
      if (!validation.ok) return validationFailure(validation)
      section.title = validation.value.title
      return { ok: true, data: { itemId: section.id } }
    }
    case 'removeItem': {
      const location = findQuotationRowLocation(draft.majorItems, operation.itemId)
      if (!location) return draftOperationFailure('item_not_found', 'The quotation item was not found.', 'itemId')
      location.rows.splice(location.index, 1)
      if (location.rows === draft.majorItems && draft.majorItems.length === 0) {
        draft.majorItems.push(createQuotationItem(draft.header.currency, {}, draft.header.documentLocale))
      }
      return { ok: true, data: { itemId: operation.itemId } }
    }
    case 'duplicateItem': {
      const location = findQuotationRowLocation(draft.majorItems, operation.itemId)
      if (!location || !isQuotationItem(location.row)) {
        return draftOperationFailure(location ? 'invalid_item_type' : 'item_not_found', 'The line item was not found.', 'itemId')
      }
      const duplicate = duplicateQuotationItem(location.row, true, draft.header.documentLocale)
      location.rows.splice(location.index + 1, 0, duplicate)
      return { ok: true, data: { itemId: duplicate.id } }
    }
    case 'moveItem': {
      const validation = validateMoveItem(operation.itemId, operation.target, draft)
      if (!validation.ok) return validationFailure(validation)
      const source = findQuotationRowLocation(draft.majorItems, operation.itemId)
      if (!source) return draftOperationFailure('item_not_found', 'The quotation item was not found.', 'itemId')
      const targetParent = validation.value.parentId
        ? findQuotationRow(draft.majorItems, validation.value.parentId)
        : null
      const targetRows = isQuotationItem(targetParent) ? targetParent.children : draft.majorItems
      let targetIndex = validation.value.index
      if (source.rows === targetRows && source.index < targetIndex) targetIndex -= 1
      const [row] = source.rows.splice(source.index, 1)
      if (!row) return draftOperationFailure('mutation_failed', 'The quotation item could not be moved.', 'itemId')
      targetRows.splice(targetIndex, 0, row as QuotationItem)
      return { ok: true, data: { itemId: operation.itemId } }
    }
    case 'setGlobalMarkupRate':
      if (!isFiniteNumber(operation.rate) || operation.rate < 0 || operation.rate > MAX_MARKUP_RATE) {
        return draftOperationFailure('invalid_argument', `Global markup rate must be between 0 and ${MAX_MARKUP_RATE}.`, 'rate')
      }
      draft.totalsConfig.globalMarkupRate = operation.rate
      return { ok: true }
    case 'updateExchangeRate': {
      const validation = validateExchangeRate(operation.currency, operation.rate)
      if (!validation.ok) return validationFailure(validation)
      draft.exchangeRates[validation.value.currency] = validation.value.rate
      return { ok: true, data: validation.value }
    }
    case 'setTaxMode': {
      if (operation.mode !== 'single' && operation.mode !== 'mixed') {
        return draftOperationFailure('invalid_argument', 'Tax mode must be single or mixed.', 'mode')
      }
      if (operation.mode === 'single' && !canUseSingleTaxMode(getQuotationRootItems(draft.majorItems), draft.totalsConfig)) {
        if (!operation.taxClassId || !hasTaxClass(draft, operation.taxClassId)) {
          return draftOperationFailure('tax_class_required', 'A valid tax class is required for single-tax mode.', 'taxClassId')
        }
        for (const item of collectDraftItems(draft.majorItems)) item.taxClassId = operation.taxClassId
        draft.totalsConfig.defaultTaxClassId = operation.taxClassId
      }
      draft.totalsConfig.taxMode = operation.mode
      return { ok: true }
    }
    case 'setMixedTaxDocumentColumns':
      if (!Array.isArray(operation.columns) || operation.columns.some((column) => !MIXED_TAX_DOCUMENT_COLUMNS.includes(column))) {
        return draftOperationFailure('invalid_argument', 'Mixed-tax document columns contain an unsupported value.', 'columns')
      }
      draft.totalsConfig.mixedTaxColumns = [...new Set(operation.columns)]
      return { ok: true }
    case 'addTaxClass': {
      const validation = validateNewTaxClass(operation.input)
      if (!validation.ok) return validationFailure(validation)
      const taxClass = createTaxClass(validation.value)
      draft.totalsConfig.taxClasses ??= []
      draft.totalsConfig.taxClasses.push(taxClass)
      draft.totalsConfig.defaultTaxClassId ??= taxClass.id
      return { ok: true, data: { taxClassId: taxClass.id } }
    }
    case 'updateTaxClass': {
      const taxClass = draft.totalsConfig.taxClasses?.find((entry) => entry.id === operation.id)
      if (!taxClass) return draftOperationFailure('tax_class_not_found', 'The tax class was not found.', 'id')
      const validation = validateTaxClassPatch(operation.patch)
      if (!validation.ok) return validationFailure(validation)
      Object.assign(taxClass, validation.value)
      return { ok: true, data: { taxClassId: taxClass.id } }
    }
    case 'removeTaxClass': {
      const taxClasses = draft.totalsConfig.taxClasses ?? []
      const index = taxClasses.findIndex((entry) => entry.id === operation.id)
      if (index === -1) return draftOperationFailure('tax_class_not_found', 'The tax class was not found.', 'id')
      if (taxClasses.length <= 1) return draftOperationFailure('last_tax_class', 'The last tax class cannot be removed.', 'id')
      taxClasses.splice(index, 1)
      if (draft.totalsConfig.defaultTaxClassId === operation.id) {
        draft.totalsConfig.defaultTaxClassId = taxClasses[0]?.id
      }
      return { ok: true, data: { taxClassId: operation.id } }
    }
    case 'setDefaultTaxClass':
      if (!hasTaxClass(draft, operation.id)) {
        return draftOperationFailure('tax_class_not_found', 'The tax class was not found.', 'id')
      }
      draft.totalsConfig.defaultTaxClassId = operation.id
      return { ok: true }
    case 'assignItemTaxClass': {
      const item = findQuotationRow(draft.majorItems, operation.itemId)
      if (!isQuotationItem(item)) return draftOperationFailure('item_not_found', 'The line item was not found.', 'itemId')
      if (!hasTaxClass(draft, operation.taxClassId)) {
        return draftOperationFailure('tax_class_not_found', 'The tax class was not found.', 'taxClassId')
      }
      item.taxClassId = operation.taxClassId
      return { ok: true }
    }
    case 'addExtraCharge': {
      const validation = validateNewExtraCharge(operation.input)
      if (!validation.ok) return validationFailure(validation)
      const charge = { id: crypto.randomUUID(), ...validation.value }
      draft.totalsConfig.extraCharges ??= []
      draft.totalsConfig.extraCharges.push(charge)
      return { ok: true, data: { extraChargeId: charge.id } }
    }
    case 'updateExtraCharge': {
      const charge = draft.totalsConfig.extraCharges?.find((entry) => entry.id === operation.id)
      if (!charge) return draftOperationFailure('extra_charge_not_found', 'The extra charge was not found.', 'id')
      const validation = validateExtraChargePatch(operation.patch)
      if (!validation.ok) return validationFailure(validation)
      Object.assign(charge, validation.value)
      return { ok: true, data: { extraChargeId: charge.id } }
    }
    case 'removeExtraCharge': {
      const charges = draft.totalsConfig.extraCharges ?? []
      const index = charges.findIndex((entry) => entry.id === operation.id)
      if (index === -1) return draftOperationFailure('extra_charge_not_found', 'The extra charge was not found.', 'id')
      charges.splice(index, 1)
      return { ok: true, data: { extraChargeId: operation.id } }
    }
    case 'applyItemGoalSeek': {
      const validation = validateItemGoalSeekInput(operation.input, draft)
      if (!validation.ok) return validationFailure(validation)
      const result = solveItemGoalSeekMarkup(
        validation.value.item,
        validation.value.targetUnitPriceBeforeTax,
        draft.exchangeRates,
      )
      if (!result.ok) return draftOperationFailure('goal_seek_failed', `Item goal seek failed: ${result.reason}.`, 'input')
      validation.value.item.markupRate = result.markupRate
      return { ok: true, data: { itemId: validation.value.item.id, markupRate: result.markupRate } }
    }
    case 'applyQuotationGoalSeek': {
      const validation = validateQuotationGoalSeekInput(operation.input)
      if (!validation.ok) return validationFailure(validation)
      const result = solveQuotationGoalSeekGlobalMarkup(
        draft.majorItems,
        validation.value.targetAmount,
        draft.exchangeRates,
        { target: validation.value.target, totalsConfig: draft.totalsConfig },
      )
      if (!result.ok) return draftOperationFailure('goal_seek_failed', `Quotation goal seek failed: ${result.reason}.`, 'input')
      draft.totalsConfig.globalMarkupRate = result.markupRate
      return { ok: true, data: { markupRate: result.markupRate } }
    }
  }
}

function validationFailure<T>(validation: InputValidation<T>): DraftOperationResult {
  if (validation.ok) return { ok: true }
  return draftOperationFailure(validation.code, validation.message, validation.fieldPath)
}

function draftOperationFailure(code: string, message: string, fieldPath?: string): DraftOperationResult {
  return { ok: false, code, message, ...(fieldPath ? { fieldPath } : {}) }
}

function invalidInput<T>(code: string, message: string, fieldPath: string): InputValidation<T> {
  return { ok: false, code, message, fieldPath }
}

function prefixValidationPath<T>(validation: InputValidation<T>, prefix: string): InputValidation<T> {
  if (validation.ok) return validation
  return {
    ...validation,
    fieldPath: `${prefix}.${validation.fieldPath}`,
  }
}

function findUnknownField(value: Record<string, unknown>, allowedFields: readonly string[]) {
  return Object.keys(value).find((field) => !allowedFields.includes(field))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function findQuotationRow(rows: QuotationRootItem[] | QuotationItem[], itemId: string): QuotationRootItem | undefined {
  for (const row of rows) {
    if (row.id === itemId) return row
    if (isQuotationItem(row)) {
      const nested = findQuotationRow(row.children, itemId)
      if (nested) return nested
    }
  }
  return undefined
}

function findQuotationRowLocation(
  rows: QuotationRootItem[] | QuotationItem[],
  itemId: string,
): { rows: QuotationRootItem[] | QuotationItem[]; row: QuotationRootItem; index: number } | null {
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index] as QuotationRootItem
    if (row.id === itemId) return { rows, row, index }
    if (isQuotationItem(row)) {
      const nested = findQuotationRowLocation(row.children, itemId)
      if (nested) return nested
    }
  }
  return null
}

function findQuotationItemPathById(rows: QuotationRootItem[] | QuotationItem[], itemId: string): QuotationItem[] | null {
  for (const row of rows) {
    if (!isQuotationItem(row)) continue
    if (row.id === itemId) return [row]
    const nested = findQuotationItemPathById(row.children, itemId)
    if (nested) return [row, ...nested]
  }
  return null
}

function containsItemId(items: QuotationItem[], itemId: string | null): boolean {
  if (!itemId) return false
  return items.some((item) => item.id === itemId || containsItemId(item.children, itemId))
}

function getItemSubtreeDepth(item: QuotationItem): number {
  return item.children.length === 0
    ? 1
    : 1 + Math.max(...item.children.map(getItemSubtreeDepth))
}

function collectDraftItems(rows: QuotationRootItem[] | QuotationItem[]): QuotationItem[] {
  return rows.flatMap((row) => isQuotationItem(row) ? [row, ...collectDraftItems(row.children)] : [])
}

function applyDraftPricingMethodChange(
  draft: QuotationDraft,
  item: QuotationItem,
  method: PricingMethod,
  patch: QuotationItemPatch,
) {
  if (method === 'manual_price') {
    if (patch.manualUnitPrice === undefined) {
      const path = findQuotationItemPathById(draft.majorItems, item.id) ?? [item]
      const inheritedMarkupRate = path.slice(0, -1).reduce(
        (rate, parent) => getEffectiveMarkupRate(parent.markupRate, rate),
        draft.totalsConfig.globalMarkupRate,
      )
      item.manualUnitPrice = calculateQuotationItemUnitSellingPrice(
        item,
        draft.totalsConfig.globalMarkupRate,
        draft.exchangeRates,
        path.length > 1 ? inheritedMarkupRate : undefined,
      )
    }
    return
  }

  if (item.unitCost <= 0) {
    item.unitCost = patch.unitCost ?? item.manualUnitPrice ?? 0
    item.costCurrency = patch.costCurrency ?? item.costCurrency ?? draft.header.currency
    if (item.markupRate === undefined && patch.markupRate === undefined) item.markupRate = 0
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function hasTaxClass(quotation: QuotationDraft, taxClassId: string) {
  return quotation.totalsConfig.taxClasses?.some((taxClass) => taxClass.id === taxClassId) ?? false
}

function isPricingMethod(value: unknown): value is PricingMethod {
  return value === 'cost_plus' || value === 'manual_price'
}

function isLineItemEntryMode(value: unknown): value is LineItemEntryMode {
  return value === 'detailed' || value === 'quick'
}

function isImageDataUrl(value: string) {
  const match = /^data:image\/[a-z0-9.+-]+;base64,([a-z0-9+/]+={0,2})$/i.exec(value)
  return Boolean(match && match[1].length % 4 === 0)
}

function isValidDateOnly(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
}

function validateQuotationFileContent(content: string): QuotationValidationReport {
  try {
    parseQuotationFileContent(content)
    return {
      valid: true,
      schemaVersion: QUOTATION_FILE_SCHEMA_VERSION,
      issues: [],
    }
  } catch (error) {
    if (!(error instanceof QuotationFileError)) {
      throw error
    }

    return {
      valid: false,
      schemaVersion: QUOTATION_FILE_SCHEMA_VERSION,
      issues: [createQuotationFileIssue(error.code)],
    }
  }
}

function createQuotationFileIssue(code: QuotationFileErrorCode): AutomationIssue {
  const issueDetails: Record<QuotationFileErrorCode, { message: string; fieldPath: string }> = {
    invalid_envelope: {
      message: 'The quotation file envelope is invalid.',
      fieldPath: '$',
    },
    unsupported_schema: {
      message: 'The quotation file schema version is not supported.',
      fieldPath: 'schemaVersion',
    },
    missing_quotation: {
      message: 'The quotation payload is missing.',
      fieldPath: 'quotation',
    },
    invalid_quotation: {
      message: 'The quotation payload is invalid.',
      fieldPath: 'quotation',
    },
    unsupported_currency: {
      message: 'The quotation currency is not supported.',
      fieldPath: 'quotation.header.currency',
    },
    not_object: {
      message: 'The quotation content must contain a JSON object.',
      fieldPath: '$',
    },
    invalid_json: {
      message: 'The quotation content is not valid JSON.',
      fieldPath: '$',
    },
  }
  const details = issueDetails[code]

  return {
    code,
    severity: 'error',
    message: details.message,
    fieldPath: details.fieldPath,
  }
}

function createSuccessResult<T>(data: T, revision: number): AutomationResult<T> {
  return {
    ok: true,
    data,
    meta: createMeta(revision),
  }
}

function createFailureResult<T>(
  code: string,
  message: string,
  revision: number,
  cause?: unknown,
  fieldPath?: string,
  details?: Record<string, unknown>,
): AutomationResult<T> {
  return {
    ok: false,
    error: {
      code,
      message,
      ...(fieldPath ? { fieldPath } : {}),
      ...(cause || details
        ? { details: { ...details, ...(cause ? { cause: getErrorMessage(cause) } : {}) } }
        : {}),
    },
    meta: createMeta(revision),
  }
}

function createMeta(revision: number) {
  return {
    requestId: crypto.randomUUID(),
    apiVersion: QUOTATION_AUTOMATION_API_VERSION,
    revision,
    warnings: [],
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}
