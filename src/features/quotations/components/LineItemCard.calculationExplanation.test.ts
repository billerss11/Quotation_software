// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'

import { createAppI18n } from '@/shared/i18n/createAppI18n'

import LineItemCard from './LineItemCard.vue'
import type { LineItemEntryMode, QuotationItem, TotalsConfig } from '../types'

describe('LineItemCard calculation explanation action', () => {
  it('opens the calculation explanation from the root item header', async () => {
    const wrapper = mount(LineItemCard, {
      props: createProps(),
      global: createMountOptions(),
    })

    await wrapper.get('[data-calculation-explanation-action="root"]').trigger('click')

    const dialog = wrapper.get('[data-calculation-explanation-dialog="root"]')

    expect(dialog.attributes('data-dialog-visible')).toBe('true')
    expect(dialog.attributes('data-dialog-selected-item-id')).toBe('item-1')
    expect(dialog.attributes('data-dialog-root-item-name')).toBe('Pump package')
    expect(dialog.attributes('data-dialog-root-item-number')).toBe('1')
  })

  it('opens the calculation explanation for a selected child item', async () => {
    const wrapper = mount(LineItemCard, {
      props: createProps({ item: createParentItemWithChildren() }),
      global: createMountOptions(),
    })

    await wrapper
      .get('[data-calculation-explanation-item-id="item-1-child"]')
      .trigger('click')

    const dialog = wrapper.get('[data-calculation-explanation-dialog="root"]')

    expect(dialog.attributes('data-dialog-visible')).toBe('true')
    expect(dialog.attributes('data-dialog-selected-item-id')).toBe('item-1-child')
    expect(dialog.attributes('data-dialog-root-item-number')).toBe('1')
  })

  it('updates the selected item when the explanation dialog emits a tree selection', async () => {
    const wrapper = mount(LineItemCard, {
      props: createProps({ item: createParentItemWithChildren() }),
      global: createMountOptions(),
    })

    await wrapper.get('[data-calculation-explanation-action="root"]').trigger('click')
    await wrapper.get('[data-dialog-select-child-action]').trigger('click')

    const dialog = wrapper.get('[data-calculation-explanation-dialog="root"]')

    expect(dialog.attributes('data-dialog-selected-item-id')).toBe('item-1-child')
  })

  it('keeps the existing calculation sheet action wired to the sheet dialog', async () => {
    const wrapper = mount(LineItemCard, {
      props: createProps(),
      global: createMountOptions(),
    })

    await wrapper.get('[data-calculation-sheet-action="root"]').trigger('click')

    const sheetDialog = wrapper.get('[data-calculation-sheet-dialog="root"]')

    expect(sheetDialog.attributes('data-dialog-visible')).toBe('true')
    expect(wrapper.find('[data-calculation-explanation-dialog="root"]').exists()).toBe(false)
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
        template: '<button type="button" v-bind="$attrs" @click="$emit(\'click\', $event)"><slot />{{ $attrs.label }}</button>',
      }),
      CalculationExplanationDialog: defineComponent({
        name: 'CalculationExplanationDialog',
        emits: ['selectItem'],
        props: {
          visible: Boolean,
          item: Object,
          itemNumber: String,
          selectedItemId: String,
        },
        template: `
          <div
            data-calculation-explanation-dialog="root"
            :data-dialog-visible="String(visible)"
            :data-dialog-selected-item-id="selectedItemId"
            :data-dialog-root-item-name="item?.name"
            :data-dialog-root-item-number="itemNumber"
          >
            <button type="button" data-dialog-select-child-action @click="$emit('selectItem', 'item-1-child')" />
          </div>
        `,
      }),
      CalculationSheetDialog: defineComponent({
        name: 'CalculationSheetDialog',
        props: {
          visible: Boolean,
          item: Object,
          itemNumber: String,
        },
        template: `
          <div
            data-calculation-sheet-dialog="root"
            :data-dialog-visible="String(visible)"
            :data-dialog-item-name="item?.name"
            :data-dialog-item-number="itemNumber"
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

function createParentItemWithChildren(): QuotationItem {
  return {
    ...createParentItem(),
    children: [
      {
        id: 'item-1-child',
        name: 'Pump body',
        description: '',
        quantity: 2,
        quantityUnit: 'pc',
        unitCost: 100,
        costCurrency: 'USD',
        children: [],
      },
    ],
  }
}

function createTotalsConfig(): TotalsConfig {
  return {
    globalMarkupRate: 10,
    taxMode: 'single',
    defaultTaxClassId: 'tax-default',
    taxClasses: [{ id: 'tax-default', label: '13%', rate: 13 }],
  }
}
