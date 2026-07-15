import type { QuotationDraft } from '../types'
import { parseCurrencyCode } from './currencyCodes'
import { normalizeQuotationDraft } from './quotationDraft'

const QUOTATION_FILE_SCHEMA_VERSION = 2
const LEGACY_QUOTATION_FILE_SCHEMA_VERSION = 1
const QUOTATION_FILE_APP = 'quotation-software'

export type QuotationFileErrorCode =
  | 'invalid_envelope'
  | 'unsupported_schema'
  | 'missing_quotation'
  | 'invalid_quotation'
  | 'unsupported_currency'
  | 'not_object'
  | 'invalid_json'

interface QuotationFileEnvelope {
  schemaVersion: number
  app: string
  exportedAt: string
  quotation: QuotationDraft
}

export class QuotationFileError extends Error {
  constructor(public readonly code: QuotationFileErrorCode) {
    super(code)
    this.name = 'QuotationFileError'
  }
}

export function createQuotationFileContent(quotation: QuotationDraft) {
  const envelope: QuotationFileEnvelope = {
    schemaVersion: QUOTATION_FILE_SCHEMA_VERSION,
    app: QUOTATION_FILE_APP,
    exportedAt: new Date().toISOString(),
    quotation,
  }

  return `${JSON.stringify(envelope, null, 2)}\n`
}

