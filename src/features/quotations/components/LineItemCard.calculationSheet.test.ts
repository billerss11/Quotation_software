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

    await wrapper.get('[data-calculation-sheet-action="root"]').trigger('click')

    const dialog = wrapper.get('[data-calculation-sheet-dialog="root"]')

    expect(dialog.attributes('data-dialog-visible')).toBe('true')
    expect(dialog.attributes('data-dialog-item-name')).toBe('Pump package')
    expect(dialog.attributes('data-dialog-item-number')).toBe('1')
    expect(dialog.attributes('data-dialog-currency')).toBe('USD')
    expect(dialog.attributes('data-dialog-tax-mode')).toBe('single')
    expect(dialog.attributes('data-dialog-tax-class-label')).toBe('Standard')
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
          item: Object,
          itemNumber: String,
          currency: String,
          totalsConfig: Object,
        },
        template: `
          <div
            data-calculation-sheet-dialog="root"
            :data-dialog-visible="String(visible)"
            :data-dialog-item-name="item?.name"
            :data-dialog-item-number="itemNumber"
            :data-dialog-currency="currency"
            :data-dialog-tax-mode="totalsConfig?.taxMode"
            :data-dialog-tax-class-label="totalsConfig?.taxClasses?.[0]?.label"
          />
        `,
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
    summaryMode: 'totals' as const,
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
    taxMode: 'single',
    defaultTaxClassId: 'tax-default',
    taxClasses: [{ id: 'tax-default', label: 'Standard', rate: 13 }],
  }
}
