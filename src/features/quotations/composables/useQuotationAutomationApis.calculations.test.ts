// @vitest-environment jsdom

import { effectScope, shallowRef, type EffectScope } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { QuotationRuntime } from '@/shared/runtime/quotationRuntime'
import { cloneSerializable } from '@/shared/utils/clone'
import * as onlineExchangeRates from '../services/onlineExchangeRates'
import type { OnlineExchangeRateResult } from '../services/onlineExchangeRates'
import { createQuotationItem } from '../utils/quotationItems'
import { useQuotationAutomationApis } from './useQuotationAutomationApis'
import { useQuotationEditor } from './useQuotationEditor'
import { useQuotationFileActions } from './useQuotationFileActions'

const scopes: EffectScope[] = []

beforeEach(() => window.localStorage.clear())
afterEach(() => {
  scopes.splice(0).forEach(scope => scope.stop())
  vi.restoreAllMocks()
})

describe('quotation calculations through automation wiring', () => {
  it('creates CNY quotations with rates based on CNY before pricing USD costs', async () => {
    const { api, editor } = createHarness()

    expect(await api.createQuotation({ header: { currency: 'CNY' } })).toMatchObject({ ok: true })
    expect(await api.addLineItem({ item: { name: 'USD equipment', unitCost: 100, costCurrency: 'USD', quantity: 1 } }))
      .toMatchObject({ ok: true })

    expect(editor.quotation.value.exchangeRates.CNY).toBe(1)
    expect(editor.quotation.value.exchangeRates.USD).toBeCloseTo(7.142857, 6)
    expect(editor.totals.value.subtotalAfterMarkup).toBe(785.72)
  })

  it.each(['quotation', 'base', 'table', 'rate', 'added currency', 'removed currency'] as const)(
    'rejects delayed exchange rates after the %s changes',
    async change => {
      const { api, editor } = createHarness()
      let completeRequest!: (result: OnlineExchangeRateResult) => void
      const fetchRates = vi.spyOn(onlineExchangeRates, 'fetchLatestExchangeRates')
        .mockImplementationOnce(() => new Promise(resolve => { completeRequest = resolve }))

      const refreshing = api.refreshExchangeRates()
      await vi.waitFor(() => expect(fetchRates).toHaveBeenCalledOnce())
      switch (change) {
        case 'quotation': editor.replaceQuotationDraft(cloneSerializable(editor.quotation.value)); break
        case 'base': editor.setQuotationCurrency('CNY'); break
        case 'table': editor.quotation.value.exchangeRates = { ...editor.quotation.value.exchangeRates }; break
        case 'rate': editor.updateExchangeRate('EUR', 1.5); break
        case 'added currency': editor.quotation.value.exchangeRates.CAD = 0.8; break
        case 'removed currency': delete editor.quotation.value.exchangeRates.EUR; break
      }
      const currentQuotation = cloneSerializable(editor.quotation.value)
      completeRequest({ rates: { USD: 1, EUR: 2 }, date: '2026-10-22', missingCurrencies: [] })

      expect(await refreshing).toMatchObject({ ok: false, error: { code: 'revision_conflict' } })
      expect(editor.quotation.value).toEqual(currentQuotation)
    },
  )

  it('applies online exchange rates when the requested quotation and rates are current', async () => {
    const { api, editor } = createHarness()
    vi.spyOn(onlineExchangeRates, 'fetchLatestExchangeRates').mockResolvedValueOnce({
      rates: { USD: 1, EUR: 2 }, date: '2026-10-22', missingCurrencies: [],
    })

    expect(await api.refreshExchangeRates()).toMatchObject({ ok: true, data: { date: '2026-10-22' } })
    expect(editor.quotation.value.exchangeRates.EUR).toBe(2)
  })

  it.each(['editor', 'API', 'batch'] as const)('rounds %s extra charges on add and update before save and reload', async mode => {
    const { api, editor, fileActions } = createHarness()
    if (mode === 'editor') {
      editor.addExtraCharge({ id: 'first', label: 'First', amount: 0.004 })
      editor.addExtraCharge({ id: 'second', label: 'Second', amount: 0.004 })
    } else if (mode === 'API') {
      expect(await api.addExtraCharge({ label: 'First', amount: 0.004 })).toMatchObject({ ok: true })
      expect(await api.addExtraCharge({ label: 'Second', amount: 0.004 })).toMatchObject({ ok: true })
    } else {
      expect(await api.applyOperations({ operations: [
        { type: 'addExtraCharge', input: { label: 'First', amount: 0.004 } },
        { type: 'addExtraCharge', input: { label: 'Second', amount: 0.004 } },
      ] })).toMatchObject({ ok: true })
    }
    expect(editor.quotation.value.totalsConfig.extraCharges?.map(charge => charge.amount)).toEqual([0, 0])
    expect(editor.totals.value.grandTotal).toBe(0)
    if (mode === 'editor') {
      editor.addExtraCharge({ id: 'negative', label: 'Negative', amount: -1 })
      expect(editor.quotation.value.totalsConfig.extraCharges?.find(charge => charge.id === 'negative')?.amount).toBe(0)
      editor.updateExtraChargeField('negative', 'amount', -1)
      expect(editor.quotation.value.totalsConfig.extraCharges?.find(charge => charge.id === 'negative')?.amount).toBe(0)
      editor.removeExtraCharge('negative')
    }

    const firstId = editor.quotation.value.totalsConfig.extraCharges![0]!.id
    if (mode === 'editor') editor.updateExtraChargeField(firstId, 'amount', 0.016)
    else if (mode === 'API') expect(await api.updateExtraCharge(firstId, { amount: 0.016 })).toMatchObject({ ok: true })
    else expect(await api.applyOperations({ operations: [{ type: 'updateExtraCharge', id: firstId, patch: { amount: 0.016 } }] }))
      .toMatchObject({ ok: true })
    expect(editor.quotation.value.totalsConfig.extraCharges![0]!.amount).toBe(0.02)

    if (mode === 'editor') editor.updateExtraChargeField(firstId, 'amount', 0.004)
    else if (mode === 'API') expect(await api.updateExtraCharge(firstId, { amount: 0.004 })).toMatchObject({ ok: true })
    else expect(await api.applyOperations({ operations: [{ type: 'updateExtraCharge', id: firstId, patch: { amount: 0.004 } }] }))
      .toMatchObject({ ok: true })
    expect(editor.quotation.value.totalsConfig.extraCharges?.map(charge => charge.amount)).toEqual([0, 0])
    const beforeSave = cloneSerializable(editor.totals.value)
    expect(await api.saveQuotationToFile('charges.json')).toMatchObject({ ok: true })
    expect(fileActions.currentFilePath.value).toBe('charges.json')
    expect(await api.createQuotation()).toMatchObject({ ok: true })
    expect(await api.importQuotationFile('charges.json')).toMatchObject({ ok: true })
    expect(editor.quotation.value.totalsConfig.extraCharges?.map(charge => charge.amount)).toEqual([0, 0])
    expect(editor.totals.value).toEqual(beforeSave)
    expect(editor.totals.value.grandTotal).toBe(0)
  })

  it.each(['API', 'batch'] as const)('clears deleted tax references atomically through %s and restores them with undo', async mode => {
    const { api, editor } = createHarness()
    editor.quotation.value.totalsConfig = {
      ...cloneSerializable(editor.quotation.value.totalsConfig),
      taxMode: 'mixed',
      taxClasses: [{ id: 'standard', label: 'Standard', rate: 20 }, { id: 'reduced', label: 'Reduced', rate: 5 }],
      defaultTaxClassId: 'reduced',
    }
    editor.replaceLineItems([
      createQuotationItem('USD', {
        id: 'parent', taxClassId: 'standard', children: [
          createQuotationItem('USD', { id: 'child', unitCost: 100, taxClassId: 'reduced' }),
          createQuotationItem('USD', { id: 'inherited', unitCost: 50 }),
        ],
      }),
      createQuotationItem('USD', { id: 'root', unitCost: 25, taxClassId: 'reduced' }),
    ])
    editor.resetQuotationChangeHistory()
    const before = cloneSerializable(editor.quotation.value)

    const removed = mode === 'API'
      ? await api.removeTaxClass('reduced')
      : await api.applyOperations({ operations: [{ type: 'removeTaxClass', id: 'reduced' }] })
    if (!removed.ok) throw new Error(JSON.stringify(removed.error))
    expect(removed).toMatchObject({ ok: true })
    const after = cloneSerializable(editor.quotation.value)
    expect(after.totalsConfig.taxClasses?.map(taxClass => taxClass.id)).toEqual(['standard'])
    expect(after.totalsConfig.defaultTaxClassId).toBe('standard')
    expect(after.majorItems[0]).toMatchObject({ id: 'parent', taxClassId: 'standard' })
    const parent = after.majorItems[0]!
    if ('children' in parent) expect(parent.children[0]).not.toHaveProperty('taxClassId')
    expect(after.majorItems[1]).not.toHaveProperty('taxClassId')
    expect(await api.validateQuotation()).toMatchObject({ ok: true, data: { valid: true } })
    expect(editor.undoLastQuotationChange().ok).toBe(true)
    expect(editor.quotation.value).toEqual(before)
    expect(editor.redoLastQuotationChange().ok).toBe(true)
    expect(editor.quotation.value).toEqual(after)

    const totals = cloneSerializable(editor.totals.value)
    expect(await api.saveQuotationToFile('taxes.json')).toMatchObject({ ok: true })
    expect(await api.createQuotation()).toMatchObject({ ok: true })
    expect(await api.importQuotationFile('taxes.json')).toMatchObject({ ok: true })
    expect(editor.totals.value).toEqual(totals)
  })
})

