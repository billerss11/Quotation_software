// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'

import { createAppI18n } from '@/shared/i18n/createAppI18n'

import LineItemCard from './LineItemCard.vue'
import type { LineItemEntryMode, QuotationItem, TotalsConfig } from '../types'

describe('LineItemCard collapsed indicator', () => {
  it('shows a compact nested item count when a collapsed parent contains descendants', () => {
    const wrapper = mount(LineItemCard, {
      props: createProps({
        expanded: false,
        item: createParentItem(),
      }),
      global: createMountOptions(),
    })

    const indicator = wrapper.find('.collapsed-nested-indicator')

    expect(indicator.exists()).toBe(true)
    expect(indicator.text()).toContain('4')
    expect(indicator.attributes('aria-label')).toContain('4 nested items')
  })

  it('hides the nested item count while the parent card is expanded', async () => {
    const wrapper = mount(LineItemCard, {
      props: createProps({
        expanded: false,
        item: createParentItem(),
      }),
      global: createMountOptions(),
    })

    await wrapper.setProps({ expanded: true })

    expect(wrapper.find('.collapsed-nested-indicator').exists()).toBe(false)
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

function createProps(overrides: Partial<InstanceType<typeof LineItemCard>['$props']> = {}) {
  const totalsConfig: TotalsConfig = {
    globalMarkupRate: 10,
    discountMode: 'percentage',
    discountValue: 0,
    taxMode: 'single',
    defaultTaxClassId: 'tax-default',
    taxClasses: [{ id: 'tax-default', label: '13%', rate: 13 }],
  }

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
