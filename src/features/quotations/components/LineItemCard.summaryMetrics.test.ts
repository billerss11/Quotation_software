// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'

import { createAppI18n } from '@/shared/i18n/createAppI18n'
import { formatCurrency } from '@/shared/utils/formatters'

import LineItemCard from './LineItemCard.vue'
import type { LineItemEntryMode, QuotationItem, TotalsConfig } from '../types'
import { calculateQuotationTotals } from '../utils/quotationCalculations'

describe('LineItemCard summary metrics', () => {
  it('defaults to totals mode and can switch to unit mode', async () => {
    const wrapper = mount(LineItemCard, {
      props: {
        ...createProps(),
        expanded: false,
      },
      global: createMountOptions(),
    })

    expect(wrapper.text()).toContain('Totals')
    expect(wrapper.text()).toContain('Unit')
    expect(wrapper.text()).toContain('Cost subtotal')
    expect(wrapper.text()).toContain('Total incl. tax')

    await wrapper.find('[data-summary-mode="unit"]').trigger('click')

    expect(wrapper.text()).toContain('Unit cost')
    expect(wrapper.text()).toContain('Unit price')
    expect(wrapper.text()).toContain('Unit price incl. tax')
    expect(wrapper.text()).not.toContain('Cost subtotal')
  })

  it('shows totals metrics in calculation order', () => {
    const wrapper = mount(LineItemCard, {
      props: {
        ...createProps(),
        expanded: false,
      },
      global: createMountOptions(),
    })

    const text = wrapper.text()
    const markupIndex = text.indexOf('Markup amount')
    const subtotalIndex = text.indexOf('Subtotal excl. tax')
    const taxIndex = text.indexOf('Tax amount')

    expect(markupIndex).toBeGreaterThan(-1)
    expect(subtotalIndex).toBeGreaterThan(markupIndex)
    expect(taxIndex).toBeGreaterThan(subtotalIndex)
  })

  it('keeps the expanded totals summary in one compact inline flow', () => {
    const wrapper = mount(LineItemCard, {
      props: {
        ...createProps(),
        expanded: true,
      },
      global: createMountOptions(),
    })

    expect(wrapper.find('.metrics-bar-divider').exists()).toBe(false)
    expect(wrapper.findAll('.metrics-bar-sep')).toHaveLength(4)
    expect(wrapper.find('.metrics-bar-total').exists()).toBe(true)
  })

  it('shows per-unit markup in unit mode', async () => {
    const props = createProps()
    const wrapper = mount(LineItemCard, {
      props: {
        ...props,
        expanded: false,
      },
      global: createMountOptions(),
    })

    await wrapper.find('[data-summary-mode="unit"]').trigger('click')

    const expectedMarkup = formatCurrency(24, props.currency, 'en-US')

    expect(wrapper.text()).toContain('Markup amount')
    expect(wrapper.text()).toContain(expectedMarkup)
  })

  it('shows tax in both collapsed and expanded summaries when the item has tax', async () => {
    const props = createProps()
    const totals = calculateQuotationTotals([props.item], props.totalsConfig, props.exchangeRates)
    const expectedTax = formatCurrency(totals.taxAmount, props.currency, 'en-US')

    const wrapper = mount(LineItemCard, {
      props: {
        ...props,
        expanded: false,
      },
      global: createMountOptions(),
    })

    const collapsedTax = wrapper.find('.summary-metric-tax')
    expect(collapsedTax.exists()).toBe(true)
    expect(collapsedTax.text()).toContain('Tax')
    expect(collapsedTax.text()).toContain(expectedTax)

    await wrapper.setProps({ expanded: true })

    const expandedTax = wrapper.find('.metrics-bar-item-tax')
    expect(expandedTax.exists()).toBe(true)
    expect(expandedTax.text()).toContain('Tax')
    expect(expandedTax.text()).toContain(expectedTax)
  })

  it('hides tax summary blocks when the effective tax is zero', async () => {
    const wrapper = mount(LineItemCard, {
      props: createProps({
        totalsConfig: createTotalsConfig(0),
        expanded: false,
      }),
      global: createMountOptions(),
    })

    expect(wrapper.find('.summary-metric-tax').exists()).toBe(false)
    expect(wrapper.find('.summary-metric-total').exists()).toBe(false)

    await wrapper.setProps({ expanded: true })

    expect(wrapper.find('.metrics-bar-item-tax').exists()).toBe(false)
    expect(wrapper.find('.metrics-bar-total').exists()).toBe(false)
  })
})

function createMountOptions() {
  return {
    plugins: [createAppI18n('en-US')],
    directives: {
      tooltip: {},
    },
    stubs: {
      Button: defineComponent({ name: 'Button', template: '<button type="button"><slot /></button>' }),
      InputText: defineComponent({ name: 'InputText', emits: ['update:model-value', 'blur'], template: '<div />' }),
      InputNumber: defineComponent({ name: 'InputNumber', emits: ['update:model-value', 'blur'], template: '<div />' }),
      Select: defineComponent({ name: 'Select', emits: ['update:model-value'], template: '<div />' }),
      Textarea: defineComponent({ name: 'Textarea', emits: ['update:model-value', 'blur'], template: '<div />' }),
    },
  }
}

function createParentItem(): QuotationItem {
  return {
    id: 'item-1',
    name: 'Pump package',
    description: '',
    quantity: 1,
    quantityUnit: 'set',
    unitCost: 0,
    costCurrency: 'USD',
    children: [
      {
        id: 'item-1-1',
        name: 'Pump skid',
        description: '',
        quantity: 1,
        quantityUnit: 'set',
        unitCost: 0,
        costCurrency: 'USD',
        children: [
          {
            id: 'item-1-1-1',
            name: 'Motor',
            description: '',
            quantity: 1,
            quantityUnit: 'pc',
            unitCost: 120,
            costCurrency: 'USD',
            children: [],
          },
          {
            id: 'item-1-1-2',
            name: 'Coupling',
            description: '',
            quantity: 1,
            quantityUnit: 'pc',
            unitCost: 80,
            costCurrency: 'USD',
            children: [],
          },
        ],
      },
      {
        id: 'item-1-2',
        name: 'Base frame',
        description: '',
        quantity: 1,
        quantityUnit: 'pc',
        unitCost: 40,
        costCurrency: 'USD',
        children: [],
      },
    ],
  }
}

function createTotalsConfig(rate: number): TotalsConfig {
  return {
    globalMarkupRate: 10,
    discountMode: 'percentage',
    discountValue: 0,
    taxMode: 'single',
    defaultTaxClassId: 'tax-default',
    taxClasses: [{ id: 'tax-default', label: `${rate}%`, rate }],
  }
}

function createProps(overrides: Partial<InstanceType<typeof LineItemCard>['$props']> = {}) {
  const totalsConfig = (overrides.totalsConfig as TotalsConfig | undefined) ?? createTotalsConfig(13)

  return {
    item: createParentItem(),
    itemIndex: 0,
    totalItems: 1,
    currency: 'USD',
    lineItemEntryMode: 'detailed' as LineItemEntryMode,
    globalMarkupRate: 10,
    totalsConfig,
    exchangeRates: { USD: 1 },
    costCurrencyOptions: ['USD'],
    focused: false,
    expanded: true,
    ...overrides,
  }
}
