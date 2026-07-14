// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { defineComponent, nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createAppI18n } from '@/shared/i18n/createAppI18n'

import LineItemChildTable from './LineItemChildTable.vue'
import type {
  CurrencyCode,
  ExchangeRateTable,
  PricingMethod,
  QuotationItem,
  QuotationItemField,
} from '../types'
import type { ChildRow } from '../utils/lineItemChildRows'
import type { QuotationItemPricingDisplay } from '../utils/quotationItemPricing'

const originalElementScrollTo = HTMLElement.prototype.scrollTo

afterEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
    configurable: true,
    value: originalElementScrollTo,
  })
})

describe('LineItemChildTable virtualization', () => {
  it('renders the column header immediately before the child rows', () => {
    const wrapper = mountChildTable(createRows(1))
    const header = wrapper.get('.ct-head')
    const rowList = wrapper.get('.ct-row-list')

    expect(header.element.nextElementSibling).toBe(rowList.element)
  })

  it('does not mount every child row when the child table is large', () => {
    const wrapper = mountChildTable(createRows(150))

    expect(wrapper.find('[data-item-id="child-0"]').exists()).toBe(true)
    expect(wrapper.find('[data-item-id="child-149"]').exists()).toBe(false)
  })

  it('keeps child row edit and action emits keyed by item id', async () => {
    const wrapper = mountChildTable(createRows(150))

    await wrapper.get('[data-history-target="item:child-0:name"]').setValue('Changed name')
    await wrapper.get('[data-history-target="item:child-0:name"]').trigger('blur')
    await wrapper.get('[data-history-target="item:child-0:quantity"]').setValue('7')
    await wrapper.get('[data-history-target="item:child-0:quantity"]').trigger('blur')
    await wrapper.get('button[data-icon="pi pi-plus"]').trigger('click')
    await wrapper.get('button[data-icon="pi pi-trash"]').trigger('click')
    await wrapper.get('button[data-icon="pi pi-bullseye"]').trigger('click')

    expect(wrapper.emitted('setText')).toContainEqual(['child-0', 'name', 'Changed name'])
    expect(wrapper.emitted('setNumber')).toContainEqual(['child-0', 'quantity', 7])
    expect(wrapper.emitted('flushField')).toContainEqual(['child-0', 'name'])
    expect(wrapper.emitted('flushField')).toContainEqual(['child-0', 'quantity'])
    expect(wrapper.emitted('addChildItem')).toContainEqual(['child-0'])
    expect(wrapper.emitted('removeItem')).toContainEqual(['child-0'])
    expect(wrapper.emitted('requestGoalSeek')).toContainEqual(['child-0'])
  })

  it('exposes a child row scroll method for focus reveal', async () => {
    const scrollTo = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
      configurable: true,
      value: scrollTo,
    })
    const wrapper = mountChildTable(createRows(150))
    const exposed = wrapper.vm as unknown as {
      scrollToItemId?: (itemId: string) => void
    }

    expect(exposed.scrollToItemId).toEqual(expect.any(Function))

    await nextTick()
    exposed.scrollToItemId?.('child-120')

    expect(scrollTo).toHaveBeenCalled()
  })
})

