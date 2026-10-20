import type { QuotationDocument, QuotationDraft, QuotationRevision, QuotationRootItem } from '../types'
import { parseGoodsReceiptDraft } from '@/features/goods-receipts/utils/goodsReceipt'
import { cloneSerializable } from '@/shared/utils/clone'
import { AUTOMATION_LIMITS, getUtf8ByteLength } from '../../../shared/contracts/automationLimits.js'
import { QUOTATION_FILE_SCHEMA_VERSION } from '../../../shared/contracts/quotationSchema.js'
import { isQuotationTemplateId } from '../templates/templateIds'
import { parseCurrencyCode } from './currencyCodes'
import { isQuotationOutputSettings } from './quotationOutputSettings'
import { isMixedTaxDocumentColumn } from './quotationDocumentColumns'
import { normalizeQuotationDraft } from './quotationDraft'

export { QUOTATION_FILE_SCHEMA_VERSION } from '../../../shared/contracts/quotationSchema.js'
const LEGACY_QUOTATION_FILE_SCHEMA_VERSION = 1
const REVISION_QUOTATION_FILE_SCHEMA_VERSION = 3
const IMAGE_QUOTATION_FILE_SCHEMA_VERSION = 4
const QUOTATION_FILE_APP = 'quotation-software'

export type QuotationFileErrorCode =
  | 'invalid_envelope'
  | 'unsupported_schema'
  | 'missing_quotation'
  | 'invalid_quotation'
  | 'unsupported_currency'
  | 'not_object'
  | 'invalid_json'
  | 'duplicate_id'
  | 'duplicate_currency'
  | 'invalid_revisions'
  | 'input_too_large'

interface QuotationFileEnvelope {
  schemaVersion: number
  app: string
  exportedAt: string
  images: Record<string, string>
  quotation: StoredQuotationDraft
  revisions: Array<Omit<QuotationRevision, 'quotation'> & { quotation: StoredQuotationDraft }>
}

type StoredQuotationDraft = Omit<QuotationDraft, 'branding'> & {
  branding: Omit<QuotationDraft['branding'], 'logoDataUrl'> & { logoImageId: string | null }
}

export class QuotationFileError extends Error {
  constructor(
    public readonly code: QuotationFileErrorCode,
    public readonly fieldPath?: string,
  ) {
    super(code)
    this.name = 'QuotationFileError'
  }
}

export function createQuotationFileContent(quotation: QuotationDraft, revisions: readonly QuotationRevision[] = []) {
  const envelope: QuotationFileEnvelope = {
    schemaVersion: QUOTATION_FILE_SCHEMA_VERSION,
    app: QUOTATION_FILE_APP,
    exportedAt: new Date().toISOString(),
    ...createQuotationFileData(quotation, revisions),
  }

  const content = `${JSON.stringify(envelope, null, 2)}\n`
  assertQuotationFileSize(content)
  return content
}

// Shared by file output and change detection; excludes volatile export metadata.
export function createQuotationFileData(quotation: QuotationDraft, revisions: readonly QuotationRevision[]) {
  const images: Record<string, string> = {}
  const imageIds = new Map<string, string>()
  return {
    images,
    quotation: storeQuotationImages(quotation, images, imageIds),
    revisions: revisions.map(revision => ({
      ...revision,
      quotation: storeQuotationImages(revision.quotation, images, imageIds),
    })),
  }
}

function storeQuotationImages(
  quotation: QuotationDraft,
  images: Record<string, string>,
  imageIds: Map<string, string>,
): StoredQuotationDraft {
  const { logoDataUrl, ...branding } = quotation.branding
  let logoImageId: string | null = null
  if (logoDataUrl !== '') {
    logoImageId = imageIds.get(logoDataUrl) ?? `image-${imageIds.size + 1}`
    imageIds.set(logoDataUrl, logoImageId)
    images[logoImageId] = logoDataUrl
  }
  return { ...quotation, branding: { ...branding, logoImageId } }
}

export function parseQuotationFileContent(content: string): QuotationDraft {
  return parseQuotationDocumentContent(content).quotation
}

