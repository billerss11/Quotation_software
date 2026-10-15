import { reactive } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import { createGoodsReceiptDraft } from '@/features/goods-receipts/utils/goodsReceipt'
import { AUTOMATION_LIMITS, getUtf8ByteLength } from '@/shared/contracts/automationLimits'
import type { QuotationDraft, QuotationItem, QuotationRevision } from '../types'
import { DEFAULT_MIXED_TAX_DOCUMENT_COLUMNS } from './quotationDocumentColumns'
import { createQuotationFileContent, parseQuotationDocumentContent, parseQuotationFileContent, QuotationFileError } from './quotationFile'
import { calculateQuotationTotals } from './quotationCalculations'
import { proposeQuotationRevision } from './quotationRevisions'

const LOGO_A = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg=='
const LOGO_B = LOGO_A.replace('image/png', 'IMAGE/PNG')

describe('quotation file JSON', () => {
  it('preserves optional summary display settings through draft and revision round trips', () => {
    const quotation = createQuotation()
    quotation.header.revisionNumber = 2
    quotation.outputSettings = {
      itemDetailLevel: 1, subtotalLabel: ' Materials subtotal ', showInformationalTotals: true,
      informationalTotalsNote: ' Already included\nin the materials subtotal. ',
      informationalTotals: [{ id: 'equipment-total', label: ' Equipment ', sectionIds: ['missing-section'], source: 'items', itemIds: ['missing-item'], visible: false }],
    }
    const archived = JSON.parse(JSON.stringify(quotation)) as QuotationDraft
    archived.header.revisionNumber = 1
    archived.outputSettings!.informationalTotalsNote = ''
    const revisions: QuotationRevision[] = [{ id: 'rev1', revisionNumber: 1, createdAt: '2026-10-15T00:00:00.000Z', quotation: archived }]
    const parsed = parseQuotationDocumentContent(createQuotationFileContent(quotation, revisions))

    expect(parsed.quotation.outputSettings).toEqual(quotation.outputSettings)
    expect(parsed.revisions[0]!.quotation.outputSettings).toEqual(archived.outputSettings)
  })

  it.each([
    { subtotalLabel: 10 },
    { showInformationalTotals: 'true' },
    { informationalTotalsNote: null },
    { informationalTotalsNote: false },
    { informationalTotals: [{ id: 'row', label: 'Equipment', sectionIds: ['equipment'], visible: 'true' }] },
    { informationalTotals: [{ id: 'row', label: 'Equipment', sectionIds: [null], visible: true }] },
    { informationalTotals: [{ id: 'row', label: 'Equipment', sectionIds: [], source: 'unknown', visible: true }] },
    { informationalTotals: [{ id: 'row', label: 'Equipment', sectionIds: [], source: 'items', itemIds: [null], visible: true }] },
  ])('rejects malformed summary display settings: %j', (invalidSettings) => {
    const quotation = createQuotation()
    quotation.outputSettings = { itemDetailLevel: 3, ...invalidSettings } as unknown as QuotationDraft['outputSettings']
    expect(() => parseQuotationFileContent(createQuotationFileContent(quotation))).toThrowError('invalid_quotation')
  })

  it('rejects duplicate informational row IDs with their configuration path', () => {
    const quotation = createQuotation()
    quotation.outputSettings = {
      itemDetailLevel: 3, informationalTotals: [
        { id: 'duplicate', label: 'Equipment', sectionIds: [], visible: true },
        { id: 'duplicate', label: 'Piping', sectionIds: [], visible: false },
      ],
    }
    try {
      parseQuotationFileContent(createQuotationFileContent(quotation))
      throw new Error('Expected duplicate row IDs to fail.')
    } catch (error) {
      expect(error).toMatchObject({ code: 'duplicate_id', fieldPath: 'outputSettings.informationalTotals[1].id' })
    }
  })

  it('uses the supplied rate when imported currency codes have different casing', () => {
    const quotation = createQuotation()
    quotation.majorItems = [createQuotationItem({ unitCost: 100, costCurrency: 'eur', markupRate: 0 })]
    quotation.exchangeRates = { USD: 1, eur: 0.9 }
    const imported = parseQuotationFileContent(createQuotationFileContent(quotation))
    expect(imported.exchangeRates).toEqual({ USD: 1, EUR: 0.9 })
    expect(calculateQuotationTotals(imported.majorItems, imported.totalsConfig, imported.exchangeRates).grandTotal).toBe(90)
  })

  it.each([false, true])('rejects duplicate item IDs, including nested IDs (nested: %s)', (nested) => {
    const quotation = createQuotation()
    const duplicate = createQuotationItem({ id: 'duplicate', unitCost: 200 })
    quotation.majorItems = [createQuotationItem({
      id: 'duplicate', unitCost: 100, children: nested ? [duplicate] : [],
    }), ...(nested ? [] : [duplicate])]
    expect(() => parseQuotationFileContent(createQuotationFileContent(quotation))).toThrowError('duplicate_id')
  })

  it('rejects ambiguous currency keys instead of choosing a rate silently', () => {
    const quotation = createQuotation()
    quotation.exchangeRates = { USD: 1, EUR: 1.08, eur: 0.9 }
    expect(() => parseQuotationFileContent(createQuotationFileContent(quotation))).toThrowError('duplicate_currency')
  })

  it('rejects tax-class identifiers that collide after normalization', () => {
    const quotation = createQuotation()
    quotation.totalsConfig.taxClasses = [
      { id: 'vat', label: 'VAT 5%', rate: 5 },
      { id: ' vat ', label: 'VAT 20%', rate: 20 },
    ]
    quotation.totalsConfig.defaultTaxClassId = 'vat'

    expect(() => parseQuotationFileContent(createQuotationFileContent(quotation))).toThrowError(QuotationFileError)
  })

  it('allows the same identifier in separate item, tax, and extra-charge namespaces', () => {
    const quotation = createQuotation()
    quotation.majorItems = [createQuotationItem({ id: 'shared', taxClassId: 'shared' })]
    quotation.totalsConfig.taxClasses = [{ id: 'shared', label: 'VAT', rate: 5 }]
    quotation.totalsConfig.defaultTaxClassId = 'shared'
    quotation.totalsConfig.extraCharges = [{ id: 'shared', label: 'Delivery', amount: 10 }]

    const imported = parseQuotationFileContent(createQuotationFileContent(quotation))
    expect(imported.majorItems[0]?.id).toBe('shared')
    expect(imported.totalsConfig.taxClasses?.[0]?.id).toBe('shared')
    expect(imported.totalsConfig.extraCharges?.[0]?.id).toBe('shared')
  })

  it('serializes a quotation draft with a schema envelope', () => {
    const quotation = createQuotation()
    const parsed = JSON.parse(createQuotationFileContent(quotation))

    expect(parsed).toMatchObject({
      schemaVersion: 4,
      app: 'quotation-software',
      images: {},
      quotation: { ...quotation, branding: { accentColor: quotation.branding.accentColor, logoImageId: null } },
      revisions: [],
    })
    expect(parsed.quotation.branding).not.toHaveProperty('logoDataUrl')
    expect(typeof parsed.exportedAt).toBe('string')
  })

  it('parses a valid quotation file', () => {
    const quotation = createQuotation()
    const content = createQuotationFileContent(quotation)

    expect(parseQuotationFileContent(content)).toEqual(quotation)
  })

  it('accepts and removes the legacy quotation-level entry mode', () => {
    const envelope = JSON.parse(createQuotationFileContent(createQuotation())) as {
      quotation: Record<string, unknown>
    }
    envelope.quotation.lineItemEntryMode = 'quick'

    const imported = parseQuotationFileContent(JSON.stringify(envelope))
    const exported = JSON.parse(createQuotationFileContent(imported)) as {
      quotation: Record<string, unknown>
    }

    expect(imported).not.toHaveProperty('lineItemEntryMode')
    expect(exported.quotation).not.toHaveProperty('lineItemEntryMode')
  })

  it('roundtrips an imported pending goods receipt with included and excluded items', () => {
    const quotation = createQuotation()
    quotation.majorItems = [
      createQuotationItem({ id: 'pump', name: 'Pump' }),
      createQuotationItem({ id: 'motor', name: 'Motor' }),
    ]
    const pendingDraft = createGoodsReceiptDraft(quotation, { documentDate: '2026-04-24' })
    pendingDraft.customerReference = 'PO-12345'
    pendingDraft.lines[0].selected = true
    pendingDraft.lines[1].selected = false
    quotation.pendingGoodsReceiptDraft = pendingDraft

    const imported = parseQuotationFileContent(createQuotationFileContent(quotation))

    expect(imported.pendingGoodsReceiptDraft).toMatchObject({
      customerReference: 'PO-12345',
      lines: [
        expect.objectContaining({ sourceItemId: 'pump', selected: true }),
        expect.objectContaining({ sourceItemId: 'motor', selected: false }),
      ],
    })
  })

  it('roundtrips quotation tax classes and item tax assignments', () => {
    const quotation = createQuotation()
    quotation.totalsConfig = {
      globalMarkupRate: 10,
      extraCharges: [],
      taxMode: 'mixed',
      taxClasses: [
        { id: 'tax-0', label: '0%', rate: 0 },
        { id: 'tax-goods', label: 'Goods 13%', rate: 13 },
        { id: 'tax-service', label: 'Service 6%', rate: 6 },
      ],
      defaultTaxClassId: 'tax-0',
      mixedTaxColumns: [...DEFAULT_MIXED_TAX_DOCUMENT_COLUMNS],
    }
    quotation.majorItems = [
      createQuotationItem({
        id: 'major-1',
        name: 'Equipment',
        description: '',
        quantity: 1,
        quantityUnit: 'EA',
        unitCost: 0,
        costCurrency: 'USD',
        taxClassId: 'tax-goods',
        notes: '',
        children: [
          createQuotationItem({
            id: 'leaf-1',
            name: 'Commissioning',
            description: '',
            quantity: 1,
            quantityUnit: 'EA',
            unitCost: 200,
            costCurrency: 'USD',
            taxClassId: 'tax-service',
            notes: '',
            children: [],
          }),
        ],
      }),
    ]

    const content = createQuotationFileContent(quotation)

    expect(parseQuotationFileContent(content)).toEqual(quotation)
  })

  it('forces imported quotations with multiple effective tax classes into mixed mode', () => {
    const quotation = createQuotation()
    quotation.totalsConfig = {
      globalMarkupRate: 10,
      extraCharges: [],
      taxMode: 'single',
      taxClasses: [
        { id: 'tax-goods', label: 'Goods 13%', rate: 13 },
        { id: 'tax-service', label: 'Service 6%', rate: 6 },
      ],
      defaultTaxClassId: 'tax-goods',
    }
    quotation.majorItems = [
      createQuotationItem({
        id: 'major-1',
        name: 'Bundle',
        description: '',
        quantity: 1,
        quantityUnit: 'EA',
        unitCost: 0,
        costCurrency: 'USD',
        taxClassId: 'tax-goods',
        notes: '',
        children: [
          createQuotationItem({
            id: 'leaf-1',
            name: 'Goods',
            description: '',
            quantity: 1,
            quantityUnit: 'EA',
            unitCost: 100,
            costCurrency: 'USD',
            notes: '',
            children: [],
          }),
          createQuotationItem({
            id: 'leaf-2',
            name: 'Service',
            description: '',
            quantity: 1,
            quantityUnit: 'EA',
            unitCost: 100,
            costCurrency: 'USD',
            taxClassId: 'tax-service',
            notes: '',
            children: [],
          }),
        ],
      }),
    ]

    const content = createQuotationFileContent(quotation)

    expect(parseQuotationFileContent(content).totalsConfig.taxMode).toBe('mixed')
  })

  it('migrates version 1 files and defaults missing documentLocale to English', () => {
    const quotation = createQuotation()
    const content = JSON.stringify({
      schemaVersion: 1,
      app: 'quotation-software',
      exportedAt: '2026-04-24T08:00:00.000Z',
      quotation: {
        ...quotation,
        header: {
          ...quotation.header,
          documentLocale: undefined,
        },
      },
    })

    expect(parseQuotationFileContent(content).header.documentLocale).toBe('en-US')
  })

  it('migrates historical version 1 major and sub-item shapes', () => {
    const content = JSON.stringify({
      schemaVersion: 1,
      app: 'quotation-software',
      exportedAt: '2026-04-24T08:00:00.000Z',
      quotation: {
        id: 'quote-v1',
        header: {
          quotationNumber: 'Q-2026-001',
          quotationDate: '2026-04-23',
          customerName: 'Alex Buyer',
          customerCompany: 'Acme Industrial',
          contactPerson: 'Alex Buyer',
          contactDetails: 'alex@example.com',
          projectName: 'Valve supply',
          validityPeriod: '30 days',
          currency: 'USD',
          notes: '',
        },
        majorItems: [{
          id: 'major-1',
          type: 'major',
          title: 'Equipment',
          description: 'Equipment bundle',
          quantity: 1,
          unitCost: 0,
          costCurrency: 'USD',
          subItems: [{
            id: 'sub-1',
            type: 'sub',
            description: 'Pump',
            quantity: 2,
            unitCost: 100,
            costCurrency: 'USD',
            children: [],
          }],
        }],
        totalsConfig: {
          globalMarkupRate: 10,
          discountMode: 'percentage',
          discountValue: 0,
          taxRate: 0,
        },
        exchangeRates: {
          USD: 1,
          EUR: 1.08,
          CNY: 0.14,
          GBP: 1.25,
        },
        branding: {
          logoDataUrl: '',
          accentColor: '#0f766e',
        },
      },
    })

    const quotation = parseQuotationFileContent(content)

    expect(quotation.majorItems[0]).toMatchObject({
      id: 'major-1',
      name: 'Equipment',
      quantityUnit: '',
      children: [{
        id: 'sub-1',
        name: 'Pump',
        quantityUnit: '',
        children: [],
      }],
    })
  })

  it('does not remap customerName into contactPerson when parsing quotation files', () => {
    const content = JSON.stringify({
      schemaVersion: 1,
      app: 'quotation-software',
      exportedAt: '2026-04-24T08:00:00.000Z',
      quotation: {
        ...createQuotation(),
        header: {
          ...createQuotation().header,
          customerName: 'Alex Buyer',
          contactPerson: '',
        },
      },
    })

    expect(parseQuotationFileContent(content).header.contactPerson).toBe('')
  })

  it('rejects JSON without quotation data', () => {
    expect(() => parseQuotationFileContent('{"schemaVersion":1}')).toThrowError(QuotationFileError)

    try {
      parseQuotationFileContent('{"schemaVersion":1}')
    } catch (error) {
      expect(error).toBeInstanceOf(QuotationFileError)
      expect((error as QuotationFileError).code).toBe('invalid_envelope')
    }
  })

  it('rejects quotation files with an invalid schema envelope', () => {
    const content = JSON.stringify({
      schemaVersion: 999,
      app: 'quotation-software',
      exportedAt: '2026-04-24T08:00:00.000Z',
      quotation: createQuotation(),
    })

    expect(() => parseQuotationFileContent(content)).toThrowError(QuotationFileError)

    try {
      parseQuotationFileContent(content)
    } catch (error) {
      expect(error).toBeInstanceOf(QuotationFileError)
      expect((error as QuotationFileError).code).toBe('unsupported_schema')
    }
  })

  it('rejects malformed nested quotation items with a stable error code', () => {
    const quotation = createQuotation()
    const content = JSON.stringify({
      schemaVersion: 2,
      app: 'quotation-software',
      exportedAt: '2026-04-24T08:00:00.000Z',
      quotation: {
        ...quotation,
        majorItems: [{ id: 'broken-item', name: 'Broken', children: [{}] }],
      },
    })

    try {
      parseQuotationFileContent(content)
      throw new Error('expected malformed quotation to be rejected')
    } catch (error) {
      expect(error).toBeInstanceOf(QuotationFileError)
      expect((error as QuotationFileError).code).toBe('invalid_quotation')
    }
  })

  it('parses a quotation file with a supported dynamic quotation currency', () => {
    const quotation = createQuotation()
    const content = createQuotationFileContent({
      ...quotation,
      header: {
        ...quotation.header,
        currency: 'JPY',
      },
      exchangeRates: {
        JPY: 1,
        USD: 149.2537313433,
      },
    })

    expect(parseQuotationFileContent(content).header.currency).toBe('JPY')
  })

  it('rejects a quotation file with an invalid quotation currency', () => {
    const quotation = createQuotation()
    const content = createQuotationFileContent({
      ...quotation,
      header: {
        ...quotation.header,
        currency: 'ZZZ',
      },
    })

    expect(() => parseQuotationFileContent(content)).toThrowError(QuotationFileError)
  })

  it('serializes a reactive quotation draft without throwing', () => {
    const quotation = reactive(createQuotation())

    expect(() => createQuotationFileContent(quotation)).not.toThrow()
  })

  it('serializes quotation files without an internal JSON parse round-trip', () => {
    const parseSpy = vi.spyOn(JSON, 'parse')

    createQuotationFileContent(createQuotation())

    expect(parseSpy).not.toHaveBeenCalled()
    parseSpy.mockRestore()
  })
})

