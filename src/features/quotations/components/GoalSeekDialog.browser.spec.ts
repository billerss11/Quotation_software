import Aura from '@primevue/themes/aura'
import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import { describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import '@/assets/main.css'
import { createAppI18n } from '@/shared/i18n/createAppI18n'

import { calculateQuotationTotals } from '../utils/quotationCalculations'
import { isQuotationItem } from '../utils/quotationItems'
import { createLargeControlsQuotation } from './__fixtures__/largeQuotationControls'
import GoalSeekDialog from './GoalSeekDialog.vue'

function mountDialog(mode: 'items' | 'quotation') {
  const quotation = createLargeControlsQuotation()
  const i18n = createAppI18n('en-US')
  const wrapper = mount(GoalSeekDialog, {
    attachTo: document.body,
    props: {
      visible: false,
      mode,
      items: quotation.majorItems,
      currency: 'USD',
      exchangeRates: quotation.exchangeRates,
      globalMarkupRate: quotation.totalsConfig.globalMarkupRate,
      totalsConfig: quotation.totalsConfig,
      totals: calculateQuotationTotals(quotation.majorItems, quotation.totalsConfig, quotation.exchangeRates),
    },
    global: {
      plugins: [i18n, [PrimeVue, { theme: { preset: Aura } }]],
      stubs: { transition: false },
    },
  })
  return { wrapper, quotation, t: i18n.global.t }
}

describe('GoalSeekDialog with 404 quotation items', () => {
  it('selects and clears the batch, edits the first and last lines, applies once and cancels a reopened dialog', async () => {
    await page.viewport(1000, 720)
    const { wrapper, quotation, t } = mountDialog('items')
    try {
      await wrapper.setProps({ visible: true })
      const dialog = page.getByRole('dialog', { name: t('quotations.goalSeek.itemTitle'), exact: true })
      await expect.element(dialog).toBeVisible()
      expect(document.querySelectorAll('.goal-seek-table tbody tr')).toHaveLength(400)
      const apply = dialog.getByRole('button', { name: t('quotations.goalSeek.apply'), exact: true })
      await expect.element(apply).toBeDisabled()
      await dialog.getByRole('button', { name: t('quotations.goalSeek.selectAll'), exact: true }).click()
      expect(document.querySelectorAll('.goal-seek-table input[type="checkbox"]:checked')).toHaveLength(400)
      await expect.element(apply).toBeDisabled()
      await dialog.getByRole('button', { name: t('quotations.goalSeek.unselectAll'), exact: true }).click()
      expect(document.querySelectorAll('.goal-seek-table input[type="checkbox"]:checked')).toHaveLength(0)

      await dialog.getByRole('checkbox', {
        name: t('quotations.goalSeek.selectItemAria', { itemNumber: '4.100' }), exact: true,
      }).click()
      const target = dialog.getByRole('spinbutton', { name: `${t('quotations.goalSeek.targetUnitPrice')} 4.100`, exact: true })
      await target.fill('125')
      await userEvent.tab()
      await expect.element(apply).toBeEnabled()
      const tablePort = document.querySelector<HTMLElement>('.goal-seek-table-wrap')!
      expect(tablePort.scrollTop).toBeGreaterThan(0)
      await dialog.getByRole('checkbox', {
        name: t('quotations.goalSeek.selectItemAria', { itemNumber: '1.1' }), exact: true,
      }).click()
      await expect.element(apply).toBeDisabled()
      await dialog.getByRole('spinbutton', { name: `${t('quotations.goalSeek.targetUnitPrice')} 1.1`, exact: true }).fill('120')
      await userEvent.tab()
      await expect.element(apply).toBeEnabled()
      const bounds = dialog.element().getBoundingClientRect()
      expect(bounds.top).toBeGreaterThanOrEqual(0)
      expect(bounds.bottom).toBeLessThanOrEqual(window.innerHeight)
      await apply.click()
      expect(wrapper.emitted('applyItems')?.[0]?.[0]).toEqual([
        { itemId: 'synthetic-1-1', markupRate: expect.closeTo(20, 2) },
        { itemId: 'synthetic-4-100', markupRate: expect.closeTo(25, 2) },
      ])
      expect(wrapper.emitted('update:visible')?.at(-1)).toEqual([false])
      expect(quotation.majorItems.filter(isQuotationItem)[3]!.children[99]!.markupRate).toBeUndefined()

      await wrapper.setProps({ visible: false })
      await wrapper.setProps({ visible: true })
      expect(document.querySelectorAll('.goal-seek-table input[type="checkbox"]:checked')).toHaveLength(0)
      await dialog.getByRole('button', { name: t('quotations.goalSeek.cancel'), exact: true }).click()
      expect(wrapper.emitted('applyItems')).toHaveLength(1)
      expect(wrapper.emitted('update:visible')?.at(-1)).toEqual([false])
    } finally {
      wrapper.unmount()
    }
  }, 20_000)

  it('changes target bases, calculates global markup and applies or cancels without changing the input quotation', async () => {
    await page.viewport(900, 700)
    const { wrapper, quotation, t } = mountDialog('quotation')
    try {
      await wrapper.setProps({ visible: true })
      const dialog = page.getByRole('dialog', { name: t('quotations.goalSeek.quotationTitle'), exact: true })
      await expect.element(dialog).toBeVisible()
      for (const basis of ['quotationTotal', 'totalAfterTax', 'subtotalBeforeTax'] as const) {
        await dialog.getByRole('combobox', { name: t('quotations.goalSeek.targetBasis'), exact: true }).click()
        await page.getByRole('option', { name: t(`quotations.goalSeek.targets.${basis}`), exact: true }).click()
      }
      await dialog.getByRole('spinbutton').fill('48000')
      await userEvent.tab()
      const apply = dialog.getByRole('button', { name: t('quotations.goalSeek.apply'), exact: true })
      await expect.element(apply).toBeEnabled()
      await apply.click()
      expect(wrapper.emitted('applyQuotation')?.[0]?.[0]).toBeCloseTo(20, 2)
      expect(quotation.totalsConfig.globalMarkupRate).toBe(10)
      await wrapper.setProps({ visible: false })
      await wrapper.setProps({ visible: true })
      await dialog.getByRole('button', { name: t('quotations.goalSeek.cancel'), exact: true }).click()
      expect(wrapper.emitted('applyQuotation')).toHaveLength(1)
    } finally {
      wrapper.unmount()
    }
  })
})