export function parseQuotationDocumentContent(content: string): QuotationDocument {
  assertQuotationFileSize(content)
  const parsed = parseJsonObject(content)

  if (!hasValidEnvelopeMetadata(parsed)) {
    throw new QuotationFileError('invalid_envelope')
  }

  const migratedQuotation = migrateQuotationFile(parsed)
  const images = parsed.schemaVersion === IMAGE_QUOTATION_FILE_SCHEMA_VERSION
    || parsed.schemaVersion === QUOTATION_FILE_SCHEMA_VERSION
    ? parseQuotationImages(parsed.images)
    : undefined
  const rawQuotation = images ? expandQuotationImages(migratedQuotation, images) : migratedQuotation
  if (parsed.schemaVersion !== QUOTATION_FILE_SCHEMA_VERSION && hasNewTaxAllocationPolicy(rawQuotation)) {
    throw new QuotationFileError('invalid_quotation')
  }
  const rawRevisionNumber = isRecord(rawQuotation) && isRecord(rawQuotation.header)
    ? rawQuotation.header.revisionNumber
    : undefined
  const quotation = parseQuotationDraft(rawQuotation)
  if (parsed.schemaVersion !== REVISION_QUOTATION_FILE_SCHEMA_VERSION
    && parsed.schemaVersion !== IMAGE_QUOTATION_FILE_SCHEMA_VERSION
    && parsed.schemaVersion !== QUOTATION_FILE_SCHEMA_VERSION) {
    return { quotation, revisions: [] }
  }

  if (!isRecord(parsed.quotation)
    || !isRecord(parsed.quotation.header)
    || !isPositiveSafeInteger(rawRevisionNumber)
    || 'revisions' in parsed.quotation
    || !Array.isArray(parsed.revisions)) {
    throw new QuotationFileError('invalid_revisions')
  }

  const revisionIds = new Set<string>()
  const revisionNumbers = new Set<number>()
  const revisions = parsed.revisions.map((value, index): QuotationRevision => {
    try {
      if (!isRecord(value)) throw new QuotationFileError('invalid_revisions')
      const archivedQuotation = images ? expandQuotationImages(value.quotation, images) : value.quotation
      if (parsed.schemaVersion !== QUOTATION_FILE_SCHEMA_VERSION && hasNewTaxAllocationPolicy(archivedQuotation)) {
        throw new QuotationFileError('invalid_revisions')
      }
      if (!isNonEmptyString(value.id)
        || revisionIds.has(value.id)
        || !isPositiveSafeInteger(value.revisionNumber)
        || revisionNumbers.has(value.revisionNumber)
        || value.revisionNumber >= quotation.header.revisionNumber!
        || !isIsoDateString(value.createdAt)
        || (value.note !== undefined && typeof value.note !== 'string')
        || !isRecord(archivedQuotation)
        || archivedQuotation.id !== quotation.id
        || !isRecord(archivedQuotation.header)
        || archivedQuotation.header.revisionNumber !== value.revisionNumber
        || !isValidArchivedQuotation(archivedQuotation)) {
        throw new QuotationFileError('invalid_revisions')
      }

      // Validate on a copy: editable-draft normalization must not rewrite saved history.
      parseQuotationDraft(cloneSerializable(archivedQuotation))
      revisionIds.add(value.id)
      revisionNumbers.add(value.revisionNumber)
      return {
        id: value.id,
        revisionNumber: value.revisionNumber,
        createdAt: value.createdAt,
        ...(value.note === undefined ? {} : { note: value.note }),
        quotation: archivedQuotation,
      }
    } catch (error) {
      if (error instanceof QuotationFileError && error.code === 'duplicate_id' && error.fieldPath) {
        throw new QuotationFileError(
          'duplicate_id',
          `revisions[${index}].quotation.${error.fieldPath ?? 'id'}`,
        )
      }
      throw new QuotationFileError('invalid_revisions')
    }
  })

  return { quotation, revisions }
}

function parseQuotationImages(value: unknown): Record<string, string> {
  if (!isRecord(value) || !Object.entries(value).every(([id, image]) =>
    /^image-[1-9]\d*$/.test(id) && isImageDataUrl(image),
  )) {
    throw new QuotationFileError('invalid_quotation')
  }
  return value as Record<string, string>
}

function isImageDataUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const match = /^data:image\/[a-z0-9.+-]+(;[^,\r\n]*)?,([\s\S]+)$/i.exec(value)
  if (!match) return false
  try {
    if (/;base64$/i.test(match[1] ?? '')) return atob(match[2]!).length > 0
    else decodeURIComponent(match[2]!)
    return true
  } catch {
    return false
  }
}

function expandQuotationImages(value: unknown, images: Record<string, string>): unknown {
  if (!isRecord(value)) return value
  if (!isRecord(value.branding)
    || Object.prototype.hasOwnProperty.call(value.branding, 'logoDataUrl')
    || !Object.prototype.hasOwnProperty.call(value.branding, 'logoImageId')) {
    throw new QuotationFileError('invalid_quotation')
  }
  const { logoImageId, ...branding } = value.branding
  let logoDataUrl = ''
  if (logoImageId !== null) {
    if (typeof logoImageId !== 'string' || !Object.prototype.hasOwnProperty.call(images, logoImageId)) {
      throw new QuotationFileError('invalid_quotation')
    }
    logoDataUrl = images[logoImageId]!
  }
  return { ...value, branding: { ...branding, logoDataUrl } }
}