function mountChildTable(rows: ChildRow[]) {
  return mount(LineItemChildTable, {
    props: {
      rows,
      warningRows: [],
      currency: 'USD' as CurrencyCode,
      currentLocale: 'en-US',
      exchangeRates: { USD: 1 } satisfies ExchangeRateTable,
      costCurrencyOptions: ['USD'],
      pricingMethodOptions: [{ label: 'Cost plus', value: 'cost_plus' as PricingMethod }],
      taxMode: 'single',
      isMixedTaxMode: false,
      showAmountWithTax: false,
      isGroupItem: () => false,
      isSectionExpanded: () => true,
      isItemIncomplete: () => false,
      shouldShowPricingMethodSelector: () => false,
      shouldShowDetailedCostControls: () => true,
      shouldShowMarkupEditor: () => true,
      shouldShowManualPriceControls: () => false,
      shouldShowTaxSummary: () => false,
      getTextFieldValue: (item: QuotationItem, field: QuotationItemField) => String(item[field] ?? ''),
      getNumberFieldValue: (item: QuotationItem, field: QuotationItemField, fallback = 0) =>
        getNumberFieldValue(item, field, fallback),
      getOptionalNumberFieldValue: (item: QuotationItem, field: QuotationItemField) =>
        getOptionalNumberFieldValue(item, field),
      getPricingMethodValue: () => 'cost_plus',
      getPricing: () => createPricingDisplay(),
      getMarkupLabel: () => '10% this item',
      getMarkupUsageLabel: () => '',
      getMarkupTooltipLabel: () => '',
      getLineMarkupAriaLabel: (_item: QuotationItem, itemNumber: string) =>
        `Line item ${itemNumber} markup`,
      getLineManualUnitPriceAriaLabel: (itemNumber: string) =>
        `Line item ${itemNumber} final unit price`,
      getLinePricingMethodAriaLabel: (itemNumber: string) =>
        `Line item ${itemNumber} pricing basis`,
      getTaxClassValue: () => '',
      getTaxClassOptions: () => [],
      getUnitTaxSummaryLabel: () => '',
      getTotalTaxSummaryLabel: () => '',
      getUnitSellingPrice: () => 110,
      getSellingAmount: () => 110,
      getAmountWithTax: () => 110,
      getMismatchMessage: () => '',
    },
    global: createMountOptions(),
  })
}

function createMountOptions() {
  return {
    plugins: [createAppI18n('en-US')],
    directives: {
      tooltip: {},
    },
    stubs: {
      Button: defineComponent({
        name: 'Button',
        props: ['icon', 'label'],
        emits: ['click'],
        template:
          '<button type="button" v-bind="$attrs" :data-icon="icon" @click="$emit(\'click\', $event)">{{ label }}<slot /></button>',
      }),
      InputNumber: defineComponent({
        name: 'InputNumber',
        props: ['modelValue'],
        emits: ['update:modelValue', 'blur'],
        template:
          '<input type="number" :value="modelValue" v-bind="$attrs" @input="$emit(\'update:modelValue\', Number($event.target.value))" @blur="$emit(\'blur\')" />',
      }),
      InputText: defineComponent({
        name: 'InputText',
        props: ['modelValue'],
        emits: ['update:modelValue', 'blur'],
        template:
          '<input :value="modelValue" v-bind="$attrs" @input="$emit(\'update:modelValue\', $event.target.value)" @blur="$emit(\'blur\')" />',
      }),
      Select: defineComponent({
        name: 'Select',
        props: ['modelValue'],
        emits: ['update:modelValue'],
        template: '<input :value="modelValue" v-bind="$attrs" />',
      }),
      Textarea: defineComponent({
        name: 'Textarea',
        props: ['modelValue'],
        emits: ['update:modelValue', 'blur'],
        template:
          '<textarea :value="modelValue" v-bind="$attrs" @input="$emit(\'update:modelValue\', $event.target.value)" @blur="$emit(\'blur\')" />',
      }),
    },
  }
}

function createRows(count: number): ChildRow[] {
  return Array.from({ length: count }, (_value, index) => {
    const item = createItem(index)

    return {
      item,
      depth: 2,
      itemNumber: `1.${index + 1}`,
      inheritedMarkupContext: null,
      inheritedTaxClassId: undefined,
      parentItemId: 'parent-1',
    }
  })
}

function createItem(index: number): QuotationItem {
  return {
    id: `child-${index}`,
    name: `Child ${index}`,
    description: '',
    quantity: 1,
    quantityUnit: 'EA',
    pricingMethod: 'cost_plus',
    unitCost: 100,
    costCurrency: 'USD',
    children: [],
  }
}

function getNumberFieldValue(item: QuotationItem, field: QuotationItemField, fallback: number) {
  const value = item[field]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function getOptionalNumberFieldValue(item: QuotationItem, field: QuotationItemField) {
  const value = item[field]
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function createPricingDisplay(): QuotationItemPricingDisplay {
  return {
    effectiveMarkupRate: 10,
    fallbackMarkupRate: 10,
    markupSource: 'self',
    markupSourceLabel: 'This item',
    baseAmount: 100,
    markupAmount: 10,
    subtotal: 110,
    unitSellingPrice: 110,
    taxClassId: null,
    taxClassLabel: null,
    taxRate: null,
    effectiveTaxRate: null,
    hasMixedTaxClasses: false,
    taxAmount: 0,
    totalWithTax: 110,
    unitPriceWithTax: 110,
  }
}
