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

    const indicator = wrapper.get('.collapsed-nested-indicator')
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

  it('keeps expanded nested rows visible after the child tree changes', async () => {
    const item = createLargeParentItem()
    const wrapper = mount(LineItemCard, {
      props: createProps({
        expanded: true,
        item,
      }),
      global: createMountOptions(),
    })

    expect(wrapper.findAll('.ct-row-d3')).toHaveLength(0)

    await wrapper.setProps({ expandAllRequestKey: 1 })
    expect(wrapper.findAll('.ct-row-d3')).toHaveLength(13)

    await wrapper.setProps({ item: moveFirstGrandchildToSecondGroup(item) })

    expect(wrapper.findAll('.ct-row-d3')).toHaveLength(13)
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

function createLargeParentItem(): QuotationItem {
  return {
    id: 'item-large',
    name: 'Large package',
    description: '',
    quantity: 1,
    quantityUnit: 'set',
    unitCost: 0,
    costCurrency: 'USD',
    children: Array.from({ length: 13 }, (_, index) => ({
      id: `item-large-${index + 1}`,
      name: `Group ${index + 1}`,
      description: '',
      quantity: 1,
      quantityUnit: 'set',
      unitCost: 0,
      costCurrency: 'USD',
      children: [
        {
          id: `item-large-${index + 1}-1`,
          name: `Leaf ${index + 1}`,
          description: '',
          quantity: 1,
          quantityUnit: 'pc',
          unitCost: 10,
          costCurrency: 'USD',
          children: [],
        },
      ],
    })),
  }
}

function moveFirstGrandchildToSecondGroup(item: QuotationItem): QuotationItem {
  const next = cloneItem(item)
  const [firstGrandchild] = next.children[0]?.children.splice(0, 1) ?? []

  if (firstGrandchild) {
    next.children[1]?.children.push(firstGrandchild)
  }

  return next
}

function cloneItem(item: QuotationItem): QuotationItem {
  return JSON.parse(JSON.stringify(item)) as QuotationItem
}

function createProps(overrides: Partial<InstanceType<typeof LineItemCard>['$props']> = {}) {
  const totalsConfig: TotalsConfig = {
    globalMarkupRate: 10,
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
