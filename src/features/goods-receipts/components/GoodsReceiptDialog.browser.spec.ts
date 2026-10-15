import Aura from '@primevue/themes/aura'
import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import Tooltip from 'primevue/tooltip'
import { describe, expect, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import '@/assets/main.css'
import { createAppI18n } from '@/shared/i18n/createAppI18n'
import { createInitialQuotation } from '@/features/quotations/utils/quotationDraft'
import { createQuotationItem } from '@/features/quotations/utils/quotationItems'

import GoodsReceiptDialog from './GoodsReceiptDialog.vue'
import GoodsReceiptItemsEditor from './GoodsReceiptItemsEditor.vue'
import type { GoodsReceiptDraft } from '../utils/goodsReceipt'

function createLargeQuotation() {
  const quotation = createInitialQuotation([], 'en-US', { quotationNumber: 'QA-404' })
  quotation.header.customerCompany = 'Test customer'
  quotation.majorItems = Array.from({ length: 4 }, (_, root) => createQuotationItem('USD', {
    name: `Group ${root + 1}`,
    children: Array.from({ length: 100 }, (_, child) => createQuotationItem('USD', {
      name: `Part ${root + 1}-${child + 1}`, quantity: 2, unitCost: 25,
    })),
  }))
  return quotation
}

describe('GoodsReceiptDialog controls with a 404-item quotation', () => {
  it('initializes the editor when first mounted already open', async () => {
    await page.viewport(1440, 900)
    const host = document.createElement('div')
    document.body.appendChild(host)
    const i18n = createAppI18n('en-US')
    const wrapper = mount(GoodsReceiptDialog, {
      attachTo: host,
      props: { visible: true, quotation: createLargeQuotation(), supportsDirectPdfExport: true },
      global: {
        plugins: [i18n, [PrimeVue, { theme: { preset: Aura } }]],
        directives: { tooltip: Tooltip },
        stubs: { transition: false },
      },
    })
    try {
      await vi.waitFor(() => expect(document.querySelector('.goods-receipt-dialog')).not.toBeNull())
      await expect.element(page.getByRole('button', { name: i18n.global.t('goodsReceipts.actions.exportPdf'), exact: true })).toBeEnabled()
    } finally {
      wrapper.unmount()
      host.remove()
    }
  })

  it.each(['en-US', 'zh-CN'] as const)('keeps %s receipt selection, customization, template and output controls usable', async locale => {
    await page.viewport(1440, 900)
    window.localStorage.removeItem('quotation-software:goods-receipt-template')
    const host = document.createElement('div')
    document.body.appendChild(host)
    const quotation = createLargeQuotation()
    const i18n = createAppI18n(locale)
    const t = i18n.global.t
    const wrapper = mount(GoodsReceiptDialog, {
      attachTo: host,
      props: { visible: false, quotation, supportsDirectPdfExport: true },
      global: {
        plugins: [i18n, [PrimeVue, { theme: { preset: Aura } }]],
        directives: { tooltip: Tooltip },
        stubs: { transition: false },
      },
    })
    const selectedCount = () => wrapper.getComponent(GoodsReceiptItemsEditor).props('modelValue')!.filter(line => line.selected).length
    const outputButton = () => page.getByRole('button', { name: t('goodsReceipts.actions.exportPdf'), exact: true })
    async function choosePreset(preset: 'summary' | 'grouped' | 'detailed') {
      await userEvent.click(document.querySelector<HTMLElement>('.goods-receipt-preset-field .p-select')!)
      await page.getByRole('option', { name: t(`goodsReceipts.presets.${preset}`), exact: true }).click()
    }

    try {
      await wrapper.setProps({ visible: true })
      await expect.element(outputButton()).toBeEnabled()
      expect(selectedCount()).toBe(400)
      expect(document.querySelectorAll('[role="treeitem"]')).toHaveLength(4)

      await userEvent.click(document.querySelector<HTMLElement>('.goods-receipt-template-field .p-select')!)
      await vi.waitFor(() => {
        const popup = document.querySelector<HTMLElement>('.p-select-overlay')!
        expect(popup).not.toBeNull()
        const rect = popup.getBoundingClientRect()
        expect(rect.right).toBeLessThanOrEqual(window.innerWidth)
        expect(rect.bottom).toBeLessThanOrEqual(window.innerHeight)
        const center = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
        expect(center !== null && popup.contains(center)).toBe(true)
      })
      await page.getByRole('option', { name: t('goodsReceipts.templates.compact'), exact: true }).click()
      await page.getByRole('button', { name: t('goodsReceipts.actions.expandAll'), exact: true }).click()
      await vi.waitFor(() => expect(document.querySelectorAll('[role="treeitem"]')).toHaveLength(404))
      await page.getByRole('button', { name: t('goodsReceipts.actions.collapseAll'), exact: true }).click()
      await vi.waitFor(() => expect(document.querySelectorAll('[role="treeitem"]')).toHaveLength(4))

      const search = page.getByRole('textbox', { name: t('goodsReceipts.outline.searchAria'), exact: true })
      await search.fill('Part 4-100')
      await page.getByRole('button', { name: t('goodsReceipts.customizer.editAria', { itemNumber: '4.100', description: 'Part 4-100' }), exact: true }).click()
      const quantityInput = document.querySelector<HTMLInputElement>('.goods-receipt-customizer .p-inputnumber-input')!
      await userEvent.fill(quantityInput, '5')
      await userEvent.tab()
      const activeLine = () => wrapper.getComponent(GoodsReceiptItemsEditor).props('modelValue')!.find(line => line.sourceItemNumber === '4.100')!
      await vi.waitFor(() => expect(activeLine().quantity).toBe(5))
      await page.getByRole('button', { name: t('goodsReceipts.customizer.reset'), exact: true }).click()
      expect(activeLine().quantity).toBe(2)
      await page.getByRole('button', { name: t('goodsReceipts.customizer.close'), exact: true }).click()
      expect(document.querySelector('.goods-receipt-customizer')).toBeNull()
      await search.fill('')

      await page.getByRole('button', { name: t('goodsReceipts.actions.excludeAll'), exact: true }).click()
      expect(selectedCount()).toBe(0)
      await expect.element(outputButton()).toBeDisabled()
      for (const preset of ['summary', 'grouped', 'detailed'] as const) {
        await choosePreset(preset)
        expect(selectedCount()).toBe(preset === 'summary' ? 4 : 400)
      }
      await page.getByRole('button', { name: t('goodsReceipts.items.includedOnly'), exact: true }).click()
      await expect.element(page.getByRole('button', { name: t('goodsReceipts.items.includedOnly'), exact: true })).toHaveAttribute('aria-pressed', 'true')

      await outputButton().click()
      const exported = wrapper.emitted('exportPdf')![0]![0] as GoodsReceiptDraft
      expect(exported.lines).toHaveLength(404)
      expect(exported.lines.filter(line => line.selected)).toHaveLength(400)
      expect(exported.templateId).toBe('compact')
      await wrapper.setProps({ busy: true })
      await expect.element(outputButton()).toBeDisabled()
      await expect.element(page.getByRole('button', { name: t('goodsReceipts.actions.cancel'), exact: true })).toBeDisabled()
      await userEvent.keyboard('{Escape}')
      expect(wrapper.emitted('update:visible')).toBeUndefined()
      await wrapper.setProps({ busy: false, supportsDirectPdfExport: false })
      await page.getByRole('button', { name: t('goodsReceipts.actions.print'), exact: true }).click()
      expect(wrapper.emitted('exportPdf')).toHaveLength(2)
      await page.getByRole('button', { name: t('goodsReceipts.actions.cancel'), exact: true }).click()
      expect(wrapper.emitted('update:visible')).toEqual([[false]])
      expect(quotation.pendingGoodsReceiptDraft).toBeUndefined()
    } finally {
      wrapper.unmount()
      host.remove()
      window.localStorage.removeItem('quotation-software:goods-receipt-template')
    }
  })
})
