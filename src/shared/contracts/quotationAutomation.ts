import type { SupportedLocale } from '../i18n/locale.js'
import type {
  MajorItemSummary,
  LineItemEntryMode,
  ExchangeRateTable,
  MixedTaxDocumentColumn,
  QuotationDraft,
  QuotationExtraCharge,
  QuotationHeader,
  QuotationItem,
  QuotationOutputSettings,
  QuotationRootItem,
  QuotationSectionHeader,
  QuotationTemplateId,
  QuotationTotals,
  PricingMethod,
  TaxClass,
  TaxMode,
} from '../../features/quotations/types.js'

export const QUOTATION_AUTOMATION_API_VERSION = '2.0.0'

export type QuotationAutomationHost = 'desktop-ui' | 'web-ui' | 'headless'

export interface QuotationAutomationCapabilities {
  host: QuotationAutomationHost
  pathImport: boolean
  pathExport: boolean
  directPdfExport: boolean
  browserPrint: boolean
  exchangeRateRefresh: boolean
  goodsReceipt: boolean
  batchOperations: boolean
}

export interface QuotationAutomationApiInfo {
  apiVersion: string
  appVersion: string
  quotationSchemaVersion: number
  capabilities: QuotationAutomationCapabilities
  supportedTemplates: QuotationTemplateId[]
  supportedLocales: SupportedLocale[]
  supportedTaxModes: TaxMode[]
  supportedMixedTaxColumns: MixedTaxDocumentColumn[]
}

export interface AutomationIssue {
  code: string
  severity: 'warning' | 'error'
  message: string
  fieldPath?: string
  row?: number
  column?: string
  details?: Record<string, unknown>
}

export interface AutomationMeta {
  requestId: string
  apiVersion: string
  revision: number
  warnings: AutomationIssue[]
}

export type AutomationResult<T> =
  | {
      ok: true
      data: T
      meta: AutomationMeta
    }
  | {
      ok: false
      error: {
        code: string
        message: string
        fieldPath?: string
        details?: Record<string, unknown>
      }
      meta: AutomationMeta
    }

export interface QuotationAutomationSnapshot {
  schemaVersion: number
  revision: number
  currentFilePath: string
  quotation: QuotationDraft
  itemSummaries: MajorItemSummary[]
  totals: QuotationTotals
}

export interface SerializedQuotation {
  schemaVersion: number
  quotation: QuotationDraft
  content: string
  revision: number
}

export interface QuotationValidationReport {
  valid: boolean
  schemaVersion: number
  issues: AutomationIssue[]
}

export interface CreateQuotationInput {
  header?: Partial<QuotationHeader>
  templateId?: QuotationTemplateId
  branding?: Partial<QuotationDraft['branding']>
  lineItemEntryMode?: LineItemEntryMode
  outputSettings?: Partial<QuotationOutputSettings>
}

export type QuotationBrandingPatch = Partial<QuotationDraft['branding']>
export type QuotationOutputSettingsPatch = Partial<QuotationOutputSettings>
export type NewQuotationItem = Partial<Omit<QuotationItem, 'id' | 'children'>>
export type QuotationItemPatch = Partial<Omit<QuotationItem, 'id' | 'children'>>

export interface AddLineItemInput {
  parentId?: string | null
  index?: number
  item?: NewQuotationItem
}

export interface AddSectionHeaderInput {
  index?: number
  title: string
}

export interface MoveItemTarget {
  parentId: string | null
  index: number
}

export interface NewTaxClass {
  label: string
  rate: number
}

export type TaxClassPatch = Partial<Pick<TaxClass, 'label' | 'rate'>>

export interface NewExtraCharge {
  label: string
  amount: number
}

export type ExtraChargePatch = Partial<Pick<QuotationExtraCharge, 'label' | 'amount'>>

export interface ExchangeRateRefreshResult {
  rates: ExchangeRateTable
  date: string
  missingCurrencies: string[]
}

export interface ItemGoalSeekInput {
  itemId: string
  targetUnitPriceBeforeTax: number
}

