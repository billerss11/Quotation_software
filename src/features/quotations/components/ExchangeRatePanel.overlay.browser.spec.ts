import Aura from '@primevue/themes/aura'
import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import { describe, expect, it, vi } from 'vitest'
import { cdp, page, userEvent } from 'vitest/browser'

import '@/assets/main.css'
import { createAppI18n } from '@/shared/i18n/createAppI18n'

import ExchangeRatePanel from './ExchangeRatePanel.vue'

// Keep Playwright's Node ambient types out of this renderer TypeScript project.
const browserProtocol = cdp() as {
  send(method: string, params: { features: Array<{ name: string; value: string }> }): Promise<void>
}

describe('ExchangeRatePanel currency overlay', () => {
  it.each(['no-preference', 'reduce'])(
    'stays beside the selector on opening, hovering and filtering with motion preference %s',
    async (motionPreference) => {
      await page.viewport(1440, 900)
      await browserProtocol.send('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-reduced-motion', value: motionPreference }],
      })
      const host = document.createElement('div')
      host.style.cssText = 'position: fixed; right: 32px; top: 24px; width: 380px;'
      document.body.appendChild(host)
      const wrapper = mount(ExchangeRatePanel, {
        attachTo: host,
        props: {
          quotationCurrency: 'USD',
          exchangeRates: { USD: 1, CNY: 0.14, EUR: 1.08, GBP: 1.25 },
        },
        global: {
          plugins: [createAppI18n('en-US'), [PrimeVue, { theme: { preset: Aura } }]],
          stubs: { transition: false },
        },
      })

      const expectAligned = () => {
        const anchor = wrapper.get('.currency-select').element.getBoundingClientRect()
        const overlay = document.querySelector<HTMLElement>('.p-select-overlay')!.getBoundingClientRect()
        expect(Math.abs(overlay.left - anchor.left)).toBeLessThanOrEqual(2)
        expect(Math.abs(overlay.top - anchor.bottom)).toBeLessThanOrEqual(3)
      }
      const waitForOpening = async () => {
        await vi.waitFor(() => {
          expect(document.querySelector('.p-select-overlay')).not.toBeNull()
          expect(document.querySelector('.p-anchored-overlay-enter-active')).toBeNull()
        })
        expectAligned()
      }

      try {
        await page.getByRole('button', { name: 'Add currency', exact: true }).click()
        await page.getByRole('combobox').click()
        // Check before hovering: hover used to repair the incorrect initial position.
        await waitForOpening()
        await userEvent.hover(page.getByRole('option', { name: 'HKD - Hong Kong Dollar', exact: true }))
        expectAligned()
        await page.getByRole('searchbox').fill('JPY')
        await expect.element(page.getByRole('option')).toHaveTextContent('JPY - Japanese Yen')
        expectAligned()
        await page.getByRole('option', { name: 'JPY - Japanese Yen', exact: true }).click()
        await expect.element(page.getByRole('combobox')).toHaveTextContent('JPY - Japanese Yen')
        await page.getByRole('combobox').click()
        await waitForOpening()
      } finally {
        wrapper.unmount()
        host.remove()
        await browserProtocol.send('Emulation.setEmulatedMedia', { features: [] })
      }
    },
  )
})
