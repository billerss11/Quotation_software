import Aura from '@primevue/themes/aura'
import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import { describe, expect, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { defineComponent, h, type VNode } from 'vue'

import '@/assets/main.css'
import { createAppI18n } from '@/shared/i18n/createAppI18n'
import type { SupportedLocale } from '@/shared/i18n/locale'

import { useQuotationEditor } from '../composables/useQuotationEditor'
import type { QuotationInformationalTotal } from '../types'
import { getQuotationSections, getQuotationSummaryItems } from '../utils/quotationSummaryDisplay'
import { createLargeControlsQuotation } from './__fixtures__/largeQuotationControls'
import FloatingPreviewWindow from './FloatingPreviewWindow.vue'
import QuotationDocumentSettings from './QuotationDocumentSettings.vue'
import QuotationReviewWorkspace from './QuotationReviewWorkspace.vue'
import QuotationSummarySettings from './QuotationSummarySettings.vue'

type Editor = ReturnType<typeof useQuotationEditor>

function previewProps(editor: Editor) {
  return {
    quotation: editor.quotation.value,
    summaries: editor.itemSummaries.value,
    totals: editor.totals.value,
    globalMarkupRate: editor.quotation.value.totalsConfig.globalMarkupRate,
    exchangeRates: editor.quotation.value.exchangeRates,
    companyProfile: editor.quotation.value.companyProfileSnapshot,
    supportsDirectPdfExport: false,
  }
}

function mountDocument(render: (editor: Editor) => VNode) {
  const host = document.createElement('div')
  host.style.cssText = 'position: fixed; top: 16px; left: 16px; width: 1200px; height: 760px;'
  document.body.appendChild(host)
  let editor!: Editor
  const i18n = createAppI18n('en-US')
  const wrapper = mount(defineComponent({
    setup() {
      editor = useQuotationEditor()
      editor.replaceQuotationDraft(createLargeControlsQuotation())
      return () => h('div', { style: 'height: 760px; min-height: 0;' }, [render(editor)])
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

describe('Document controls with 404 quotation items', () => {
  it('changes template, language and detail, filters and edits a summary selection, and scrolls to the final preview row', async () => {
    await page.viewport(1440, 900)
    const { editor, wrapper, t, cleanup } = mountDocument(editor => h(QuotationReviewWorkspace, previewProps(editor), {
      default: () => h(QuotationDocumentSettings, {
        templateId: editor.quotation.value.templateId,
        documentLocale: editor.quotation.value.header.documentLocale,
        outputItemDetailLevel: editor.quotation.value.outputSettings!.itemDetailLevel,
        'onUpdate:templateId': editor.setTemplateId,
        'onUpdate:documentLocale': (value: SupportedLocale) => editor.updateHeaderField('documentLocale', value),
        'onUpdate:outputItemDetailLevel': editor.setOutputItemDetailLevel,
      }, {
        default: () => h(QuotationSummarySettings, {
          settings: editor.quotation.value.outputSettings,
          sections: getQuotationSections(editor.quotation.value.majorItems, editor.itemSummaries.value),
          items: getQuotationSummaryItems(editor.quotation.value, editor.itemSummaries.value),
          currency: 'USD',
          documentLocale: editor.quotation.value.header.documentLocale,
          onUpdateSettings: editor.setOutputSettings,
          onAddRow: (row: QuotationInformationalTotal) => editor.setOutputSettings({ informationalTotals: [...(editor.quotation.value.outputSettings?.informationalTotals ?? []), row] }),
          onUpdateRow: (id: string, patch: Partial<QuotationInformationalTotal>) => editor.setOutputSettings({ informationalTotals: editor.quotation.value.outputSettings!.informationalTotals!.map(row => row.id === id ? { ...row, ...patch } : row) }),
          onRemoveRow: (id: string) => editor.setOutputSettings({ informationalTotals: editor.quotation.value.outputSettings!.informationalTotals!.filter(row => row.id !== id) }),
        }),
      }),
    }))
    const control = (selector: string) => page.elementLocator(wrapper.get(selector).element)
    try {
      await control('[data-history-target="quotation:templateId"] [role="combobox"]').click()
      await page.getByRole('option', { name: new RegExp(t('quotations.templates.spreadsheet.label')) }).click()
      expect(editor.quotation.value.templateId).toBe('spreadsheet')
      await control('[data-history-target="header:documentLocale"] [role="combobox"]').click()
      await page.getByRole('option', { name: t('common.locales.zh-CN'), exact: true }).click()
      expect(editor.quotation.value.header.documentLocale).toBe('zh-CN')
      await control('[data-history-target="quotation:outputSettings"] [role="combobox"]').click()
      await page.getByRole('option', { name: t('quotations.headerForm.outputItemDetailLevels.level1'), exact: true }).click()
      expect(editor.quotation.value.outputSettings!.itemDetailLevel).toBe(1)
      await control('[data-history-target="quotation:outputSettings"] [role="combobox"]').click()
      await page.getByRole('option', { name: t('quotations.headerForm.outputItemDetailLevels.level3'), exact: true }).click()

      await page.getByRole('checkbox', { name: t('quotations.summaryDisplay.showBreakdown'), exact: true }).click()
      await page.getByRole('button', { name: t('quotations.summaryDisplay.addRow'), exact: true }).click()
      const rowId = editor.quotation.value.outputSettings!.informationalTotals![0]!.id
      await control(`[data-summary-row="${rowId}"] .p-multiselect`).click()
      const overlay = document.querySelector<HTMLElement>('.p-multiselect-overlay')!
      expect(overlay.getBoundingClientRect().right).toBeLessThanOrEqual(window.innerWidth)
      expect(overlay.getBoundingClientRect().bottom).toBeLessThanOrEqual(window.innerHeight)
      await page.getByRole('searchbox').fill('Synthetic item 4.100')
      await page.getByRole('option', { name: /Synthetic item 4\.100/ }).click()
      await userEvent.keyboard('{Escape}')
      expect(editor.quotation.value.outputSettings!.informationalTotals![0]!.itemIds).toEqual(['synthetic-4-100'])
      expect(wrapper.get('.calculated-amount').text()).toContain('110.00')
      await control(`[data-summary-row="${rowId}"] input[type="text"]`).fill('Synthetic breakdown')
      await control('.summary-settings > .field input').fill('Synthetic subtotal')
      await userEvent.tab()
      await vi.waitFor(() => expect(editor.quotation.value.outputSettings!.subtotalLabel).toBe('Synthetic subtotal'))
      await control('.summary-settings textarea').fill('Synthetic note')
      await userEvent.tab()
      await vi.waitFor(() => expect(editor.quotation.value.outputSettings).toMatchObject({ subtotalLabel: 'Synthetic subtotal', informationalTotalsNote: 'Synthetic note' }))
      await page.getByRole('checkbox', { name: t('quotations.summaryDisplay.showRow'), exact: true }).click()
      expect(editor.quotation.value.outputSettings!.informationalTotals![0]!.visible).toBe(false)
      await page.getByRole('button', { name: t('quotations.summaryDisplay.removeRow', { label: 'Synthetic breakdown' }), exact: true }).click()
      expect(editor.quotation.value.outputSettings!.informationalTotals).toHaveLength(0)
      await page.getByRole('checkbox', { name: t('quotations.summaryDisplay.showBreakdown'), exact: true }).click()
      expect(editor.quotation.value.outputSettings!.informationalTotalsNote).toBe('Synthetic note')

      const scrollPort = wrapper.get<HTMLElement>('.review-document-scroll').element
      scrollPort.scrollTop = scrollPort.scrollHeight
      scrollPort.dispatchEvent(new Event('scroll'))
      await vi.waitFor(() => expect(wrapper.find('tr[data-row-key="synthetic-4-100-sub"]').exists()).toBe(true))
    } finally {
      cleanup()
    }
  }, 20_000)

  it('keeps floating preview controls reachable in a short viewport and switches templates and zoom before printing or closing', async () => {
    await page.viewport(1000, 600)
    const close = vi.fn()
    const exportPdf = vi.fn()
    const { editor, wrapper, t, cleanup } = mountDocument(editor => h(FloatingPreviewWindow, {
      ...previewProps(editor),
      onClose: close,
      onExportPdf: exportPdf,
      onUpdateTemplateId: editor.setTemplateId,
    }))
    try {
      await vi.waitFor(() => {
        const frame = wrapper.get('.floating-preview').element.getBoundingClientRect()
        expect(frame.top).toBeGreaterThanOrEqual(0)
        expect(frame.bottom).toBeLessThanOrEqual(window.innerHeight)
        expect(frame.right).toBeLessThanOrEqual(window.innerWidth)
      })
      await controlTemplate()
      expect(editor.quotation.value.templateId).toBe('spreadsheet')
      await page.getByRole('button', { name: t('quotations.floatingPreview.actualSize'), exact: true }).click()
      await expect.element(page.getByRole('button', { name: t('quotations.floatingPreview.actualSize'), exact: true })).toHaveAttribute('aria-pressed', 'true')
      await page.getByRole('button', { name: t('quotations.floatingPreview.fitWidth'), exact: true }).click()
      await page.getByRole('button', { name: t('quotations.floatingPreview.printAria'), exact: true }).click()
      expect(exportPdf).toHaveBeenCalledOnce()
      await page.getByRole('button', { name: t('quotations.floatingPreview.closeAria'), exact: true }).click()
      expect(close).toHaveBeenCalledOnce()

      async function controlTemplate() {
        await page.elementLocator(wrapper.get('.template-selector [role="combobox"]').element).click()
        await page.getByRole('option', { name: new RegExp(t('quotations.templates.spreadsheet.label')) }).click()
      }
    } finally {
      cleanup()
    }
  }, 20_000)
})