function assertQuotationFileSize(content: string) {
  if (getUtf8ByteLength(content) > AUTOMATION_LIMITS.quotationJsonBytes) {
    throw new QuotationFileError('input_too_large')
  }
}

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

function isValidArchivedQuotation(value: Record<string, unknown>): value is Record<string, unknown> & QuotationDraft {
  return isQuotationDraftInput(value)
    && !('revisions' in value)
    && isQuotationTemplateId(value.templateId)
    && (value.companyProfileId === null || typeof value.companyProfileId === 'string')
    && isRecord(value.companyProfileSnapshot)
    && typeof value.companyProfileSnapshot.companyName === 'string'
    && typeof value.companyProfileSnapshot.email === 'string'
    && typeof value.companyProfileSnapshot.phone === 'string'
    && (value.header.documentLocale === 'en-US' || value.header.documentLocale === 'zh-CN')
    && (value.header.terms === undefined || typeof value.header.terms === 'string')
    && (value.totalsConfig.mixedTaxColumns === undefined || (
      Array.isArray(value.totalsConfig.mixedTaxColumns)
      && value.totalsConfig.mixedTaxColumns.every(isMixedTaxDocumentColumn)
    ))
    && (value.metadata === undefined || (
      isRecord(value.metadata)
      && isIsoDateString(value.metadata.createdAt)
      && isIsoDateString(value.metadata.updatedAt)
    ))
    && (value.pendingGoodsReceiptDraft === undefined || parseGoodsReceiptDraft(value.pendingGoodsReceiptDraft) !== null)
    && (value.goodsReceiptHistory === undefined || (
      Array.isArray(value.goodsReceiptHistory)
      && value.goodsReceiptHistory.every((record) => isRecord(record)
        && isNonEmptyString(record.id)
        && isIsoDateString(record.exportedAt)
        && typeof record.filePath === 'string'
        && parseGoodsReceiptDraft(record.draft) !== null)
    ))
}

function parseQuotationDraft(quotation: unknown): QuotationDraft {

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

  const itemIds = new Set<string>()
  function checkItemIds(items: QuotationRootItem[]) {
    for (const item of items) {
      if (itemIds.has(item.id)) throw new QuotationFileError('duplicate_id')
      itemIds.add(item.id)
      if ('children' in item) checkItemIds(item.children)
    }
  }
  checkItemIds(quotation.majorItems)
  const currencyCodes = Object.keys(quotation.exchangeRates).map(parseCurrencyCode)
  if (new Set(currencyCodes).size !== currencyCodes.length) {
    throw new QuotationFileError('duplicate_currency')
  }

  try {
    const normalized = normalizeQuotationDraft(quotation, { ensureAtLeastOneItem: false })
    if (!isQuotationDraftInput(normalized)) {
      throw new QuotationFileError('invalid_quotation')
    }
    assertUniqueConfigurationIds(normalized)

    return normalized
  } catch (error) {
    if (error instanceof QuotationFileError) {
      throw error
    }

    throw new QuotationFileError('invalid_quotation')
  }
}

function assertUniqueConfigurationIds(quotation: QuotationDraft) {
  assertUniqueIds(quotation.totalsConfig.taxClasses ?? [], 'totalsConfig.taxClasses')
  assertUniqueIds(quotation.totalsConfig.extraCharges ?? [], 'totalsConfig.extraCharges')
  assertUniqueIds(quotation.outputSettings?.informationalTotals ?? [], 'outputSettings.informationalTotals')
}

function assertUniqueIds(records: Array<{ id: string }>, path: string) {
  const ids = new Set<string>()

  records.forEach((record, index) => {
    if (ids.has(record.id)) {
      throw new QuotationFileError('duplicate_id', `${path}[${index}].id`)
    }
    ids.add(record.id)
  })
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
  if (value.schemaVersion === QUOTATION_FILE_SCHEMA_VERSION
    || value.schemaVersion === IMAGE_QUOTATION_FILE_SCHEMA_VERSION
    || value.schemaVersion === REVISION_QUOTATION_FILE_SCHEMA_VERSION
    || value.schemaVersion === 2) {
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
    && (value.outputSettings === undefined || isQuotationOutputSettings(value.outputSettings))
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
    && (value.taxAllocationVersion === undefined || value.taxAllocationVersion === 1 || value.taxAllocationVersion === 2)
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

function hasNewTaxAllocationPolicy(value: unknown) {
  return isRecord(value) && isRecord(value.totalsConfig) && value.totalsConfig.taxAllocationVersion === 2
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
