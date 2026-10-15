import Aura from '@primevue/themes/aura'
import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import { describe, expect, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { defineComponent, h, type VNode } from 'vue'

import '@/assets/main.css'
import { createAppI18n } from '@/shared/i18n/createAppI18n'

import { useQuotationEditor } from '../composables/useQuotationEditor'
import { fetchLatestExchangeRates } from '../services/onlineExchangeRates'
import { createQuotationAnalysisDataset } from '../utils/quotationAnalysis'
import { createLargeControlsQuotation } from './__fixtures__/largeQuotationControls'
import ExchangeRatePanel from './ExchangeRatePanel.vue'
import PricingPanel from './PricingPanel.vue'
import QuotationAnalysisView from './QuotationAnalysisView.vue'

vi.mock('../services/onlineExchangeRates', () => ({ fetchLatestExchangeRates: vi.fn() }))

type Editor = ReturnType<typeof useQuotationEditor>

function mountControls(render: (editor: Editor) => VNode, flat = false, width = 550) {
  const host = document.createElement('div')
  host.style.cssText = `position: fixed; top: 16px; left: 16px; width: ${width}px; height: 650px; overflow: auto;`
  document.body.appendChild(host)
  let editor!: Editor
  const i18n = createAppI18n('en-US')
  const wrapper = mount(defineComponent({
    setup() {
      editor = useQuotationEditor()
      editor.replaceQuotationDraft(createLargeControlsQuotation(flat))
      return () => render(editor)
    },
  }), {
    attachTo: host,
    global: {
      plugins: [i18n, [PrimeVue, { theme: { preset: Aura } }]],
      directives: { tooltip: {} },
    },
  })
  return { editor, wrapper, t: i18n.global.t, cleanup: () => { wrapper.unmount(); host.remove() } }
}

describe('Secondary controls with a 404-item quotation', () => {
  it('edits global pricing, changes tax classes and columns, and adds and removes charges', async () => {
    await page.viewport(1200, 750)
    const requestGoalSeek = vi.fn()
    const { editor, wrapper, t, cleanup } = mountControls(editor => h(PricingPanel, {
      totals: editor.totals.value,
      totalsConfig: editor.quotation.value.totalsConfig,
      currency: editor.quotation.value.header.currency,
      onRequestTaxModeChange: mode => editor.setTaxMode(mode),
      onRequestGoalSeek: requestGoalSeek,
      onUpdateTotalsField: editor.updateTotalsField,
      onUpdateTaxClassField: editor.updateTaxClassField,
      onAddTaxClass: editor.addTaxClass,
      onRemoveTaxClass: editor.removeTaxClass,
      onAddExtraCharge: editor.addExtraCharge,
      onRemoveExtraCharge: editor.removeExtraCharge,
      onUpdateExtraChargeField: editor.updateExtraChargeField,
    }))
    const control = (selector: string) => page.elementLocator(wrapper.get(selector).element)
    try {
      await control('[data-history-target="totals:globalMarkupRate"] input').fill('15')
      await userEvent.tab()
      await vi.waitFor(() => expect(editor.quotation.value.totalsConfig.globalMarkupRate).toBe(15))
      await page.getByRole('button', { name: t('quotations.goalSeek.openQuotationAria'), exact: true }).click()
      expect(requestGoalSeek).toHaveBeenCalledOnce()
      await control('[data-history-target="totals:taxMode"] [role="combobox"]').click()
      await page.getByRole('option', { name: t('quotations.totals.taxModes.mixed'), exact: true }).click()
      await page.getByRole('button', { name: t('quotations.totals.addTaxClass'), exact: true }).click()
      expect(editor.quotation.value.totalsConfig.taxClasses).toHaveLength(2)
      const addedClassId = editor.quotation.value.totalsConfig.taxClasses!.at(-1)!.id
      await control(`[data-history-target="totals:taxClass:${addedClassId}:label"] input`).fill('Synthetic VAT')
      await control(`[data-history-target="totals:taxClass:${addedClassId}:rate"] input`).fill('10')
      await userEvent.tab()
      await page.getByRole('button', { name: t('quotations.totals.makeDefaultTaxClass'), exact: true }).click()
      expect(editor.quotation.value.totalsConfig.defaultTaxClassId).toBe(addedClassId)
      expect(editor.quotation.value.totalsConfig.taxClasses!.at(-1)).toMatchObject({ label: 'Synthetic VAT', rate: 10 })
      const firstColumn = wrapper.get<HTMLInputElement>('.mixed-tax-column-option input')
      const initialColumnSelection = firstColumn.element.checked
      await page.elementLocator(firstColumn.element).click()
      expect(firstColumn.element.checked).toBe(!initialColumnSelection)

      await page.getByRole('button', { name: t('quotations.totals.addExtraCharge'), exact: true }).click()
      const chargeId = editor.quotation.value.totalsConfig.extraCharges![0]!.id
      await control(`[data-history-target="totals:extraCharge:${chargeId}:label"] input`).fill('Synthetic delivery')
      await control(`[data-history-target="totals:extraCharge:${chargeId}:amount"] input`).fill('250')
      await userEvent.tab()
      await vi.waitFor(() => expect(editor.quotation.value.totalsConfig.extraCharges![0]).toMatchObject({ label: 'Synthetic delivery', amount: 250 }))
      const totalWithCharge = editor.totals.value.grandTotal
      await page.getByRole('button', { name: t('quotations.totals.deleteExtraChargeAria', { label: 'Synthetic delivery' }), exact: true }).click()
      expect(editor.quotation.value.totalsConfig.extraCharges).toHaveLength(0)
      expect(totalWithCharge - editor.totals.value.grandTotal).toBe(250)
      await page.getByRole('button', { name: t('quotations.totals.deleteTaxClassAria', { label: 'Synthetic VAT' }), exact: true }).click()
      expect(editor.quotation.value.totalsConfig.taxClasses).toHaveLength(1)
      await control('[data-history-target="totals:taxMode"] [role="combobox"]').click()
      await page.getByRole('option', { name: t('quotations.totals.taxModes.single'), exact: true }).click()
      expect(editor.quotation.value.totalsConfig.taxMode).toBe('single')
      await control('[data-history-target="totals:taxRate"] input').fill('7')
      await userEvent.tab()
      await vi.waitFor(() => expect(editor.quotation.value.totalsConfig.taxClasses![0]!.rate).toBe(7))
    } finally {
      cleanup()
    }
  }, 20_000)

  it('edits FX rates, cancels or confirms adding currencies, removes them and handles online fetch success and failure', async () => {
    await page.viewport(1200, 750)
    const { editor, t, cleanup } = mountControls(editor => h(ExchangeRatePanel, {
      exchangeRates: editor.quotation.value.exchangeRates,
      quotationCurrency: 'USD',
      onUpdateRate: editor.updateExchangeRate,
      onUpdateRates: editor.updateExchangeRates,
      onAddCurrency: editor.addExchangeRate,
      onRemoveCurrency: editor.removeExchangeRate,
    }))
    try {
      await page.getByRole('spinbutton', { name: t('quotations.exchangeRates.pair', { source: 'EUR', currency: 'USD' }), exact: true }).fill('1.2')
      await userEvent.tab()
      await vi.waitFor(() => expect(editor.quotation.value.exchangeRates.EUR).toBe(1.2))
      await page.getByRole('button', { name: t('quotations.exchangeRates.addCurrency'), exact: true }).click()
      await page.getByRole('button', { name: t('quotations.exchangeRates.cancelAdd'), exact: true }).click()
      expect(editor.quotation.value.exchangeRates.JPY).toBeUndefined()
      await page.getByRole('button', { name: t('quotations.exchangeRates.addCurrency'), exact: true }).click()
      await page.getByRole('combobox').click()
      await page.getByRole('searchbox').fill('JPY')
      await page.getByRole('option', { name: 'JPY - Japanese Yen', exact: true }).click()
      await page.getByRole('button', { name: t('quotations.exchangeRates.confirmAdd'), exact: true }).click()
      expect(editor.quotation.value.exchangeRates.JPY).toBeGreaterThan(0)
      await page.getByRole('button', { name: t('quotations.exchangeRates.removeAria', { currency: 'JPY' }), exact: true }).click()
      expect(editor.quotation.value.exchangeRates.JPY).toBeUndefined()

      vi.mocked(fetchLatestExchangeRates).mockResolvedValueOnce({ rates: { USD: 1, EUR: 1.1, CNY: 0.15 }, date: '2026-10-15', missingCurrencies: [] })
      await page.getByRole('button', { name: t('quotations.exchangeRates.fetchLatest'), exact: true }).click()
      await vi.waitFor(() => expect(editor.quotation.value.exchangeRates.EUR).toBe(1.1))
      vi.mocked(fetchLatestExchangeRates).mockRejectedValueOnce(new Error('Synthetic offline response'))
      await page.getByRole('button', { name: t('quotations.exchangeRates.fetchLatest'), exact: true }).click()
      await expect.element(page.getByRole('alert')).toHaveTextContent(t('quotations.exchangeRates.fetchError'))
      expect(editor.quotation.value.exchangeRates.EUR).toBe(1.1)
    } finally {
      cleanup()
    }
  }, 20_000)

  it('expands analysis scopes, pages through every item and drills into the final item', async () => {
    await page.viewport(1400, 900)
    const selectItem = vi.fn()
    const { wrapper, t, cleanup } = mountControls(editor => h(QuotationAnalysisView, {
      analysis: createQuotationAnalysisDataset(editor.quotation.value, editor.itemSummaries.value, editor.totals.value),
      currency: 'USD',
      onSelectItem: selectItem,
    }), true, 1250)
    try {
      for (const scope of ['markup', 'revenueProfit', 'costDistribution', 'marginTable']) {
        const toggle = page.elementLocator(wrapper.get(`[data-scope-key="${scope}"]`).element)
        await toggle.click()
        await expect.element(toggle).toHaveAttribute('aria-expanded', 'true')
        const card = wrapper.get(`[data-scope-key="${scope}"]`).element.closest('.analysis-card')!
        const browser = page.elementLocator(card.querySelector('.scope-browser')!)
        expect(card.querySelectorAll('.scope-browser-row')).toHaveLength(80)
        await browser.getByRole('button', { name: t('quotations.analysis.scope.next'), exact: true }).click()
        await expect.element(browser).toHaveTextContent('81')
        await browser.getByRole('button', { name: t('quotations.analysis.scope.previous'), exact: true }).click()
        for (let index = 0; index < 5; index += 1) {
          await browser.getByRole('button', { name: t('quotations.analysis.scope.next'), exact: true }).click()
        }
        await expect.element(browser.getByRole('button', { name: t('quotations.analysis.scope.next'), exact: true })).toBeDisabled()
        expect(card.querySelectorAll('.scope-browser-row')).toHaveLength(4)
        await page.elementLocator(card.querySelector('[data-item-id="synthetic-404"]')!).click()
        expect(selectItem).toHaveBeenLastCalledWith({ itemId: 'synthetic-404' })
        await toggle.click()
        expect(card.querySelector('.scope-browser')).toBeNull()
      }
    } finally {
      cleanup()
    }
  }, 25_000)
})
