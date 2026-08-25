import { ref, shallowRef } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import { QUOTATION_AUTOMATION_API_VERSION } from '@/shared/contracts/quotationAutomation'
import type { QuotationRuntime } from '@/shared/runtime/quotationRuntime'

import type { QuotationItem, QuotationRootItem, QuotationTotals } from '../types'
import { createInitialQuotation } from '../utils/quotationDraft'
import {
  createQuotationItem,
  createQuotationSectionHeader,
  duplicateQuotationItem,
  isQuotationItem,
} from '../utils/quotationItems'
import { parseQuotationFileContent, QUOTATION_FILE_SCHEMA_VERSION } from '../utils/quotationFile'
import { useQuotationAgentApiV2 } from './useQuotationAgentApiV2'

describe('useQuotationAgentApiV2', () => {
  it('reports stable identity and accurate host capabilities', async () => {
    const { api } = createHarness({ host: 'headless' })

    await expect(api.getApiInfo()).resolves.toMatchObject({
      apiVersion: QUOTATION_AUTOMATION_API_VERSION,
      appVersion: '0.1.0-test',
      quotationSchemaVersion: QUOTATION_FILE_SCHEMA_VERSION,
      capabilities: {
        host: 'headless',
        pathImport: true,
        pathExport: true,
        directPdfExport: true,
        browserPrint: false,
        batchOperations: true,
      },
      supportedLocales: ['en-US', 'zh-CN'],
      supportedTaxModes: ['single', 'mixed'],
    })
  })

  it('serializes a detached schema-v2 quotation snapshot', async () => {
    const { api, quotation } = createHarness()

    const result = await api.serializeQuotation()

    expect(result).toMatchObject({
      ok: true,
      data: {
        schemaVersion: QUOTATION_FILE_SCHEMA_VERSION,
        revision: 0,
      },
      meta: {
        apiVersion: QUOTATION_AUTOMATION_API_VERSION,
        revision: 0,
        requestId: expect.any(String),
        warnings: [],
      },
    })
    if (!result.ok) return

    expect(parseQuotationFileContent(result.data.content)).toEqual(result.data.quotation)
    result.data.quotation.header.projectName = 'Detached change'
    expect(quotation.value.header.projectName).not.toBe('Detached change')
  })

  it('validates supplied content without replacing the active quotation', async () => {
    const { api, quotation } = createHarness()
    const originalQuotationId = quotation.value.id

    const result = await api.validateQuotationContent('{not-json')

    expect(result).toMatchObject({
      ok: true,
      data: {
        valid: false,
        schemaVersion: QUOTATION_FILE_SCHEMA_VERSION,
        issues: [{
          code: 'invalid_json',
          severity: 'error',
          fieldPath: '$',
        }],
      },
    })
    expect(quotation.value.id).toBe(originalQuotationId)
  })

  it('validates the active quotation without changing it', async () => {
    const { api, quotation } = createHarness()
    const original = JSON.stringify(quotation.value)

    const result = await api.validateQuotation()

    expect(result).toMatchObject({
      ok: true,
      data: {
        valid: true,
        schemaVersion: QUOTATION_FILE_SCHEMA_VERSION,
        issues: [],
      },
    })
    expect(JSON.stringify(quotation.value)).toBe(original)
  })

  it('rejects a non-string validation argument through the machine contract', async () => {
    const { api } = createHarness()

    const result = await api.validateQuotationContent(123 as unknown as string)

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: 'invalid_argument',
        fieldPath: 'content',
      },
      meta: {
        apiVersion: QUOTATION_AUTOMATION_API_VERSION,
        revision: 0,
      },
    })
  })

  it('advances the observed revision only when quotation state changes', async () => {
    const { api, quotation } = createHarness()

    const initial = await api.getQuotationSnapshot()
    quotation.value.header.projectName = 'Revision change'
    const changed = await api.getQuotationSnapshot()
    const unchanged = await api.getQuotationSnapshot()

    expect(initial.meta.revision).toBe(0)
    expect(changed.meta.revision).toBe(1)
    expect(unchanged.meta.revision).toBe(1)
  })

  it('creates a quotation shell and returns normalized authoring state', async () => {
    const { api } = createHarness()

    const result = await api.createQuotation({
      header: {
        quotationDate: '2026-08-25',
        projectName: 'Automation project',
        currency: 'cny',
        documentLocale: 'zh-CN',
      },
      templateId: 'signal',
      branding: { accentColor: '#336699' },
      lineItemEntryMode: 'quick',
      outputSettings: { itemDetailLevel: 2 },
    })

    expect(result).toMatchObject({
      ok: true,
      data: {
        revision: 1,
        quotation: {
          templateId: 'signal',
          header: {
            projectName: 'Automation project',
            currency: 'CNY',
            documentLocale: 'zh-CN',
          },
          branding: { accentColor: '#336699' },
          lineItemEntryMode: 'quick',
          outputSettings: { itemDetailLevel: 2 },
        },
      },
      meta: { revision: 1 },
    })
  })

  it('serializes concurrent lifecycle mutations and reports each revision', async () => {
    const { api, quotation } = createHarness()

    const results = await Promise.all([
      api.updateHeader({ projectName: 'Queued project', customerCompany: 'Northwind' }),
      api.setTemplate('atelier'),
      api.setDocumentLocale('zh-CN'),
      api.setBranding({ accentColor: '#123456' }),
      api.setLineItemEntryMode('quick'),
      api.setOutputSettings({ itemDetailLevel: 1 }),
    ])

    expect(results.map((result) => result.meta.revision)).toEqual([1, 2, 3, 4, 5, 6])
    expect(quotation.value).toMatchObject({
      templateId: 'atelier',
      header: {
        projectName: 'Queued project',
        customerCompany: 'Northwind',
        documentLocale: 'zh-CN',
      },
      branding: { accentColor: '#123456' },
      lineItemEntryMode: 'quick',
      outputSettings: { itemDetailLevel: 1 },
    })
  })

  it('rejects unknown or invalid authoring fields without mutation', async () => {
    const { api, quotation } = createHarness()
    const original = JSON.stringify(quotation.value)

    const unknownField = await api.updateHeader({ unexpected: 'value' } as never)
    const invalidDate = await api.updateHeader({ quotationDate: '2026-02-30' })
    const invalidBranding = await api.setBranding({ accentColor: 'blue' })

    expect(unknownField).toMatchObject({
      ok: false,
      error: { code: 'unknown_field', fieldPath: 'unexpected' },
    })
    expect(invalidDate).toMatchObject({
      ok: false,
      error: { code: 'invalid_argument', fieldPath: 'quotationDate' },
    })
    expect(invalidBranding).toMatchObject({
      ok: false,
      error: { code: 'invalid_argument', fieldPath: 'accentColor' },
    })
    expect(JSON.stringify(quotation.value)).toBe(original)
  })

  it('builds and edits a three-level item tree through stable IDs', async () => {
    const { api } = createHarness()

    const section = await api.addSectionHeader({ index: 0, title: 'Equipment' })
    const root = await api.addLineItem({ item: { name: 'Package', unitCost: 100 } })
    if (!root.ok) throw new Error('Expected root item')
    const child = await api.addLineItem({ parentId: root.data.itemId, item: { name: 'Pump' } })
    if (!child.ok) throw new Error('Expected child item')
    const grandchild = await api.addLineItem({ parentId: child.data.itemId, item: { name: 'Seal', quantity: 2 } })
    if (!grandchild.ok) throw new Error('Expected grandchild item')

    const updated = await api.updateLineItem(grandchild.data.itemId, {
      description: 'Mechanical seal',
      unitCost: 25,
      markupRate: 20,
    })
    const duplicate = await api.duplicateItem(root.data.itemId)
    const tree = await api.getItemTree()

    expect(section.ok).toBe(true)
    expect(updated).toMatchObject({
      ok: true,
      data: { id: grandchild.data.itemId, description: 'Mechanical seal', unitCost: 25, markupRate: 20 },
    })
    expect(duplicate).toMatchObject({ ok: true, data: { itemId: expect.any(String) } })
    expect(tree.ok && tree.data[0]).toMatchObject({ kind: 'section_header', title: 'Equipment' })
    if (!tree.ok || !duplicate.ok) return
    const duplicatedRoot = findTestRow(tree.data, duplicate.data.itemId)
    expect(isQuotationItem(duplicatedRoot) && duplicatedRoot.children[0]?.id).not.toBe(child.data.itemId)
    tree.data.splice(0)
    const freshTree = await api.getItemTree()
    expect(freshTree.ok && freshTree.data.length).toBeGreaterThan(0)
  })

  it('rejects invalid tree depth, circular moves, and invalid indexes without partial mutation', async () => {
    const { api, quotation } = createHarness()
    const rootId = (quotation.value.majorItems.find(isQuotationItem) as QuotationItem).id
    const child = await api.addLineItem({ parentId: rootId, item: { name: 'Child' } })
    if (!child.ok) throw new Error('Expected child item')
    const grandchild = await api.addLineItem({ parentId: child.data.itemId, item: { name: 'Grandchild' } })
    if (!grandchild.ok) throw new Error('Expected grandchild item')
    const before = JSON.stringify(quotation.value)

    const tooDeep = await api.addLineItem({ parentId: grandchild.data.itemId, item: { name: 'Too deep' } })
    const circular = await api.moveItem(rootId, { parentId: grandchild.data.itemId, index: 0 })
    const invalidIndex = await api.moveItem(grandchild.data.itemId, { parentId: null, index: 999 })

    expect(tooDeep).toMatchObject({ ok: false, error: { code: 'invalid_depth' } })
    expect(circular).toMatchObject({ ok: false, error: { code: 'circular_move' } })
    expect(invalidIndex).toMatchObject({ ok: false, error: { code: 'invalid_index' } })
    expect(JSON.stringify(quotation.value)).toBe(before)
  })

  it('manages pricing, exchange rates, tax classes, and extra charges', async () => {
    const { api, quotation } = createHarness()
    const itemId = (quotation.value.majorItems.find(isQuotationItem) as QuotationItem).id

    await api.setGlobalMarkupRate(18)
    await api.updateExchangeRate('eur', 1.2)
    await api.addExchangeRate('jpy', 0.007)
    await api.setItemPricingMethod(itemId, 'manual_price')
    const taxClass = await api.addTaxClass({ label: 'Service', rate: 6 })
    if (!taxClass.ok) throw new Error('Expected tax class')
    await api.updateTaxClass(taxClass.data.taxClassId, { label: 'Services', rate: 5 })
    await api.setDefaultTaxClass(taxClass.data.taxClassId)
    await api.assignItemTaxClass(itemId, taxClass.data.taxClassId)
    await api.setTaxMode('mixed')
    await api.setMixedTaxDocumentColumns(['taxRate', 'grossAmount', 'taxRate'])
    const charge = await api.addExtraCharge({ label: 'Freight', amount: 120 })
    if (!charge.ok) throw new Error('Expected extra charge')
    await api.updateExtraCharge(charge.data.extraChargeId, { amount: 150 })

    expect(quotation.value).toMatchObject({
      totalsConfig: {
        globalMarkupRate: 18,
        taxMode: 'mixed',
        defaultTaxClassId: taxClass.data.taxClassId,
        mixedTaxColumns: ['taxRate', 'grossAmount'],
      },
      exchangeRates: { EUR: 1.2, JPY: 0.007 },
    })
    expect(quotation.value.totalsConfig.taxClasses).toContainEqual(
      expect.objectContaining({ id: taxClass.data.taxClassId, label: 'Services', rate: 5 }),
    )
    expect(quotation.value.totalsConfig.extraCharges).toContainEqual(
      expect.objectContaining({ id: charge.data.extraChargeId, label: 'Freight', amount: 150 }),
    )
    expect(findTestRow(quotation.value.majorItems, itemId)).toMatchObject({
      pricingMethod: 'manual_price',
      taxClassId: taxClass.data.taxClassId,
    })
  })

  it('previews goal seek without mutation and applies the canonical solver result', async () => {
    const { api, quotation } = createHarness()
    const item = quotation.value.majorItems.find(isQuotationItem) as QuotationItem
    item.unitCost = 100
    item.costCurrency = 'USD'
    delete item.markupRate
    const before = JSON.stringify(quotation.value)

    const preview = await api.previewItemGoalSeek({ itemId: item.id, targetUnitPriceBeforeTax: 125 })
    expect(preview).toMatchObject({ ok: true, data: { ok: true, markupRate: 25 }, meta: { revision: 1 } })
    expect(JSON.stringify(quotation.value)).toBe(before)

    const applied = await api.applyItemGoalSeek({ itemId: item.id, targetUnitPriceBeforeTax: 125 })
    expect(applied).toMatchObject({ ok: true, data: { ok: true, markupRate: 25 } })
    expect(item.markupRate).toBe(25)

    delete item.markupRate
    const quotationPreview = await api.previewQuotationGoalSeek({ target: 'subtotal_before_tax', targetAmount: 150 })
    expect(quotationPreview).toMatchObject({ ok: true, data: { ok: true, markupRate: 50 } })
    const quotationApplied = await api.applyQuotationGoalSeek({ target: 'subtotal_before_tax', targetAmount: 150 })
    expect(quotationApplied).toMatchObject({ ok: true, data: { ok: true, markupRate: 50 } })
    expect(quotation.value.totalsConfig.globalMarkupRate).toBe(50)
  })

  it('rejects out-of-range pricing inputs without changing state', async () => {
    const { api, quotation } = createHarness()
    const before = JSON.stringify(quotation.value)

    const markup = await api.setGlobalMarkupRate(1_001)
    const rate = await api.updateExchangeRate('EUR', 0)
    const tax = await api.addTaxClass({ label: 'Invalid', rate: 101 })
    const charge = await api.addExtraCharge({ label: 'Invalid', amount: -1 })

    expect(markup).toMatchObject({ ok: false, error: { code: 'invalid_argument', fieldPath: 'rate' } })
    expect(rate).toMatchObject({ ok: false, error: { code: 'invalid_argument', fieldPath: 'rate' } })
    expect(tax).toMatchObject({ ok: false, error: { code: 'invalid_argument', fieldPath: 'rate' } })
    expect(charge).toMatchObject({ ok: false, error: { code: 'invalid_argument', fieldPath: 'amount' } })
    expect(JSON.stringify(quotation.value)).toBe(before)
  })

  it('commits a valid batch once and rejects stale revisions', async () => {
    const { api, quotation, commitMutationHistory } = createHarness()

    const result = await api.applyOperations({
      expectedRevision: 0,
      operations: [
        { type: 'updateHeader', patch: { projectName: 'Atomic project', customerCompany: 'Northwind' } },
        { type: 'setTemplate', templateId: 'technical-bid' },
        { type: 'setGlobalMarkupRate', rate: 22 },
        { type: 'addExtraCharge', input: { label: 'Freight', amount: 80 } },
      ],
    })

    expect(result).toMatchObject({
      ok: true,
      data: {
        revision: 1,
        operationResults: [
          { index: 0, type: 'updateHeader' },
          { index: 1, type: 'setTemplate' },
          { index: 2, type: 'setGlobalMarkupRate' },
          { index: 3, type: 'addExtraCharge', data: { extraChargeId: expect.any(String) } },
        ],
        snapshot: {
          revision: 1,
          quotation: {
            templateId: 'technical-bid',
            header: { projectName: 'Atomic project', customerCompany: 'Northwind' },
            totalsConfig: { globalMarkupRate: 22 },
          },
        },
      },
      meta: { revision: 1 },
    })
    expect(commitMutationHistory).toHaveBeenCalledTimes(1)

    const afterSuccess = JSON.stringify(quotation.value)
    const stale = await api.applyOperations({
      expectedRevision: 0,
      operations: [{ type: 'setGlobalMarkupRate', rate: 30 }],
    })
    expect(stale).toMatchObject({
      ok: false,
      error: {
        code: 'revision_conflict',
        details: { expectedRevision: 0, actualRevision: 1 },
      },
      meta: { revision: 1 },
    })
    expect(JSON.stringify(quotation.value)).toBe(afterSuccess)
    expect(commitMutationHistory).toHaveBeenCalledTimes(1)
  })

  it('discards every cloned change when a batch operation fails', async () => {
    const { api, quotation, commitMutationHistory } = createHarness()
    const before = JSON.stringify(quotation.value)

    const result = await api.applyOperations({
      expectedRevision: 0,
      operations: [
        { type: 'updateHeader', patch: { projectName: 'Must not leak' } },
        { type: 'setGlobalMarkupRate', rate: 2_000 },
        { type: 'setTemplate', templateId: 'signal' },
      ],
    })

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: 'invalid_argument',
        fieldPath: 'rate',
        details: { operationIndex: 1, operationType: 'setGlobalMarkupRate' },
      },
      meta: { revision: 0 },
    })
    expect(JSON.stringify(quotation.value)).toBe(before)
    expect(commitMutationHistory).not.toHaveBeenCalled()
  })
})