export type ItemGoalSeekResult =
  | {
      ok: true
      markupRate: number
      targetUnitPrice: number
      projectedUnitPrice: number
      convertedUnitCost: number
      minimumTarget: number
      maximumTarget: number
    }
  | {
      ok: false
      reason: 'ineligible_item' | 'invalid_unit_cost' | 'target_below_minimum' | 'target_above_maximum'
      convertedUnitCost?: number
      minimumTarget?: number
      maximumTarget?: number
    }

export type QuotationGoalSeekTarget = 'subtotal_before_tax' | 'total_after_tax' | 'quotation_total'

export type QuotationGoalSeekResult =
  | {
      ok: true
      markupRate: number
      targetAmount: number
      projectedAmount: number
      fixedSubtotal: number
      adjustableBaseSubtotal: number
      minimumAmount: number
      maximumAmount: number
    }
  | {
      ok: false
      reason: 'no_adjustable_items' | 'target_below_minimum' | 'target_above_maximum' | 'target_unreachable'
      fixedSubtotal?: number
      adjustableBaseSubtotal?: number
      minimumAmount?: number
      maximumAmount?: number
      targetAmount?: number
      closestMarkupRate?: number
      closestAmount?: number
    }

export interface QuotationGoalSeekInput {
  target: QuotationGoalSeekTarget
  targetAmount: number
}

export type QuotationOperation =
  | { type: 'updateHeader'; patch: Partial<Omit<QuotationHeader, 'currency'>> }
  | { type: 'setTemplate'; templateId: QuotationTemplateId }
  | { type: 'setBranding'; patch: QuotationBrandingPatch }
  | { type: 'setLineItemEntryMode'; mode: LineItemEntryMode }
  | { type: 'setOutputSettings'; patch: QuotationOutputSettingsPatch }
  | { type: 'addLineItem'; input?: AddLineItemInput }
  | { type: 'addSectionHeader'; input: AddSectionHeaderInput }
  | { type: 'updateLineItem'; itemId: string; patch: QuotationItemPatch }
  | { type: 'updateSectionHeader'; itemId: string; patch: { title: string } }
  | { type: 'removeItem'; itemId: string }
  | { type: 'duplicateItem'; itemId: string }
  | { type: 'moveItem'; itemId: string; target: MoveItemTarget }
  | { type: 'setGlobalMarkupRate'; rate: number }
  | { type: 'updateExchangeRate'; currency: string; rate: number }
  | { type: 'setTaxMode'; mode: TaxMode; taxClassId?: string }
  | { type: 'setMixedTaxDocumentColumns'; columns: MixedTaxDocumentColumn[] }
  | { type: 'addTaxClass'; input: NewTaxClass }
  | { type: 'updateTaxClass'; id: string; patch: TaxClassPatch }
  | { type: 'removeTaxClass'; id: string }
  | { type: 'setDefaultTaxClass'; id: string }
  | { type: 'assignItemTaxClass'; itemId: string; taxClassId: string }
  | { type: 'addExtraCharge'; input: NewExtraCharge }
  | { type: 'updateExtraCharge'; id: string; patch: ExtraChargePatch }
  | { type: 'removeExtraCharge'; id: string }
  | { type: 'applyItemGoalSeek'; input: ItemGoalSeekInput }
  | { type: 'applyQuotationGoalSeek'; input: QuotationGoalSeekInput }

export interface ApplyOperationsRequest {
  expectedRevision?: number
  operations: QuotationOperation[]
}

export interface OperationResult {
  index: number
  type: QuotationOperation['type']
  data?: Record<string, unknown>
}

export interface ApplyOperationsResult {
  revision: number
  operationResults: OperationResult[]
  snapshot: QuotationAutomationSnapshot
}

