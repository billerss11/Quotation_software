// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, nextTick, reactive } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createAppI18n } from '@/shared/i18n/createAppI18n'

import { fetchLatestExchangeRates } from '../services/onlineExchangeRates'
import ExchangeRatePanel from './ExchangeRatePanel.vue'

vi.mock('../services/onlineExchangeRates', () => ({
  fetchLatestExchangeRates: vi.fn(),
}))

const fetchLatestExchangeRatesMock = vi.mocked(fetchLatestExchangeRates)

describe('ExchangeRatePanel buffering', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    fetchLatestExchangeRatesMock.mockReset()
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

  it('fetches current rates and emits one table update', async () => {
    fetchLatestExchangeRatesMock.mockResolvedValue({
      date: '2026-07-16',
      rates: {
        USD: 1,
        EUR: 1.08,
      },
      missingCurrencies: [],
    })
    const wrapper = mountExchangeRatePanel()

    await wrapper.findAll('button').find((button) => button.text() === 'Fetch latest rates')?.trigger('click')
    await flushPromises()

    expect(fetchLatestExchangeRatesMock).toHaveBeenCalledWith('USD', ['USD', 'EUR'])
    expect(wrapper.emitted('updateRates')).toEqual([[
      {
        USD: 1,
        EUR: 1.08,
      },
    ]])
    expect(wrapper.text()).toContain('Using Frankfurter rates dated Jul 16, 2026.')
  })

  it('keeps existing rates and shows an error when fetching fails', async () => {
    fetchLatestExchangeRatesMock.mockRejectedValue(new Error('offline'))
    const wrapper = mountExchangeRatePanel()

    await wrapper.findAll('button').find((button) => button.text() === 'Fetch latest rates')?.trigger('click')
    await flushPromises()

    expect(wrapper.emitted('updateRates')).toBeUndefined()
    expect(wrapper.text()).toContain('Could not fetch rates. Check your internet connection and try again.')
  })

  it('ignores a fetched table when the current rate table changes before the response', async () => {
    const request = createDeferred<Awaited<ReturnType<typeof fetchLatestExchangeRates>>>()
    fetchLatestExchangeRatesMock.mockReturnValue(request.promise)
    const wrapper = mountExchangeRatePanel()

    await wrapper.findAll('button').find((button) => button.text() === 'Fetch latest rates')?.trigger('click')
    await wrapper.setProps({
      exchangeRates: {
        USD: 1,
      },
    })
    request.resolve({
      date: '2026-07-16',
      rates: {
        USD: 1,
        EUR: 1.08,
      },
      missingCurrencies: [],
    })
    await flushPromises()

    expect(wrapper.emitted('updateRates')).toBeUndefined()
    expect(wrapper.text()).not.toContain('Using Frankfurter rates dated')
  })

  it('ignores a fetched table after a newer buffered edit', async () => {
    const request = createDeferred<Awaited<ReturnType<typeof fetchLatestExchangeRates>>>()
    fetchLatestExchangeRatesMock.mockReturnValue(request.promise)
    const wrapper = mountExchangeRatePanel()

    await wrapper.findAll('button').find((button) => button.text() === 'Fetch latest rates')?.trigger('click')
    wrapper.findAllComponents({ name: 'InputNumber' })[1]?.vm.$emit('update:model-value', 0.95)
    await nextTick()
    request.resolve({
      date: '2026-07-16',
      rates: {
        USD: 1,
        EUR: 1.08,
      },
      missingCurrencies: [],
    })
    await flushPromises()

    expect(wrapper.emitted('updateRates')).toBeUndefined()
  })
})

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })

  return { promise, resolve, reject }
}

function mountExchangeRatePanel() {
  return mount(ExchangeRatePanel, {
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
          props: ['label', 'disabled', 'loading'],
          emits: ['click'],
          template: '<button type="button" :disabled="disabled" @click="$emit(\'click\')">{{ label }}<slot /></button>',
        }),
        InputNumber: defineComponent({
          name: 'InputNumber',
          emits: ['update:model-value', 'blur'],
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
}

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