function createHarness(options: { host?: 'desktop-ui' | 'web-ui' | 'headless' } = {}) {
  const quotation = ref(createInitialQuotation([], 'en-US'))
  const itemSummaries = ref([])
  const totals = ref<QuotationTotals>({
    baseSubtotal: 0,
    markupAmount: 0,
    subtotalAfterMarkup: 0,
    taxableSubtotal: 0,
    taxAmount: 0,
    grandTotal: 0,
    taxBuckets: [],
  })
  const currentFilePath = shallowRef('')
  const runtime: Pick<QuotationRuntime, 'capabilities' | 'getAppVersion'> = {
    capabilities: {
      isDesktop: true,
      hasNativeFileDialogs: true,
      supportsFileSystemAccess: false,
      supportsDirectPdfExport: true,
      supportsBrowserPrint: false,
    },
    getAppVersion: vi.fn().mockResolvedValue('0.1.0-test'),
  }
  const commitMutationHistory = vi.fn()
  const api = useQuotationAgentApiV2({
    quotation,
    itemSummaries,
    totals,
    currentFilePath,
    runtime,
    host: options.host,
    commitMutationHistory,
    createNewQuotation(input = {}) {
      const nextQuotation = createInitialQuotation([], input.header?.documentLocale ?? 'en-US')
      nextQuotation.header = { ...nextQuotation.header, ...input.header }
      nextQuotation.templateId = input.templateId ?? nextQuotation.templateId
      nextQuotation.branding = { ...nextQuotation.branding, ...input.branding }
      nextQuotation.lineItemEntryMode = input.lineItemEntryMode ?? nextQuotation.lineItemEntryMode
      nextQuotation.outputSettings = {
        itemDetailLevel: input.outputSettings?.itemDetailLevel
          ?? nextQuotation.outputSettings?.itemDetailLevel
          ?? 3,
      }
      quotation.value = nextQuotation
    },
    updateHeaderFields(patch) {
      quotation.value.header = { ...quotation.value.header, ...patch }
    },
    setTemplateId(templateId) {
      quotation.value.templateId = templateId
    },
    setBranding(patch) {
      quotation.value.branding = { ...quotation.value.branding, ...patch }
    },
    setLineItemEntryMode(mode) {
      quotation.value.lineItemEntryMode = mode
    },
    setOutputSettings(patch) {
      quotation.value.outputSettings = {
        itemDetailLevel: patch.itemDetailLevel
          ?? quotation.value.outputSettings?.itemDetailLevel
          ?? 3,
      }
    },
    insertLineItem(parentItemId, index, patch) {
      const parent = parentItemId ? findTestRow(quotation.value.majorItems, parentItemId) : null
      if (parentItemId && !isQuotationItem(parent)) return null
      const target = isQuotationItem(parent) ? parent.children : quotation.value.majorItems
      const item = createQuotationItem(
        isQuotationItem(parent) ? parent.costCurrency : quotation.value.header.currency,
        patch,
      )
      target.splice(index, 0, item)
      return item.id
    },
    insertSectionHeader(index, title) {
      const section = createQuotationSectionHeader('en-US', { title })
      quotation.value.majorItems.splice(index, 0, section)
      return section.id
    },
    updateItemFields(itemId, patch) {
      const item = findTestRow(quotation.value.majorItems, itemId)
      if (isQuotationItem(item)) Object.assign(item, patch)
    },
    setItemPricingMethod(itemId, method) {
      const item = findTestRow(quotation.value.majorItems, itemId)
      if (isQuotationItem(item)) item.pricingMethod = method
    },
    updateSectionHeaderTitle(itemId, title) {
      const section = quotation.value.majorItems.find((row) => row.id === itemId)
      if (section && !isQuotationItem(section)) section.title = title
    },
    removeItem(itemId) {
      removeTestRow(quotation.value.majorItems, itemId)
    },
    duplicateItem(itemId) {
      const location = findTestRowLocation(quotation.value.majorItems, itemId)
      if (!location || !isQuotationItem(location.row)) return null
      const duplicate = duplicateQuotationItem(location.row)
      location.rows.splice(location.index + 1, 0, duplicate)
      return duplicate.id
    },
    moveQuotationTreeRow(itemId, parentItemId, index) {
      const location = findTestRowLocation(quotation.value.majorItems, itemId)
      if (!location) return false
      const [row] = location.rows.splice(location.index, 1)
      if (!row) return false
      const parent = parentItemId ? findTestRow(quotation.value.majorItems, parentItemId) : null
      const target = isQuotationItem(parent) ? parent.children : quotation.value.majorItems
      target.splice(index, 0, row as QuotationItem)
      return true
    },
    setGlobalMarkupRate(rate) {
      quotation.value.totalsConfig.globalMarkupRate = rate
    },
    updateExchangeRate(currency, rate) {
      quotation.value.exchangeRates[currency] = rate
    },
    addExchangeRate(currency) {
      if (currency in quotation.value.exchangeRates) return 'exists'
      quotation.value.exchangeRates[currency] = 1
      return 'added'
    },
    removeExchangeRate(currency) {
      if (currency === quotation.value.header.currency) return 'base_currency'
      if (collectTestItems(quotation.value.majorItems).some((item) => item.costCurrency === currency)) return 'in_use'
      delete quotation.value.exchangeRates[currency]
      return 'removed'
    },
    setQuotationCurrency(currency, rates) {
      quotation.value.header.currency = currency
      quotation.value.exchangeRates = { ...quotation.value.exchangeRates, ...rates, [currency]: 1 }
      return true
    },
    updateExchangeRates(rates) {
      quotation.value.exchangeRates = { ...quotation.value.exchangeRates, ...rates }
    },
    setTaxMode(mode) {
      quotation.value.totalsConfig.taxMode = mode
      return 'updated'
    },
    setMixedTaxDocumentColumns(columns) {
      quotation.value.totalsConfig.mixedTaxColumns = columns
    },
    addTaxClass(taxClass) {
      quotation.value.totalsConfig.taxClasses ??= []
      quotation.value.totalsConfig.taxClasses.push(taxClass)
      quotation.value.totalsConfig.defaultTaxClassId ??= taxClass.id
    },
    updateTaxClassField(id, field, value) {
      const taxClass = quotation.value.totalsConfig.taxClasses?.find((entry) => entry.id === id)
      if (!taxClass) return
      if (field === 'label') taxClass.label = String(value)
      else taxClass.rate = Number(value)
    },
    removeTaxClass(id) {
      quotation.value.totalsConfig.taxClasses = quotation.value.totalsConfig.taxClasses?.filter((entry) => entry.id !== id)
    },
    setDefaultTaxClass(id) {
      quotation.value.totalsConfig.defaultTaxClassId = id
    },
    addExtraCharge(charge) {
      quotation.value.totalsConfig.extraCharges ??= []
      quotation.value.totalsConfig.extraCharges.push(charge)
    },
    updateExtraChargeField(id, field, value) {
      const charge = quotation.value.totalsConfig.extraCharges?.find((entry) => entry.id === id)
      if (!charge) return
      if (field === 'label') charge.label = String(value)
      else charge.amount = Number(value)
    },
    removeExtraCharge(id) {
      quotation.value.totalsConfig.extraCharges = quotation.value.totalsConfig.extraCharges?.filter((entry) => entry.id !== id)
    },
    applyItemGoalSeek(updates) {
      for (const update of updates) {
        const item = findTestRow(quotation.value.majorItems, update.itemId)
        if (isQuotationItem(item)) item.markupRate = update.markupRate
      }
    },
    applyQuotationGoalSeek(markupRate) {
      quotation.value.totalsConfig.globalMarkupRate = markupRate
    },
    replaceQuotationDraft(nextQuotation) {
      quotation.value = nextQuotation
    },
  })

  return { api, quotation, commitMutationHistory }
}

function findTestRow(rows: QuotationRootItem[] | QuotationItem[], itemId: string): QuotationRootItem | undefined {
  return findTestRowLocation(rows, itemId)?.row
}

function findTestRowLocation(
  rows: QuotationRootItem[] | QuotationItem[],
  itemId: string,
): { rows: QuotationRootItem[] | QuotationItem[]; row: QuotationRootItem; index: number } | null {
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index] as QuotationRootItem
    if (row.id === itemId) return { rows, row, index }
    if (isQuotationItem(row)) {
      const nested = findTestRowLocation(row.children, itemId)
      if (nested) return nested
    }
  }
  return null
}

function removeTestRow(rows: QuotationRootItem[] | QuotationItem[], itemId: string): boolean {
  const location = findTestRowLocation(rows, itemId)
  if (!location) return false
  location.rows.splice(location.index, 1)
  return true
}

function collectTestItems(rows: QuotationRootItem[] | QuotationItem[]): QuotationItem[] {
  return rows.flatMap((row) => isQuotationItem(row) ? [row, ...collectTestItems(row.children)] : [])
}