export interface QuotationAgentApiV2 {
  getApiInfo(): Promise<QuotationAutomationApiInfo>
  waitUntilReady(): Promise<QuotationAutomationApiInfo>
  createQuotation(input?: CreateQuotationInput): Promise<AutomationResult<QuotationAutomationSnapshot>>
  updateHeader(patch: Partial<QuotationHeader>): Promise<AutomationResult<QuotationHeader>>
  setTemplate(templateId: QuotationTemplateId): Promise<AutomationResult<{ templateId: QuotationTemplateId }>>
  setDocumentLocale(locale: SupportedLocale): Promise<AutomationResult<{ documentLocale: SupportedLocale }>>
  setBranding(patch: QuotationBrandingPatch): Promise<AutomationResult<QuotationDraft['branding']>>
  setLineItemEntryMode(mode: LineItemEntryMode): Promise<AutomationResult<{ mode: LineItemEntryMode }>>
  setOutputSettings(patch: QuotationOutputSettingsPatch): Promise<AutomationResult<QuotationOutputSettings>>
  addLineItem(input?: AddLineItemInput): Promise<AutomationResult<{ itemId: string }>>
  addSectionHeader(input: AddSectionHeaderInput): Promise<AutomationResult<{ itemId: string }>>
  getItem(itemId: string): Promise<AutomationResult<QuotationRootItem>>
  getItemTree(): Promise<AutomationResult<QuotationRootItem[]>>
  updateLineItem(itemId: string, patch: QuotationItemPatch): Promise<AutomationResult<QuotationItem>>
  updateSectionHeader(itemId: string, patch: { title: string }): Promise<AutomationResult<QuotationSectionHeader>>
  removeItem(itemId: string): Promise<AutomationResult<{ itemId: string }>>
  duplicateItem(itemId: string): Promise<AutomationResult<{ itemId: string }>>
  moveItem(itemId: string, target: MoveItemTarget): Promise<AutomationResult<MoveItemTarget & { itemId: string }>>
  setGlobalMarkupRate(rate: number): Promise<AutomationResult<{ rate: number }>>
  setItemPricingMethod(itemId: string, method: PricingMethod): Promise<AutomationResult<{ itemId: string; method: PricingMethod }>>
  updateExchangeRate(currency: string, rate: number): Promise<AutomationResult<{ currency: string; rate: number }>>
  addExchangeRate(currency: string, rate?: number): Promise<AutomationResult<{ currency: string; rate: number }>>
  removeExchangeRate(currency: string): Promise<AutomationResult<{ currency: string }>>
  setQuotationCurrency(currency: string, rates?: ExchangeRateTable): Promise<AutomationResult<{ currency: string; ratesToQuotationCurrency: ExchangeRateTable }>>
  refreshExchangeRates(): Promise<AutomationResult<ExchangeRateRefreshResult>>
  setTaxMode(mode: TaxMode, taxClassId?: string): Promise<AutomationResult<{ mode: TaxMode }>>
  setMixedTaxDocumentColumns(columns: MixedTaxDocumentColumn[]): Promise<AutomationResult<{ columns: MixedTaxDocumentColumn[] }>>
  addTaxClass(input: NewTaxClass): Promise<AutomationResult<{ taxClassId: string }>>
  updateTaxClass(id: string, patch: TaxClassPatch): Promise<AutomationResult<TaxClass>>
  removeTaxClass(id: string): Promise<AutomationResult<{ taxClassId: string }>>
  setDefaultTaxClass(id: string): Promise<AutomationResult<{ taxClassId: string }>>
  assignItemTaxClass(itemId: string, taxClassId: string): Promise<AutomationResult<{ itemId: string; taxClassId: string }>>
  addExtraCharge(input: NewExtraCharge): Promise<AutomationResult<{ extraChargeId: string }>>
  updateExtraCharge(id: string, patch: ExtraChargePatch): Promise<AutomationResult<QuotationExtraCharge>>
  removeExtraCharge(id: string): Promise<AutomationResult<{ extraChargeId: string }>>
  previewItemGoalSeek(input: ItemGoalSeekInput): Promise<AutomationResult<ItemGoalSeekResult>>
  applyItemGoalSeek(input: ItemGoalSeekInput): Promise<AutomationResult<ItemGoalSeekResult>>
  previewQuotationGoalSeek(input: QuotationGoalSeekInput): Promise<AutomationResult<QuotationGoalSeekResult>>
  applyQuotationGoalSeek(input: QuotationGoalSeekInput): Promise<AutomationResult<QuotationGoalSeekResult>>
  applyOperations(request: ApplyOperationsRequest): Promise<AutomationResult<ApplyOperationsResult>>
  getQuotationSnapshot(): Promise<AutomationResult<QuotationAutomationSnapshot>>
  serializeQuotation(): Promise<AutomationResult<SerializedQuotation>>
  validateQuotation(): Promise<AutomationResult<QuotationValidationReport>>
  validateQuotationContent(content: string): Promise<AutomationResult<QuotationValidationReport>>
}