function createHarness() {
  const files = new Map<string, string>()
  const runtime = {
    capabilities: {
      isDesktop: true, hasNativeFileDialogs: true, supportsFileSystemAccess: false,
      supportsDirectPdfExport: true, supportsBrowserPrint: false,
    },
    getAppVersion: vi.fn().mockResolvedValue('test'),
    saveQuotationFile: vi.fn(async ({ filePath, content }) => {
      files.set(filePath, content)
      return { canceled: false, filePath, mode: 'native' }
    }),
    openQuotationFileFromPath: vi.fn(async filePath => ({ canceled: false, filePath, content: files.get(filePath) })),
  } as unknown as QuotationRuntime
  const scope = effectScope()
  scopes.push(scope)
  return scope.run(() => {
    const editor = useQuotationEditor(shallowRef('en-US'))
    const fileActions = useQuotationFileActions({
      ...editor, runtime, flushPendingEdits: editor.commitQuotationChangeHistory, t: key => key,
    })
    const { apiV2: api } = useQuotationAutomationApis({
      editor, fileActions, runtime, t: key => key,
      goodsReceiptExport: {
        exportPendingGoodsReceiptPdfToFile: vi.fn(),
        exportPendingGoodsReceiptPdfToFileForAutomation: vi.fn(),
      } as unknown as Parameters<typeof useQuotationAutomationApis>[0]['goodsReceiptExport'],
    })
    return { api, editor, fileActions }
  })!
}
