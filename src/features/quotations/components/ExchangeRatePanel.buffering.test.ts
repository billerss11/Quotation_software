// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { defineComponent, reactive } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createAppI18n } from '@/shared/i18n/createAppI18n'

import ExchangeRatePanel from './ExchangeRatePanel.vue'

describe('ExchangeRatePanel buffering', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('buffers exchange-rate edits before emitting them to the quote', async () => {
    const wrapper = mount(createExchangeRatePanelHost(), {
      global: {
        plugins: [createAppI18n('en-US')],
        stubs: {
          Button: defineComponent({
            name: 'Button',
            emits: ['click'],
            template: '<button type="button" @click="$emit(\'click\')"><slot /></button>',
          }),
          InputText: defineComponent({
            name: 'InputText',
            emits: ['update:model-value', 'keyup.enter', 'keyup.escape'],
            template: '<div />',
          }),
          InputNumber: defineComponent({
            name: 'InputNumber',
            emits: ['update:model-value', 'blur'],
            template: '<div />',
          }),
        },
      },
    })

    const inputNumbers = wrapper.findAllComponents({ name: 'InputNumber' })
    const editableRateInput = inputNumbers[1]

    editableRateInput?.vm.$emit('update:model-value', 0.95)
    await wrapper.vm.$nextTick()

    expect(wrapper.get('[data-testid="eur-rate"]').text()).toBe('0.9')

    vi.advanceTimersByTime(160)
    await wrapper.vm.$nextTick()

    expect(wrapper.get('[data-testid="eur-rate"]').text()).toBe('0.95')
  })
})

function createExchangeRatePanelHost() {
  return defineComponent({
    components: { ExchangeRatePanel },
    setup() {
      const exchangeRates = reactive<Record<string, number>>({
        USD: 1,
        EUR: 0.9,
      })

      function updateRate(currency: string, rate: number) {
        exchangeRates[currency] = rate
      }

      return {
        exchangeRates,
        updateRate,
      }
    },
    template: `
      <div>
        <ExchangeRatePanel
          :exchange-rates="exchangeRates"
          quotation-currency="USD"
          @update-rate="updateRate"
          @add-currency="() => undefined"
          @remove-currency="() => undefined"
        />
        <span data-testid="eur-rate">{{ exchangeRates.EUR }}</span>
      </div>
    `,
  })
}