describe('quotation revision documents', () => {
  function createRevision(revisionNumber = 1): QuotationRevision {
    return {
      id: `revision-${revisionNumber}`,
      revisionNumber,
      createdAt: '2026-04-24T00:00:00.000Z',
      note: 'Issued to customer',
      quotation: createQuotation({ revisionNumber }),
    }
  }

  function createEnvelope() {
    return JSON.parse(createQuotationFileContent(createQuotation({ revisionNumber: 3 }), [createRevision(1), createRevision(2)]))
  }

  it('roundtrips active content and complete archived snapshots separately', () => {
    const quotation = createQuotation({ revisionNumber: 2, projectName: 'Updated project' })
    const revision = createRevision()
    revision.quotation.pendingGoodsReceiptDraft = createGoodsReceiptDraft(revision.quotation, { documentDate: '2026-04-24' })
    const content = createQuotationFileContent(quotation, [revision])

    expect(parseQuotationDocumentContent(content)).toEqual({ quotation, revisions: [revision] })
    expect(parseQuotationFileContent(content)).toEqual(quotation)
    expect(JSON.parse(content).quotation).not.toHaveProperty('revisions')
  })

  it('rejects duplicate extra-charge identifiers in archived snapshots', () => {
    const quotation = createQuotation({ revisionNumber: 2 })
    const archived = createQuotation({ revisionNumber: 1 })
    archived.totalsConfig.extraCharges = [
      { id: 'shipping', label: 'Shipping', amount: 5 },
      { id: ' shipping ', label: 'Express shipping', amount: 20 },
    ]
    const revision: QuotationRevision = {
      id: 'revision-1',
      revisionNumber: 1,
      createdAt: '2026-04-24T00:00:00.000Z',
      quotation: archived,
    }

    expect(() => parseQuotationDocumentContent(createQuotationFileContent(quotation, [revision])))
      .toThrowError(QuotationFileError)
  })

  it('preserves archived blank fields and whitespace when reopening and saving again', () => {
    const revision = createRevision()
    revision.quotation.majorItems = [
      createQuotationItem({ name: '', description: '  Custom detail  ', notes: '  Issued note  ' }),
      { id: 'section-1', kind: 'section_header', title: '' },
    ]
    revision.quotation.companyProfileSnapshot.companyName = '  CX  Engineering  '
    revision.quotation.totalsConfig.taxClasses![0]!.label = ''
    const content = createQuotationFileContent(createQuotation({ revisionNumber: 2 }), [revision])
    const expectedArchive = JSON.parse(JSON.stringify(revision))

    const reopened = parseQuotationDocumentContent(content)
    const savedAgain = JSON.parse(createQuotationFileContent(reopened.quotation, reopened.revisions))

    expect(reopened.revisions[0]).toEqual(expectedArchive)
    expect(savedAgain.revisions[0].quotation.branding).toEqual({ logoImageId: null, accentColor: revision.quotation.branding.accentColor })
    expect(parseQuotationDocumentContent(JSON.stringify(savedAgain)).revisions[0]).toEqual(expectedArchive)
  })

  it.each([1, 2])('loads version %s with no revision history', (schemaVersion) => {
    const envelope = {
      schemaVersion,
      app: 'quotation-software',
      exportedAt: '2026-04-24T00:00:00.000Z',
      quotation: createQuotation(),
    }
    delete envelope.quotation.header.revisionNumber

    const document = parseQuotationDocumentContent(JSON.stringify(envelope))

    expect(document.revisions).toEqual([])
    expect(document.quotation.header.revisionNumber).toBe(1)
  })

  it('stores exact duplicate logos once across the working copy and every archive', () => {
    const quotation = createQuotation({ revisionNumber: 3 })
    const revisions = [createRevision(1), createRevision(2)]
    for (const draft of [quotation, ...revisions.map(revision => revision.quotation)]) draft.branding.logoDataUrl = LOGO_A
    const before = JSON.stringify({ quotation, revisions })

    const content = createQuotationFileContent(quotation, revisions)
    const stored = JSON.parse(content)

    expect(stored.images).toEqual({ 'image-1': LOGO_A })
    expect(content.match(/data:image\/png;base64,/g)).toHaveLength(1)
    for (const draft of [stored.quotation, ...stored.revisions.map((revision: QuotationRevision) => revision.quotation)]) {
      expect(draft.branding).toEqual({ accentColor: '#0f766e', logoImageId: 'image-1' })
    }
    expect(parseQuotationDocumentContent(content)).toEqual({ quotation, revisions })
    expect(JSON.stringify({ quotation, revisions })).toBe(before)
  })

  it('preserves different exact image strings and empty logos without creating empty assets', () => {
    const quotation = createQuotation({ revisionNumber: 4 })
    const revisions = [createRevision(1), createRevision(2), createRevision(3)]
    quotation.branding.logoDataUrl = LOGO_A
    revisions[1]!.quotation.branding.logoDataUrl = LOGO_B
    revisions[2]!.quotation.branding.logoDataUrl = LOGO_A

    const content = createQuotationFileContent(quotation, revisions)
    const stored = JSON.parse(content)

    expect(stored.images).toEqual({ 'image-1': LOGO_A, 'image-2': LOGO_B })
    expect(stored.quotation.branding.logoImageId).toBe('image-1')
    expect(stored.revisions.map((revision: { quotation: { branding: { logoImageId: string | null } } }) => revision.quotation.branding.logoImageId))
      .toEqual([null, 'image-2', 'image-1'])
    expect(parseQuotationDocumentContent(content)).toEqual({ quotation, revisions })
  })

  it('accepts image data URLs without changing their encoding or image subtype', () => {
    const quotation = createQuotation()
    quotation.branding.logoDataUrl = 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%2F%3E'

    expect(parseQuotationFileContent(createQuotationFileContent(quotation)).branding.logoDataUrl).toBe(quotation.branding.logoDataUrl)
  })

  it('migrates a complete v3 history to v4 without normalizing archived values', () => {
    const quotation = createQuotation({ revisionNumber: 3 })
    quotation.branding.logoDataUrl = LOGO_A
    const revisions = [createRevision(1), createRevision(2)]
    const archived = revisions[0]!.quotation
    archived.branding.logoDataUrl = LOGO_B
    archived.majorItems = [
      { id: ' historical-section ', kind: 'section_header', title: '' },
      createQuotationItem({ id: ' historical-item ', name: '', description: '  Detail\nline  ', quantityUnit: ' EA ', notes: '  Note  ' }),
    ]
    archived.companyProfileId = ' old-profile '
    archived.companyProfileSnapshot = { companyName: '  Historical Company  ', email: ' old@example.com ', phone: '' }
    archived.totalsConfig.taxClasses![0]!.label = ''
    archived.outputSettings = { itemDetailLevel: 1, subtotalLabel: ' Old subtotal ', informationalTotalsNote: '  Old note  ' }
    archived.pendingGoodsReceiptDraft = createGoodsReceiptDraft(archived, { documentDate: '2026-04-24' })
    archived.goodsReceiptHistory = [{
      id: 'receipt-1', exportedAt: '2026-04-24T00:00:00.000Z', filePath: 'C:\\Issued Receipts\\receipt.pdf',
      draft: createGoodsReceiptDraft(archived, { documentDate: '2026-04-24' }),
    }]
    const legacyContent = JSON.stringify({ schemaVersion: 3, app: 'quotation-software', exportedAt: '2026-04-24T00:00:00.000Z', quotation, revisions })
    const expectedArchives = JSON.parse(JSON.stringify(revisions))

    let document = parseQuotationDocumentContent(legacyContent)
    for (let save = 0; save < 3; save += 1) {
      expect(document.revisions).toEqual(expectedArchives)
      const content = createQuotationFileContent(document.quotation, document.revisions)
      expect(JSON.parse(content).schemaVersion).toBe(4)
      document = parseQuotationDocumentContent(content)
    }
    expect(document.revisions).toEqual(expectedArchives)
    expect(document.quotation).toEqual(quotation)
  })

  it.each([1, 2])('upgrades v%s inline logos when saved', (schemaVersion) => {
    const quotation = createQuotation()
    quotation.branding.logoDataUrl = LOGO_A
    const document = parseQuotationDocumentContent(JSON.stringify({
      schemaVersion, app: 'quotation-software', exportedAt: '2026-04-24T00:00:00.000Z', quotation,
    }))
    const stored = JSON.parse(createQuotationFileContent(document.quotation, document.revisions))

    expect(stored.schemaVersion).toBe(4)
    expect(stored.images).toEqual({ 'image-1': LOGO_A })
    expect(stored.quotation.branding.logoImageId).toBe('image-1')
    expect(document.quotation.branding.logoDataUrl).toBe(LOGO_A)
  })

  it('keeps revision IDs, content, and logos through create, restore, and delete round trips', () => {
    const quotation = createQuotation()
    quotation.branding.logoDataUrl = LOGO_A
    const created = proposeQuotationRevision({ quotation, revisions: [] }, { note: 'First issue' }, '2026-04-24T00:00:00.000Z')
    created.quotation.branding.logoDataUrl = LOGO_B
    created.quotation.header.projectName = 'Changed project'
    const reopened = parseQuotationDocumentContent(createQuotationFileContent(created.quotation, created.revisions))
    expect(reopened).toEqual(created)

    const restored = proposeQuotationRevision(reopened, { restoreRevisionId: reopened.revisions[0]!.id }, '2026-04-25T00:00:00.000Z')
    const restoredAgain = parseQuotationDocumentContent(createQuotationFileContent(restored.quotation, restored.revisions))
    expect(restoredAgain).toEqual(restored)
    expect(restoredAgain.quotation.branding.logoDataUrl).toBe(LOGO_A)
    expect(restoredAgain.revisions[1]!.quotation.branding.logoDataUrl).toBe(LOGO_B)

    const remainingRevisions = restoredAgain.revisions.filter(revision => revision.id !== restoredAgain.revisions[1]!.id)
    const deletedContent = createQuotationFileContent(restoredAgain.quotation, remainingRevisions)
    expect(parseQuotationDocumentContent(deletedContent)).toEqual({ quotation: restoredAgain.quotation, revisions: remainingRevisions })
    expect(JSON.parse(deletedContent).images).toEqual({ 'image-1': LOGO_A })
  })

  it('reassigns deterministic image IDs from current content on every save', () => {
    const quotation = createQuotation({ revisionNumber: 2 })
    const revision = createRevision()
    quotation.branding.logoDataUrl = LOGO_A
    revision.quotation.branding.logoDataUrl = LOGO_B
    const first = JSON.parse(createQuotationFileContent(quotation, [revision]))
    quotation.branding.logoDataUrl = LOGO_B
    const secondContent = createQuotationFileContent(quotation, [revision])
    const second = JSON.parse(secondContent)
    const reopened = parseQuotationDocumentContent(secondContent)
    const third = JSON.parse(createQuotationFileContent(reopened.quotation, reopened.revisions))

    expect(first.images).toEqual({ 'image-1': LOGO_A, 'image-2': LOGO_B })
    expect(second.images).toEqual({ 'image-1': LOGO_B })
    expect(third.images).toEqual(second.images)
    expect(third.quotation).toEqual(second.quotation)
    expect(third.revisions).toEqual(second.revisions)
  })

  it.each([
    ['missing table', (value: ReturnType<typeof createEnvelope>) => { delete value.images }],
    ['null table', (value: ReturnType<typeof createEnvelope>) => { value.images = null }],
    ['array table', (value: ReturnType<typeof createEnvelope>) => { value.images = [] }],
    ['non-string image', (value: ReturnType<typeof createEnvelope>) => { value.images['image-1'] = 123 }],
    ['empty image', (value: ReturnType<typeof createEnvelope>) => { value.images['image-1'] = '' }],
    ['remote image', (value: ReturnType<typeof createEnvelope>) => { value.images['image-1'] = 'https://example.com/logo.png' }],
    ['non-image data URL', (value: ReturnType<typeof createEnvelope>) => { value.images['image-1'] = 'data:text/plain;base64,YQ==' }],
    ['invalid base64', (value: ReturnType<typeof createEnvelope>) => { value.images['image-1'] = 'data:image/png;base64,???' }],
    ['invalid URI escape', (value: ReturnType<typeof createEnvelope>) => { value.images['image-1'] = 'data:image/svg+xml,%XX' }],
    ['invalid image id', (value: ReturnType<typeof createEnvelope>) => { value.images.bad = LOGO_A }],
    ['prototype property as asset', (value: ReturnType<typeof createEnvelope>) => { value.images = JSON.parse(`{"__proto__":${JSON.stringify(LOGO_A)}}`) }],
    ['missing reference', (value: ReturnType<typeof createEnvelope>) => { delete value.quotation.branding.logoImageId }],
    ['numeric reference', (value: ReturnType<typeof createEnvelope>) => { value.quotation.branding.logoImageId = 1 }],
    ['empty reference', (value: ReturnType<typeof createEnvelope>) => { value.quotation.branding.logoImageId = '' }],
    ['dangling reference', (value: ReturnType<typeof createEnvelope>) => { value.quotation.branding.logoImageId = 'image-99' }],
    ['inherited reference', (value: ReturnType<typeof createEnvelope>) => { value.quotation.branding.logoImageId = 'toString' }],
    ['prototype reference', (value: ReturnType<typeof createEnvelope>) => { value.quotation.branding.logoImageId = '__proto__' }],
    ['inline logo with reference', (value: ReturnType<typeof createEnvelope>) => { value.quotation.branding.logoDataUrl = '' }],
  ])('rejects v4 assets for %s', (_name, change) => {
    const envelope = createEnvelope()
    change(envelope)
    expect(() => parseQuotationDocumentContent(JSON.stringify(envelope))).toThrowError('invalid_quotation')
  })

  it.each([
    ['missing reference', (value: ReturnType<typeof createEnvelope>) => { delete value.revisions[0].quotation.branding.logoImageId }],
    ['dangling reference', (value: ReturnType<typeof createEnvelope>) => { value.revisions[0].quotation.branding.logoImageId = 'image-99' }],
    ['inherited reference', (value: ReturnType<typeof createEnvelope>) => { value.revisions[0].quotation.branding.logoImageId = 'constructor' }],
    ['inline logo', (value: ReturnType<typeof createEnvelope>) => { value.revisions[0].quotation.branding.logoDataUrl = LOGO_A }],
  ])('rejects the complete document for an archived %s', (_name, change) => {
    const envelope = createEnvelope()
    change(envelope)
    expect(() => parseQuotationDocumentContent(JSON.stringify(envelope))).toThrowError('invalid_revisions')
  })

  it('applies the size limit to stored shared images rather than expanded snapshots', () => {
    const quotation = createQuotation({ revisionNumber: 2 })
    const revision = createRevision()
    quotation.branding.logoDataUrl = `data:image/png;base64,${'A'.repeat(6 * 1024 * 1024)}`
    revision.quotation.branding.logoDataUrl = quotation.branding.logoDataUrl
    expect(getUtf8ByteLength(JSON.stringify({ quotation, revisions: [revision] }))).toBeGreaterThan(AUTOMATION_LIMITS.quotationJsonBytes)

    const content = createQuotationFileContent(quotation, [revision])
    expect(getUtf8ByteLength(content)).toBeLessThan(AUTOMATION_LIMITS.quotationJsonBytes)
    expect(parseQuotationDocumentContent(content)).toEqual({ quotation, revisions: [revision] })
  })

  it.each([
    ['missing history', (value: ReturnType<typeof createEnvelope>) => { delete value.revisions }],
    ['non-array history', (value: ReturnType<typeof createEnvelope>) => { value.revisions = {} }],
    ['missing snapshot', (value: ReturnType<typeof createEnvelope>) => { delete value.revisions[0].quotation }],
    ['wrong quotation family', (value: ReturnType<typeof createEnvelope>) => { value.revisions[0].quotation.id = 'another-quote' }],
    ['duplicate revision ids', (value: ReturnType<typeof createEnvelope>) => { value.revisions[1].id = value.revisions[0].id }],
    ['duplicate revision numbers', (value: ReturnType<typeof createEnvelope>) => { value.revisions[1].revisionNumber = 1; value.revisions[1].quotation.header.revisionNumber = 1 }],
    ['invalid archive number', (value: ReturnType<typeof createEnvelope>) => { value.revisions[0].revisionNumber = 0 }],
    ['mismatched header number', (value: ReturnType<typeof createEnvelope>) => { value.revisions[0].quotation.header.revisionNumber = 2 }],
    ['non-newest active number', (value: ReturnType<typeof createEnvelope>) => { value.quotation.header.revisionNumber = 2 }],
    ['invalid archive timestamp', (value: ReturnType<typeof createEnvelope>) => { value.revisions[0].createdAt = '2026-02-30T00:00:00.000Z' }],
    ['invalid note', (value: ReturnType<typeof createEnvelope>) => { value.revisions[0].note = 123 }],
    ['invalid archived item', (value: ReturnType<typeof createEnvelope>) => { value.revisions[0].quotation.majorItems = [{ id: 'bad' }] }],
    ['duplicate archived item ids', (value: ReturnType<typeof createEnvelope>) => { value.revisions[0].quotation.majorItems = [createQuotationItem(), createQuotationItem()] }],
    ['invalid archived template', (value: ReturnType<typeof createEnvelope>) => { value.revisions[0].quotation.templateId = 'unknown' }],
    ['missing archived company profile', (value: ReturnType<typeof createEnvelope>) => { delete value.revisions[0].quotation.companyProfileSnapshot }],
    ['invalid archived company field', (value: ReturnType<typeof createEnvelope>) => { value.revisions[0].quotation.companyProfileSnapshot.phone = 123 }],
    ['invalid archived company profile id', (value: ReturnType<typeof createEnvelope>) => { value.revisions[0].quotation.companyProfileId = {} }],
    ['missing archived locale', (value: ReturnType<typeof createEnvelope>) => { delete value.revisions[0].quotation.header.documentLocale }],
    ['invalid archived locale', (value: ReturnType<typeof createEnvelope>) => { value.revisions[0].quotation.header.documentLocale = 'unknown' }],
    ['invalid archived terms', (value: ReturnType<typeof createEnvelope>) => { value.revisions[0].quotation.header.terms = [] }],
    ['invalid archived mixed-tax columns', (value: ReturnType<typeof createEnvelope>) => { value.revisions[0].quotation.totalsConfig.mixedTaxColumns = ['unknown'] }],
    ['invalid archived output settings', (value: ReturnType<typeof createEnvelope>) => { value.revisions[0].quotation.outputSettings = { itemDetailLevel: 9 } }],
    ['invalid archived metadata', (value: ReturnType<typeof createEnvelope>) => { value.revisions[0].quotation.metadata.createdAt = 'bad' }],
    ['invalid archived receipt', (value: ReturnType<typeof createEnvelope>) => { value.revisions[0].quotation.pendingGoodsReceiptDraft = {} }],
    ['invalid archived receipt history', (value: ReturnType<typeof createEnvelope>) => { value.revisions[0].quotation.goodsReceiptHistory = [{}] }],
    ['nested history', (value: ReturnType<typeof createEnvelope>) => { value.revisions[0].quotation.revisions = [] }],
  ])('rejects the entire document for %s', (_name, change) => {
    const envelope = createEnvelope()
    change(envelope)
    const content = JSON.stringify(envelope)

    expect(() => parseQuotationDocumentContent(content)).toThrowError('invalid_revisions')
    expect(() => parseQuotationFileContent(content)).toThrowError('invalid_revisions')
  })

  it.each([undefined, 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])('rejects unsafe active revision number %s before normalization', (revisionNumber) => {
    const envelope = createEnvelope()
    envelope.quotation.header.revisionNumber = revisionNumber

    expect(() => parseQuotationDocumentContent(JSON.stringify(envelope))).toThrowError('invalid_revisions')
  })

  it('applies the existing 10 MiB limit to the complete UTF-8 document', () => {
    const quotation = createQuotation({ revisionNumber: 2 })
    const revision = createRevision()
    quotation.header.notes = '中'.repeat(Math.floor(AUTOMATION_LIMITS.quotationJsonBytes / 6))
    revision.quotation.header.notes = quotation.header.notes

    expect(() => createQuotationFileContent(quotation)).not.toThrow()
    expect(() => createQuotationFileContent(quotation, [revision])).toThrowError('input_too_large')

    const oversizedContent = JSON.stringify({
      schemaVersion: 3,
      app: 'quotation-software',
      exportedAt: '2026-04-24T00:00:00.000Z',
      quotation,
      revisions: [revision],
    })
    expect(oversizedContent.length).toBeLessThan(AUTOMATION_LIMITS.quotationJsonBytes)
    expect(() => parseQuotationDocumentContent(oversizedContent)).toThrowError('input_too_large')
  })
})

