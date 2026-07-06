// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'

import { createAppI18n } from '@/shared/i18n/createAppI18n'

import LineItemCard from './LineItemCard.vue'
import type { LineItemEntryMode, QuotationItem, TotalsConfig } from '../types'

describe('LineItemCard nested expansion', () => {
  it('toggles nested level 3 rows from the root card action strip', async () => {
    const wrapper = mount(LineItemCard, {
      props: createProps(),
      global: createMountOptions(),
    })

    expect(wrapper.find('[data-item-id="grandchild-1"]').exists()).toBe(true)

    const collapseButton = wrapper.get('[aria-label="Collapse nested items for item 1"]')
    expect(collapseButton.attributes('data-icon')).toBe('pi pi-compress')

    await collapseButton.trigger('click')

    expect(wrapper.find('[data-item-id="grandchild-1"]').exists()).toBe(false)

    const expandButton = wrapper.get('[aria-label="Expand nested items for item 1"]')
    expect(expandButton.attributes('data-icon')).toBe('pi pi-expand')

    await expandButton.trigger('click')

    expect(wrapper.find('[data-item-id="grandchild-1"]').exists()).toBe(true)
  })
})

function createMountOptions() {
  return {
    plugins: [createAppI18n('en-US')],
    directives: {
      tooltip: {},
    },
    stubs: {
      Button: defineComponent({
        name: 'Button',
        props: {
          icon: String,
          label: String,
        },
        emits: ['click'],
        template: '<button v-bind="$attrs" type="button" :data-icon="icon" @click="$emit(\'click\')"><slot />{{ label }}</button>',
      }),
      InputText: defineComponent({
        name: 'InputText',
        props: {
          modelValue: [String, Number],
        },
        emits: ['update:modelValue'],
        template: '<input v-bind="$attrs" :value="modelValue" />',
      }),
      InputNumber: defineComponent({
        name: 'InputNumber',
        props: {
          modelValue: [Number, String],
        },
        emits: ['update:modelValue'],
        template: '<input v-bind="$attrs" :value="modelValue" />',
      }),
      Select: defineComponent({
        name: 'Select',
        props: {
          modelValue: [String, Number],
          options: Array,
        },
        emits: ['update:modelValue'],
        template: '<select v-bind="$attrs" :value="modelValue"><option v-for="option in options" :key="String(option)" :value="option">{{ option }}</option></select>',
      }),
      Textarea: defineComponent({
        name: 'Textarea',
        props: {
          modelValue: String,
        },
        emits: ['update:modelValue'],
        template: '<textarea v-bind="$attrs" :value="modelValue" />',
      }),
      CalculationSheetDialog: true,
    },
  }
}

function createProps(overrides: Partial<InstanceType<typeof LineItemCard>['$props']> = {}) {
  return {
    item: createRootItem(),
    itemIndex: 0,
    totalItems: 1,
    currency: 'USD',
    lineItemEntryMode: 'detailed' as LineItemEntryMode,
    globalMarkupRate: 10,
    totalsConfig: createTotalsConfig(),
    exchangeRates: { USD: 1 },
    costCurrencyOptions: ['USD'],
    focused: false,
    expanded: true,
    ...overrides,
  }
}

function createRootItem(): QuotationItem {
  return createItem('root-1', 'Root item', [
    createItem('child-group-1', 'Child group', [
      createItem('grandchild-1', 'Grandchild item'),
    ]),
  ])
}

function createItem(id: string, name: string, children: QuotationItem[] = []): QuotationItem {
  return {
    id,
    name,
    description: '',
    quantity: 1,
    quantityUnit: 'EA',
    unitCost: children.length > 0 ? 0 : 100,
    costCurrency: 'USD',
    children,
    taxClassId: 'standard',
  }
}

function createTotalsConfig(): TotalsConfig {
  return {
    globalMarkupRate: 10,
    discountMode: 'percentage',
    discountValue: 0,
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
