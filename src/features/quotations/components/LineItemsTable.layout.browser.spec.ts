import Aura from '@primevue/themes/aura'
import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import { describe, expect, it } from 'vitest'

import '@/assets/main.css'
import { createAppI18n } from '@/shared/i18n/createAppI18n'
import type { SupportedLocale } from '@/shared/i18n/locale'

import { createQuotationItem } from '../utils/quotationItems'
import LineItemsTable from './LineItemsTable.vue'

describe('LineItemsTable editor layout', () => {
  it.each([
    [1200, 'en-US'], [950, 'en-US'], [900, 'en-US'], [800, 'en-US'], [700, 'en-US'],
    [1200, 'zh-CN'], [950, 'zh-CN'], [900, 'zh-CN'], [800, 'zh-CN'], [700, 'zh-CN'],
  ] as const)('keeps nested controls visible at %ipx in %s', async (width, locale) => {
    const host = document.createElement('div')
    host.style.cssText = `width: ${width}px; padding: 14px;`
    document.body.appendChild(host)
    const root = createQuotationItem('USD', {
      id: 'root', name: 'Pump package', quantityUnit: 'set',
      children: [createQuotationItem('USD', {
        id: 'group', name: 'Pump assembly', quantityUnit: 'set',
        children: [createQuotationItem('USD', {
          id: 'detail', name: 'Motor and coupling', quantityUnit: 'piece', unitCost: 12345.67,
        })],
      }), createQuotationItem('USD', {
        id: 'manual', name: 'Installation', quantityUnit: 'lot',
        pricingMethod: 'manual_price', manualUnitPrice: 300,
      })],
    })
    const wrapper = mount(LineItemsTable, {
      attachTo: host,
      props: {
        items: [root, createQuotationItem('USD', {
          id: 'standalone', name: 'Standalone valve', quantityUnit: 'piece', unitCost: 12345.67,
        })], currency: 'USD', grandTotal: 0, globalMarkupRate: 10,
        totalsConfig: {
          globalMarkupRate: 10, taxMode: 'mixed', defaultTaxClassId: 'standard',
          taxClasses: [{ id: 'standard', label: 'Standard 13%', rate: 13 }],
        },
        exchangeRates: { USD: 1, CNY: 7 },
        costCurrencyOptions: ['USD', 'CNY'], quotationCurrencyOptions: ['USD', 'CNY'],
      },
      global: {
        plugins: [createAppI18n(locale as SupportedLocale), [PrimeVue, { theme: { preset: Aura } }]],
        directives: { tooltip: {} },
      },
    })

    try {
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
      expect(wrapper.find('[data-item-id="detail"]').exists()).toBe(true)
      const card = wrapper.get('.item-card').element.getBoundingClientRect()
      const controls = wrapper.findAll('.item-control-grid, .ct-controls, .ct-results, .header-actions, .p-inputtext, .p-select')
      for (const control of controls) {
        const rect = control.element.getBoundingClientRect()
        if (rect.width === 0) continue
        expect(rect.left, control.classes().join(' ')).toBeGreaterThanOrEqual(card.left - 1)
        expect(rect.right, control.classes().join(' ')).toBeLessThanOrEqual(card.right + 1)
      }
      expect(host.scrollWidth).toBeLessThanOrEqual(host.clientWidth + 1)
      expect(wrapper.findAll('[data-summary-mode="unit"]')).toHaveLength(1)

      for (const label of wrapper.findAll('.p-select-label')) {
        const element = label.element as HTMLElement
        expect(element.scrollWidth, element.textContent ?? '').toBeLessThanOrEqual(element.clientWidth + 1)
      }

      await wrapper.get('[data-item-tools-toggle]').trigger('click')
      expect(wrapper.get('[data-item-tool="calculation-sheet"]').isVisible()).toBe(true)
      await wrapper.get('[data-item-tool="batch-goal-seek"]').trigger('click')
      expect(wrapper.emitted('requestBatchGoalSeek')).toEqual([[]])
    } finally {
      wrapper.unmount()
      host.remove()
    }
  })
})