function createQuotation(overrides: Partial<QuotationDraft['header']> = {}): QuotationDraft {
  return {
    id: 'quote-1',
    templateId: 'classic',
    companyProfileId: null,
    companyProfileSnapshot: {
      companyName: 'CX Engineering',
      email: '',
      phone: '',
    },
    header: {
      quotationNumber: 'Q-2026-001',
      quotationDate: '2026-04-23',
      customerCompany: 'Acme Industrial',
      contactPerson: 'Alex Buyer',
      contactDetails: 'alex@example.com',
      projectName: 'Valve supply',
      validityPeriod: '30 days',
      currency: 'USD',
      documentLocale: 'en-US',
      notes: '',
      terms: '',
      revisionNumber: 1,
      ...overrides,
    },
    outputSettings: {
      itemDetailLevel: 3,
    },
    majorItems: [],
    totalsConfig: {
      globalMarkupRate: 10,
      extraCharges: [],
      taxMode: 'single',
      taxClasses: [
        {
          id: 'tax-0',
          label: '0%',
          rate: 0,
        },
      ],
      defaultTaxClassId: 'tax-0',
      mixedTaxColumns: [...DEFAULT_MIXED_TAX_DOCUMENT_COLUMNS],
    },
    exchangeRates: {
      USD: 1,
      EUR: 1.08,
      CNY: 0.14,
      GBP: 1.25,
    },
    branding: {
      logoDataUrl: '',
      accentColor: '#0f766e',
    },
    metadata: {
      createdAt: '2026-04-23T00:00:00.000Z',
      updatedAt: '2026-04-23T00:00:00.000Z',
    },
    goodsReceiptHistory: [],
  }
}

function createQuotationItem(overrides: Partial<QuotationItem> = {}): QuotationItem {
  return {
    id: overrides.id ?? 'item-1',
    name: overrides.name ?? 'Item',
    description: overrides.description ?? '',
    quantity: overrides.quantity ?? 1,
    quantityUnit: overrides.quantityUnit ?? 'EA',
    pricingMethod: overrides.pricingMethod ?? 'cost_plus',
    manualUnitPrice: overrides.manualUnitPrice,
    unitCost: overrides.unitCost ?? 0,
    costCurrency: overrides.costCurrency ?? 'USD',
    markupRate: overrides.markupRate,
    taxClassId: overrides.taxClassId,
    expectedTotal: overrides.expectedTotal,
    notes: overrides.notes ?? '',
    children: overrides.children ?? [],
  }
}
