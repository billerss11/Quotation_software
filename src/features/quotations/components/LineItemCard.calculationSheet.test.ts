// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'

import { createAppI18n } from '@/shared/i18n/createAppI18n'

import LineItemCard from './LineItemCard.vue'
import type { LineItemEntryMode, QuotationItem, TotalsConfig } from '../types'

describe('LineItemCard calculation sheet action', () => {
  it('opens the calculation sheet from the root item header', async () => {
    const wrapper = mount(LineItemCard, {
      props: createProps(),
      global: createMountOptions(),
    })

    const action = wrapper.find('[data-calculation-sheet-action="root"]')
    expect(action.exists()).toBe(true)

    await action.trigger('click')

    expect(wrapper.find('[data-calculation-sheet-dialog="root"]').exists()).toBe(true)
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
        emits: ['click'],
        template: '<button type="button" @click="$emit(\'click\', $event)"><slot />{{ $attrs.label }}</button>',
      }),
      CalculationSheetDialog: defineComponent({
        name: 'CalculationSheetDialog',
        props: {
          visible: Boolean,
        },
        template: '<div v-if="visible" data-calculation-sheet-dialog="root" />',
      }),
      InputText: defineComponent({ name: 'InputText', emits: ['update:model-value', 'blur'], template: '<div />' }),
      InputNumber: defineComponent({ name: 'InputNumber', emits: ['update:model-value', 'blur'], template: '<div />' }),
      Select: defineComponent({ name: 'Select', emits: ['update:model-value'], template: '<div />' }),
      Textarea: defineComponent({ name: 'Textarea', emits: ['update:model-value', 'blur'], template: '<div />' }),
    },
  }
}

function createProps(overrides: Partial<InstanceType<typeof LineItemCard>['$props']> = {}) {
  return {
    item: createParentItem(),
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

function createParentItem(): QuotationItem {
  return {
    id: 'item-1',
    name: 'Pump package',
    description: '',
    quantity: 1,
    quantityUnit: 'set',
    unitCost: 0,
    costCurrency: 'USD',
    children: [],
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
