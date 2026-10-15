import Aura from '@primevue/themes/aura'
import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import { describe, expect, it, vi } from 'vitest'
import { page } from 'vitest/browser'
import { nextTick } from 'vue'

import '@/assets/main.css'
import { createAppI18n } from '@/shared/i18n/createAppI18n'

import { QUOTATION_TEMPLATE_IDS } from '../templates/templateIds'
import { calculateMajorItemSummary, calculateQuotationTotals } from '../utils/quotationCalculations'
import { createInitialQuotation } from '../utils/quotationDraft'
import { isQuotationItem } from '../utils/quotationItems'
import QuotationReviewWorkspace from './QuotationReviewWorkspace.vue'

describe('QuotationReviewWorkspace inline preview', () => {
  it('fits all seven live templates and keeps zoom and output actions usable', async () => {
    await page.viewport(1440, 900)
    const host = document.createElement('div')
    host.style.cssText = 'position: fixed; left: 0; top: 0; width: 1120px; height: 700px;'
    document.body.appendChild(host)
    const quotation = createInitialQuotation([], 'en-US')
    const item = quotation.majorItems.find(isQuotationItem)!
    Object.assign(item, { name: 'Embedded review item', quantity: 3, unitCost: 25 })
    const i18n = createAppI18n('en-US')
    const wrapper = mount(QuotationReviewWorkspace, {
      attachTo: host,
      props: {
        quotation,
        summaries: [calculateMajorItemSummary(item, quotation.totalsConfig, quotation.exchangeRates)],
        totals: calculateQuotationTotals(quotation.majorItems, quotation.totalsConfig, quotation.exchangeRates),
        globalMarkupRate: quotation.totalsConfig.globalMarkupRate,
        exchangeRates: quotation.exchangeRates,
        companyProfile: quotation.companyProfileSnapshot,
        supportsDirectPdfExport: false,
      },
      slots: { default: '<p>Document settings</p>' },
      global: {
        plugins: [i18n, [PrimeVue, { theme: { preset: Aura } }]],
        directives: { tooltip: {} },
      },
    })

    try {
      await document.fonts.ready
      const scrollPort = wrapper.get<HTMLElement>('.review-document-scroll').element
      for (const templateId of QUOTATION_TEMPLATE_IDS) {
        await wrapper.setProps({ quotation: { ...quotation, templateId } })
        await vi.waitFor(() => {
          const documents = wrapper.findAll('.quotation-document')
          expect(documents).toHaveLength(1)
          expect(documents[0]!.classes()).toContain(`quotation-template-${templateId}`)
          expect(documents[0]!.text()).toContain('Embedded review item')
          expect(documents[0]!.element.getBoundingClientRect().width).toBeGreaterThan(0)
          expect(documents[0]!.element.getBoundingClientRect().width).toBeLessThanOrEqual(scrollPort.clientWidth - 47)
          expect(scrollPort.scrollWidth).toBeLessThanOrEqual(scrollPort.clientWidth + 1)
        })
      }

      const fittedWidth = wrapper.get('.review-document').element.getBoundingClientRect().width
      await page.getByRole('button', { name: i18n.global.t('workspace.actualSize'), exact: true }).click()
      await vi.waitFor(() => expect(wrapper.get('.review-document').element.getBoundingClientRect().width).toBeGreaterThan(fittedWidth))
      await page.getByRole('button', { name: i18n.global.t('workspace.fitWidth'), exact: true }).click()
      await nextTick()
      expect(wrapper.get('.review-document').element.getBoundingClientRect().width).toBeCloseTo(fittedWidth)

      await page.getByRole('button', { name: i18n.global.t('workspace.openPreview'), exact: true }).click()
      expect(wrapper.emitted('openPreview')).toHaveLength(1)
      await page.getByRole('button', { name: i18n.global.t('quotations.commandBar.print'), exact: true }).click()
      expect(wrapper.emitted('exportPdf')).toHaveLength(1)
    } finally {
      wrapper.unmount()
      host.remove()
    }
  })
})
