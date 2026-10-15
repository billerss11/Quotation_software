import Aura from '@primevue/themes/aura'
import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import { describe, expect, it, vi } from 'vitest'
import { page } from 'vitest/browser'

import '@/assets/main.css'
import { createAppI18n } from '@/shared/i18n/createAppI18n'

import { createQuotationItem } from '../utils/quotationItems'
import LineItemsTable from './LineItemsTable.vue'

describe('LineItemsTable Tools menu while scrolling', () => {
  it('keeps Tools on screen and usable inside a scrolled quotation panel', async () => {
    await page.viewport(1440, 900)
    const frame = document.createElement('div')
    frame.style.cssText = 'position: fixed; left: 240px; top: 80px; width: 1040px; height: 720px; display: flex; flex-direction: column; overflow: hidden;'
    const stageHeader = document.createElement('div')
    stageHeader.style.cssText = 'flex: 0 0 48px;'
    stageHeader.textContent = 'Items'
    const scrollContainer = document.createElement('div')
    scrollContainer.style.cssText = 'flex: 1; min-height: 0; overflow: auto; padding: 12px 14px 0;'
    frame.append(stageHeader, scrollContainer)
    document.body.appendChild(frame)
    const i18n = createAppI18n('en-US')
    const wrapper = mount(LineItemsTable, {
      attachTo: scrollContainer,
      props: {
        items: Array.from({ length: 404 }, (_, index) => createQuotationItem('USD', {
          id: `item-${index}`, name: `Item ${index + 1}`, quantityUnit: 'piece', unitCost: 100,
        })),
        scrollContainer, currency: 'USD', grandTotal: 44440, globalMarkupRate: 10,
        totalsConfig: {
          globalMarkupRate: 10, taxMode: 'single', defaultTaxClassId: 'standard',
          taxClasses: [{ id: 'standard', label: 'Standard 13%', rate: 13 }],
        },
        exchangeRates: { USD: 1 }, costCurrencyOptions: ['USD'], quotationCurrencyOptions: ['USD'],
      },
      global: {
        plugins: [i18n, [PrimeVue, { theme: { preset: Aura } }]],
        directives: { tooltip: {} },
        stubs: { transition: false },
      },
    })

    const openTools = async () => {
      await page.getByRole('button', { name: i18n.global.t('itemWorkspace.tools'), exact: true }).click()
      await vi.waitFor(() => {
        const menu = document.querySelector<HTMLElement>('#item-workspace-tools')
        expect(menu).not.toBeNull()
        expect(menu!.classList.contains('p-anchored-overlay-enter-active')).toBe(false)
        const bounds = menu!.getBoundingClientRect()
        const trigger = wrapper.get('[data-item-tools-toggle]').element.getBoundingClientRect()
        const panel = scrollContainer.getBoundingClientRect()
        expect(bounds.width).toBeGreaterThan(0)
        expect(bounds.top, 'menu must open below the visible sticky Tools button').toBeGreaterThanOrEqual(trigger.bottom - 2)
        expect(bounds.top - trigger.bottom, 'menu must stay anchored to Tools after opening').toBeLessThanOrEqual(4)
        expect(bounds.bottom, 'menu must stay inside the visible quotation panel').toBeLessThanOrEqual(panel.bottom)
        expect(bounds.left).toBeGreaterThanOrEqual(0)
        expect(bounds.right).toBeLessThanOrEqual(window.innerWidth)

        for (const action of menu!.querySelectorAll<HTMLElement>('[data-item-tool]')) {
          const actionBounds = action.getBoundingClientRect()
          const hit = document.elementFromPoint(
            actionBounds.left + actionBounds.width / 2,
            actionBounds.top + actionBounds.height / 2,
          )
          expect(hit !== null && action.contains(hit), `${action.dataset.itemTool} must receive a real pointer click`).toBe(true)
        }
      })
    }

    try {
      await document.fonts.ready
      scrollContainer.scrollTop = 2200
      scrollContainer.dispatchEvent(new Event('scroll'))
      await vi.waitFor(() => {
        expect(scrollContainer.scrollTop).toBeGreaterThan(2000)
        const heading = wrapper.get('.workbench-heading').element.getBoundingClientRect()
        expect(heading.top).toBeLessThan(scrollContainer.getBoundingClientRect().top + 1)
      })

      await openTools()
      await page.getByRole('menuitem', { name: i18n.global.t('quotations.goalSeek.openBatch'), exact: true }).click()
      expect(wrapper.emitted('requestBatchGoalSeek')).toEqual([[]])

      await openTools()
      await page.getByRole('menuitem', { name: i18n.global.t('quotations.lineItems.expandAll'), exact: true }).click()
      await vi.waitFor(() => expect(wrapper.find('.item-card-panel').exists()).toBe(true))

      await openTools()
      await page.getByRole('menuitem', { name: i18n.global.t('quotations.lineItems.collapseAll'), exact: true }).click()
      await vi.waitFor(() => expect(wrapper.find('.item-card-panel').exists()).toBe(false))

      await openTools()
      await page.getByRole('menuitem', { name: i18n.global.t('quotations.lineItems.calculationSheet.openQuotation'), exact: true }).click()
      await expect.element(page.getByRole('dialog')).toBeVisible()
      await expect.element(page.getByRole('dialog')).toHaveTextContent('Calculation Sheet')
    } finally {
      wrapper.unmount()
      frame.remove()
    }
  })
})
