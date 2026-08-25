import type { SupportedLocale } from '../i18n/locale.js'
import type {
  MajorItemSummary,
  MixedTaxDocumentColumn,
  QuotationDraft,
  QuotationTemplateId,
  QuotationTotals,
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

export interface QuotationAgentApiV2 {
  getApiInfo(): Promise<QuotationAutomationApiInfo>
  waitUntilReady(): Promise<QuotationAutomationApiInfo>
  getQuotationSnapshot(): Promise<AutomationResult<QuotationAutomationSnapshot>>
  serializeQuotation(): Promise<AutomationResult<SerializedQuotation>>
  validateQuotation(): Promise<AutomationResult<QuotationValidationReport>>
  validateQuotationContent(content: string): Promise<AutomationResult<QuotationValidationReport>>
}
