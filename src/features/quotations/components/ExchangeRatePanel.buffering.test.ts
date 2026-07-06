// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { defineComponent, nextTick, reactive } from 'vue'
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
          Select: defineComponent({
            name: 'Select',
            props: ['modelValue', 'options'],
            emits: ['update:model-value'],
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
    await nextTick()

    expect(wrapper.get('[data-testid="eur-rate"]').text()).toBe('0.9')

    vi.advanceTimersByTime(160)
    await nextTick()

    expect(wrapper.get('[data-testid="eur-rate"]').text()).toBe('0.95')
  })

  it('offers supported currencies that are not already in the rate table', async () => {
    const wrapper = mount(ExchangeRatePanel, {
      props: {
        exchangeRates: {
          USD: 1,
          EUR: 0.9,
        },
        quotationCurrency: 'USD',
      },
      global: {
        plugins: [createAppI18n('en-US')],
        stubs: {
          Button: defineComponent({
            name: 'Button',
            props: ['label'],
            emits: ['click'],
            template: '<button type="button" @click="$emit(\'click\')">{{ label }}<slot /></button>',
          }),
          InputNumber: defineComponent({
            name: 'InputNumber',
            emits: ['update:model-value', 'blur'],
            template: '<div />',
          }),
          InputText: defineComponent({
            name: 'InputText',
            emits: ['update:model-value', 'keyup.enter', 'keyup.escape'],
            template: '<div />',
          }),
          Select: defineComponent({
            name: 'Select',
            props: ['modelValue', 'options'],
            emits: ['update:model-value'],
            template: '<div />',
          }),
        },
      },
    })

    await wrapper.findAll('button').at(-1)?.trigger('click')

    const picker = wrapper.getComponent({ name: 'Select' })
    const optionValues = picker.props('options').map((option: { value: string }) => option.value)

    expect(optionValues).toContain('JPY')
    expect(optionValues).not.toContain('USD')
    expect(optionValues).not.toContain('EUR')

    picker.vm.$emit('update:model-value', 'JPY')
    await nextTick()
    await wrapper.findAll('button').find((button) => button.text() === 'Add')?.trigger('click')

    expect(wrapper.emitted('addCurrency')).toEqual([[ 'JPY' ]])
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
