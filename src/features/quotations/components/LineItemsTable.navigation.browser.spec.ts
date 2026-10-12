import Aura from '@primevue/themes/aura'
import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import { describe, expect, it, vi } from 'vitest'

import '@/assets/main.css'
import { createAppI18n } from '@/shared/i18n/createAppI18n'

import { createQuotationItem } from '../utils/quotationItems'
import LineItemsTable from './LineItemsTable.vue'

describe('LineItemsTable structure navigation', () => {
  it.each([12, 120])('keeps the selected title below the sticky toolbar with %i root items', async (count) => {
    const scrollContainer = document.createElement('div')
    scrollContainer.style.cssText = 'height: 600px; width: 1100px; overflow: auto; padding: 12px 14px 0;'
    document.body.appendChild(scrollContainer)
    const targetId = `item-${count - 3}`
    const items = Array.from({ length: count }, (_, index) => createQuotationItem('USD', {
      id: `item-${index}`,
      name: `Item ${index + 1}`,
      unitCost: 100,
      children: [createQuotationItem('USD', {
        id: `child-${index}`,
        name: `Child ${index + 1}`,
        unitCost: 100,
      })],
    }))
    const wrapper = mount(LineItemsTable, {
      attachTo: scrollContainer,
      props: {
        items,
        scrollContainer,
        currency: 'USD',
        grandTotal: count * 100,
        globalMarkupRate: 10,
        totalsConfig: {
          globalMarkupRate: 10,
          taxMode: 'single',
          defaultTaxClassId: 'standard',
          taxClasses: [{ id: 'standard', label: 'Standard', rate: 13 }],
        },
        exchangeRates: { USD: 1 },
        costCurrencyOptions: ['USD'],
        quotationCurrencyOptions: ['USD'],
      },
      global: {
        plugins: [createAppI18n('en-US'), [PrimeVue, { theme: { preset: Aura } }]],
        directives: { tooltip: {} },
      },
    })

    try {
      await wrapper.setProps({ focusedItemId: targetId, focusedItemRequestKey: 1 })

      const expectVisibleTitle = () => {
        const title = wrapper.get(`[data-item-focus-anchor="${targetId}"]`).element.getBoundingClientRect()
        const toolbar = wrapper.get('.workbench-heading').element.getBoundingClientRect()
        const viewport = scrollContainer.getBoundingClientRect()
        expect(scrollContainer.scrollTop).toBeGreaterThan(0)
        expect(title.top - toolbar.bottom).toBeGreaterThanOrEqual(16)
        expect(title.bottom).toBeLessThan(viewport.bottom)
      }
      await vi.waitFor(expectVisibleTitle)

      // The toolbar wraps at narrower widths. Re-selecting the same item must
      // still leave its title visible below the resized sticky toolbar.
      scrollContainer.style.width = '700px'
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
      await wrapper.setProps({ focusedItemRequestKey: 2 })
      await vi.waitFor(expectVisibleTitle)

      await wrapper.setProps({ focusedItemId: `child-${count - 3}`, focusedItemRequestKey: 3 })
      await vi.waitFor(() => {
        const child = wrapper.get(`[data-item-id="child-${count - 3}"]`).element.getBoundingClientRect()
        const columnHeader = wrapper.get(`[data-item-id="${targetId}"] .ct-head`).element.getBoundingClientRect()
        expect(child.top).toBeGreaterThanOrEqual(columnHeader.bottom)
        expect(child.bottom).toBeLessThan(scrollContainer.getBoundingClientRect().bottom)
      })
    } finally {
      wrapper.unmount()
      scrollContainer.remove()
    }
  })
})
