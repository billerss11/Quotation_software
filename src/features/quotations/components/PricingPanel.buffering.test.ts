// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { defineComponent, nextTick, reactive } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createAppI18n } from '@/shared/i18n/createAppI18n'

import PricingPanel from './PricingPanel.vue'
import type { QuotationTotals, TotalsConfig } from '../types'

describe('PricingPanel buffering', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('buffers global markup edits before mutating totals config', async () => {
    const totalsConfig = createTotalsConfig()
    const wrapper = mount(createPricingPanelHost(totalsConfig), {
      global: createMountOptions(),
    })

    const inputNumbers = wrapper.findAllComponents({ name: 'InputNumber' })
    inputNumbers[0]?.vm.$emit('update:model-value', 25)
    await nextTick()

    expect(totalsConfig.globalMarkupRate).toBe(10)

    vi.advanceTimersByTime(160)
    await nextTick()

    expect(totalsConfig.globalMarkupRate).toBe(25)
  })

  it('flushes buffered single-tax edits on blur', async () => {
    const totalsConfig = createTotalsConfig()
    const wrapper = mount(createPricingPanelHost(totalsConfig), {
      global: createMountOptions(),
    })

    const inputNumbers = wrapper.findAllComponents({ name: 'InputNumber' })
    const taxRateInput = inputNumbers[2]

    taxRateInput?.vm.$emit('update:model-value', 8)
    taxRateInput?.vm.$emit('blur')
    await nextTick()

    expect(totalsConfig.taxClasses?.[0]?.rate).toBe(8)
  })

  it('renders mixed tax classes as editable list rows', () => {
    const totalsConfig = createTotalsConfig()
    totalsConfig.taxMode = 'mixed'
    totalsConfig.defaultTaxClassId = 'service'
    totalsConfig.taxClasses = [
      { id: 'standard', label: 'Standard', rate: 13 },
      { id: 'service', label: 'Service', rate: 6 },
      { id: 'education', label: 'Education', rate: 3 },
    ]

    const wrapper = mount(createPricingPanelHost(totalsConfig), {
      global: createMountOptions(),
    })

    expect(wrapper.findAll('[role="listitem"]')).toHaveLength(3)
  })

  it('updates saved mixed-tax document columns from checkbox choices', async () => {
    const totalsConfig = createTotalsConfig()
    totalsConfig.taxMode = 'mixed'
    totalsConfig.mixedTaxColumns = ['taxRate', 'grossAmount']

    const wrapper = mount(createPricingPanelHost(totalsConfig), {
      global: createMountOptions(),
    })

    const checkboxes = wrapper.findAllComponents({ name: 'Checkbox' })
    expect(checkboxes).toHaveLength(6)

    checkboxes[0]?.vm.$emit('update:model-value', false)
    await nextTick()

    expect(totalsConfig.mixedTaxColumns).toEqual(['grossAmount'])

    checkboxes[2]?.vm.$emit('update:model-value', true)
    await nextTick()

    expect(totalsConfig.mixedTaxColumns).toEqual(['unitTax', 'grossAmount'])

    checkboxes[3]?.vm.$emit('update:model-value', true)
    await nextTick()

    expect(totalsConfig.mixedTaxColumns).toEqual(['unitTax', 'taxAmount', 'grossAmount'])
  })

  it('renders extra charges as editable list rows', () => {
    const totalsConfig = createTotalsConfig()
    totalsConfig.extraCharges = [
      { id: 'shipping', label: 'Shipping', amount: 600 },
      { id: 'handling', label: 'Handling', amount: 120 },
    ]

    const wrapper = mount(createPricingPanelHost(totalsConfig), {
      global: createMountOptions(),
    })

    expect(wrapper.findAll('.extra-charge-list [role="listitem"]')).toHaveLength(2)
  })
})

function createPricingPanelHost(totalsConfig: TotalsConfig) {
  return defineComponent({
    components: { PricingPanel },
    setup() {
      const model = reactive(totalsConfig)
      const totals: QuotationTotals = {
        baseSubtotal: 100,
        markupAmount: 10,
        subtotalAfterMarkup: 110,
        discountAmount: 0,
        taxableSubtotal: 110,
        taxAmount: 14.3,
        grandTotal: 124.3,
        taxBuckets: [],
      }

      return {
        model,
        totals,
      }
    },
    template: '<PricingPanel v-model="model" :totals="totals" currency="USD" />',
  })
}

function createMountOptions() {
  return {
    plugins: [createAppI18n('en-US')],
    stubs: {
      Button: defineComponent({
        name: 'Button',
        emits: ['click'],
        template: '<button type="button" @click="$emit(\'click\')"><slot /></button>',
      }),
      InputText: defineComponent({
        name: 'InputText',
        emits: ['update:model-value', 'blur'],
        template: '<div />',
      }),
      InputNumber: defineComponent({
        name: 'InputNumber',
        emits: ['update:model-value', 'blur'],
        template: '<div />',
      }),
      Checkbox: defineComponent({
        name: 'Checkbox',
        emits: ['update:model-value'],
        template: '<div />',
      }),
      Select: defineComponent({
        name: 'Select',
        emits: ['update:model-value'],
        template: '<div />',
      }),
    },
  }
}

function createTotalsConfig(): TotalsConfig {
  return {
    globalMarkupRate: 10,
    discountMode: 'percentage',
    discountValue: 0,
    taxMode: 'single',
    defaultTaxClassId: 'tax-default',
    taxClasses: [{ id: 'tax-default', label: '13%', rate: 13 }],
  }
}