export function parseQuotationFileContent(content: string) {
  const parsed = parseJsonObject(content)

  if (!hasValidEnvelopeMetadata(parsed)) {
    throw new QuotationFileError('invalid_envelope')
  }

  const quotation = migrateQuotationFile(parsed)

  if (!isRecord(quotation)) {
    throw new QuotationFileError('missing_quotation')
  }

  const header = quotation.header
  if (!isRecord(header) || !parseCurrencyCode(header.currency)) {
    throw new QuotationFileError('unsupported_currency')
  }

  if (!isQuotationDraftInput(quotation)) {
    throw new QuotationFileError('invalid_quotation')
  }

  try {
    const normalized = normalizeQuotationDraft(quotation, { ensureAtLeastOneItem: false })
    if (!isQuotationDraftInput(normalized)) {
      throw new QuotationFileError('invalid_quotation')
    }

    return normalized
  } catch (error) {
    if (error instanceof QuotationFileError) {
      throw error
    }

    throw new QuotationFileError('invalid_quotation')
  }
}
function parseJsonObject(content: string) {
  try {
    const parsed: unknown = JSON.parse(content)

    if (!isRecord(parsed)) {
      throw new QuotationFileError('not_object')
    }

    return parsed
  } catch (error) {
    if (error instanceof QuotationFileError) {
      throw error
    }

    throw new QuotationFileError('invalid_json')
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasValidEnvelopeMetadata(value: Record<string, unknown>) {
  return (
    value.app === QUOTATION_FILE_APP
    && isIsoDateString(value.exportedAt)
    && typeof value.schemaVersion === 'number'
    && Number.isInteger(value.schemaVersion)
  )
}

function migrateQuotationFile(value: Record<string, unknown>) {
  if (value.schemaVersion === QUOTATION_FILE_SCHEMA_VERSION) {
    return value.quotation
  }

  if (value.schemaVersion === LEGACY_QUOTATION_FILE_SCHEMA_VERSION) {
    return migrateVersionOneQuotation(value.quotation)
  }

  throw new QuotationFileError('unsupported_schema')
}

function migrateVersionOneQuotation(value: unknown) {
  if (!isRecord(value)) {
    return value
  }

  const header = isRecord(value.header)
    ? {
        ...value.header,
        terms: typeof value.header.terms === 'string' ? value.header.terms : '',
      }
    : value.header
  const majorItems = Array.isArray(value.majorItems)
    ? value.majorItems.map(migrateVersionOneQuotationItem)
    : value.majorItems

  return {
    ...value,
    header,
    majorItems,
    lineItemEntryMode: value.lineItemEntryMode === 'quick' ? 'quick' : 'detailed',
    outputSettings: isRecord(value.outputSettings)
      ? value.outputSettings
      : { itemDetailLevel: 3 },
  }
}

function migrateVersionOneQuotationItem(value: unknown): unknown {
  if (!isRecord(value)) {
    return value
  }

  const children = value.children === undefined ? value.subItems : value.children

  return {
    ...value,
    name: value.name === undefined
      ? value.title === undefined
        ? value.description
        : value.title
      : value.name,
    quantityUnit: value.quantityUnit === undefined ? '' : value.quantityUnit,
    children: Array.isArray(children)
      ? children.map(migrateVersionOneQuotationItem)
      : children,
  }
}

function isQuotationDraftInput(value: unknown): value is QuotationDraft {
  if (!isRecord(value)) {
    return false
  }

  return (
    isNonEmptyString(value.id)
    && isRecord(value.header)
    && isValidQuotationHeader(value.header)
    && Array.isArray(value.majorItems)
    && value.majorItems.every(isValidQuotationRootItem)
    && isRecord(value.totalsConfig)
    && isValidTotalsConfig(value.totalsConfig)
    && isRecord(value.exchangeRates)
    && Object.entries(value.exchangeRates).every(([currency, rate]) => Boolean(parseCurrencyCode(currency)) && isFiniteNumber(rate))
    && isRecord(value.branding)
    && typeof value.branding.logoDataUrl === 'string'
    && typeof value.branding.accentColor === 'string'
    && (value.lineItemEntryMode === undefined || value.lineItemEntryMode === 'detailed' || value.lineItemEntryMode === 'quick')
    && (value.outputSettings === undefined || (
      isRecord(value.outputSettings)
      && (
        value.outputSettings.itemDetailLevel === 1
        || value.outputSettings.itemDetailLevel === 2
        || value.outputSettings.itemDetailLevel === 3
      )
    ))
  )
}

function isValidQuotationHeader(value: Record<string, unknown>) {
  return (
    typeof value.quotationNumber === 'string'
    && typeof value.quotationDate === 'string'
    && typeof value.customerCompany === 'string'
    && typeof value.contactPerson === 'string'
    && typeof value.contactDetails === 'string'
    && typeof value.projectName === 'string'
    && typeof value.validityPeriod === 'string'
    && Boolean(parseCurrencyCode(value.currency))
    && typeof value.notes === 'string'
  )
}

function isValidQuotationRootItem(value: unknown): boolean {
  if (!isRecord(value) || !isNonEmptyString(value.id)) {
    return false
  }

  if (value.kind === 'section_header') {
    return typeof value.title === 'string'
  }

  return isValidQuotationItem(value)
}

function isValidQuotationItem(value: unknown): boolean {
  if (!isRecord(value) || !isNonEmptyString(value.id)) {
    return false
  }

  return (
    typeof value.name === 'string'
    && typeof value.description === 'string'
    && isFiniteNumber(value.quantity)
    && typeof value.quantityUnit === 'string'
    && isFiniteNumber(value.unitCost)
    && Boolean(parseCurrencyCode(value.costCurrency))
    && Array.isArray(value.children)
    && value.children.every(isValidQuotationItem)
    && (value.pricingMethod === undefined || value.pricingMethod === 'cost_plus' || value.pricingMethod === 'manual_price')
    && isOptionalFiniteNumber(value.manualUnitPrice)
    && isOptionalFiniteNumber(value.markupRate)
    && isOptionalFiniteNumber(value.expectedTotal)
    && (value.taxClassId === undefined || typeof value.taxClassId === 'string')
    && (value.notes === undefined || typeof value.notes === 'string')
  )
}

function isValidTotalsConfig(value: Record<string, unknown>) {
  return (
    isFiniteNumber(value.globalMarkupRate)
    && isOptionalFiniteNumber(value.taxRate)
    && (value.taxMode === undefined || value.taxMode === 'single' || value.taxMode === 'mixed')
    && (value.defaultTaxClassId === undefined || typeof value.defaultTaxClassId === 'string')
    && (value.extraCharges === undefined || (
      Array.isArray(value.extraCharges)
      && value.extraCharges.every((charge) => isRecord(charge)
        && isNonEmptyString(charge.id)
        && typeof charge.label === 'string'
        && isFiniteNumber(charge.amount))
    ))
    && (value.taxClasses === undefined || (
      Array.isArray(value.taxClasses)
      && value.taxClasses.every((taxClass) => isRecord(taxClass)
        && isNonEmptyString(taxClass.id)
        && typeof taxClass.label === 'string'
        && isFiniteNumber(taxClass.rate))
    ))
  )
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isOptionalFiniteNumber(value: unknown) {
  return value === undefined || isFiniteNumber(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isIsoDateString(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false
  }

  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    return false
  }

  return Number.isNaN(Date.parse(value)) === false && new Date(value).toISOString() === value
}
