// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'

import { createAppI18n } from '@/shared/i18n/createAppI18n'

import LineItemsTable from './LineItemsTable.vue'
import type { QuotationItem, TotalsConfig } from '../types'

describe('LineItemsTable expansion state', () => {
  it('keeps expanded large quote root cards expanded after deleting an item', async () => {
    const items = createItems(82)
    const wrapper = mount(LineItemsTable, {
      props: createProps({ items }),
      global: createMountOptions(),
    })

    expect(getExpandedStates(wrapper)).toHaveLength(82)
    expect(getExpandedStates(wrapper).every((expanded) => expanded === 'false')).toBe(true)

    const expandButton = getButtonByText(wrapper, 'Expand all')
    expect(expandButton.attributes('data-icon')).toBe('pi pi-angle-double-down')

    await expandButton.trigger('click')

    expect(getExpandedStates(wrapper).every((expanded) => expanded === 'true')).toBe(true)
    expect(getButtonByText(wrapper, 'Collapse all').attributes('data-icon')).toBe('pi pi-angle-double-up')

    await wrapper.setProps({ items: items.slice(0, -1) })

    expect(getExpandedStates(wrapper)).toHaveLength(81)
    expect(getExpandedStates(wrapper).every((expanded) => expanded === 'true')).toBe(true)
  })
})

function createMountOptions() {
  return {
    plugins: [createAppI18n('en-US')],
    stubs: {
      Button: defineComponent({
        name: 'Button',
        props: {
          icon: String,
          label: String,
        },
        emits: ['click'],
        template: '<button v-bind="$attrs" type="button" :data-icon="icon" @click="$emit(\'click\')">{{ label }}</button>',
      }),
      Select: defineComponent({
        name: 'Select',
        props: {
          modelValue: String,
          options: Array,
        },
        emits: ['update:modelValue'],
        template: '<select v-bind="$attrs" :value="modelValue"><option v-for="option in options" :key="String(option)" :value="option">{{ option }}</option></select>',
      }),
      LineItemCard: defineComponent({
        name: 'LineItemCard',
        props: {
          item: {
            type: Object,
            required: true,
          },
          expanded: Boolean,
          expandAllRequestKey: Number,
          collapseAllRequestKey: Number,
        },
        template: `
          <article
            data-line-item-card
            :data-item-id="item.id"
            :data-expanded="String(expanded)"
            :data-expand-key="String(expandAllRequestKey ?? '')"
            :data-collapse-key="String(collapseAllRequestKey ?? '')"
          />
        `,
      }),
      SectionHeaderRow: true,
      CalculationSheetDialog: true,
    },
  }
}

function getExpandedStates(wrapper: ReturnType<typeof mount>) {
  return wrapper.findAll('[data-line-item-card]').map((card) => card.attributes('data-expanded'))
}

function getButtonByText(wrapper: ReturnType<typeof mount>, text: string) {
  const button = wrapper.findAll('button').find((node) => node.text() === text)
  expect(button).toBeTruthy()
  return button!
}

function createProps(overrides: Partial<InstanceType<typeof LineItemsTable>['$props']> = {}) {
  return {
    items: createItems(1),
    currency: 'USD',
    grandTotal: 0,
    lineItemEntryMode: 'detailed' as const,
    globalMarkupRate: 10,
    totalsConfig: createTotalsConfig(),
    exchangeRates: { USD: 1 },
    costCurrencyOptions: ['USD'],
    quotationCurrencyOptions: ['USD'],
    ...overrides,
  }
}

function createItems(count: number): QuotationItem[] {
  return Array.from({ length: count }, (_, index) => createItem(`item-${index + 1}`))
}

function createItem(id: string): QuotationItem {
  return {
    id,
    name: `Item ${id}`,
    description: '',
    quantity: 1,
    quantityUnit: 'EA',
    unitCost: 100,
    costCurrency: 'USD',
    children: [],
    taxClassId: 'standard',
  }
}

function createTotalsConfig(): TotalsConfig {
  return {
    globalMarkupRate: 10,
    taxMode: 'single',
    defaultTaxClassId: 'standard',
    taxClasses: [
      {
        id: 'standard',
        label: 'Standard',
        rate: 13,
      },
    ],
  }
}
