// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'

import { createAppI18n } from '@/shared/i18n/createAppI18n'

import LineItemChildTable from './LineItemChildTable.vue'
import LineItemRootEditor from './LineItemRootEditor.vue'
import type {
  PricingMethod,
  QuotationItem,
  QuotationItemField,
} from '../types'
import type { ChildRow } from '../utils/lineItemChildRows'
import type { QuotationItemPricingDisplay } from '../utils/quotationItemPricing'

describe('line item cost input formatting', () => {
  it('shows root unit cost as a plain number because Cost FX already shows the currency', () => {
    const wrapper = mount(LineItemRootEditor, {
      props: {
        itemId: 'item-16',
        displayItemNumber: 16,
        currency: 'USD',
        currentLocale: 'en-US',
        costCurrency: 'SGD',
        costCurrencyOptions: ['USD', 'SGD'],
        pricingMethodOptions: [{ label: 'Cost + markup', value: 'cost_plus' }],
        taxClassOptions: [],
        isGroupItem: false,
        isMixedTaxMode: false,
        showPricingMethodSelector: true,
        showManualPriceControls: false,
        showDetailedCostControls: true,
        showMarkupEditor: true,
        showExpectedTotal: false,
        quantityValue: 4,
        quantityUnitValue: 'EA',
        pricingMethodValue: 'cost_plus',
        manualUnitPriceValue: 0,
        unitCostValue: 10635.14,
        markupRateValue: 23,
        taxClassValue: null,
        expectedTotalValue: undefined,
        manualPriceLabel: 'Final unit price',
        manualUnitPriceAriaLabel: 'Item 16 final unit price',
        pricingMethodAriaLabel: 'Item 16 pricing basis',
        markupFieldLabel: 'Markup override',
        markupLabel: '23% this item',
        markupUsageLabel: '',
        markupTooltipLabel: '',
        markupAriaLabel: 'Item 16 markup',
        unitTaxSummaryLabel: '',
        mismatchMessage: '',
      },
      global: createMountOptions(),
    })

    const unitCostInput = wrapper.get('input[aria-label="Item 16 unit cost"]')

    expect(unitCostInput.attributes('data-mode')).toBeUndefined()
    expect(unitCostInput.attributes('data-currency')).toBeUndefined()
  })

  it('shows group effective markup, usage status, and help tooltip trigger', () => {
    const wrapper = mount(LineItemRootEditor, {
      props: {
        itemId: 'item-2',
        displayItemNumber: 2,
        currency: 'USD',
        currentLocale: 'en-US',
        costCurrency: 'USD',
        costCurrencyOptions: ['USD'],
        pricingMethodOptions: [{ label: 'Cost + markup', value: 'cost_plus' }],
        taxClassOptions: [],
        isGroupItem: true,
        isMixedTaxMode: false,
        showPricingMethodSelector: false,
        showManualPriceControls: false,
        showDetailedCostControls: false,
        showMarkupEditor: true,
        showExpectedTotal: false,
        quantityValue: 1,
        quantityUnitValue: 'LOT',
        pricingMethodValue: 'cost_plus',
        manualUnitPriceValue: 0,
        unitCostValue: 0,
        markupRateValue: 10,
        taxClassValue: null,
        expectedTotalValue: undefined,
        manualPriceLabel: 'Final unit price',
        manualUnitPriceAriaLabel: 'Item 2 final unit price',
        pricingMethodAriaLabel: 'Item 2 pricing basis',
        markupFieldLabel: 'Default child markup',
        markupLabel: 'Effective markup 14.25%',
        markupUsageLabel: 'Used by 3 priced child/detail rows.',
        markupTooltipLabel: 'Only applies to child/detail rows with blank markup.',
        markupAriaLabel: 'Item 2 default child markup',
        unitTaxSummaryLabel: '',
        mismatchMessage: '',
      },
      global: createMountOptions(),
    })

    expect(wrapper.text()).toContain('Effective markup 14.25%')
    expect(wrapper.text()).toContain('Used by 3 priced child/detail rows.')
    expect(wrapper.get('.field-help').attributes('aria-label')).toBe(
      'Only applies to child/detail rows with blank markup.',
    )
  })

  it('shows child row unit cost as a plain number because the adjacent Cost FX selector shows currency', () => {
    const item = createItem({
      id: 'child-1',
      unitCost: 10635.14,
      costCurrency: 'SGD',
    })
    const wrapper = mount(LineItemChildTable, {
      props: {
        rows: [{
          item,
          depth: 2,
          itemNumber: '16.3.1',
          inheritedMarkupContext: null,
          inheritedTaxClassId: undefined,
          parentItemId: 'parent-1',
        }] satisfies ChildRow[],
        warningRows: [],
        currency: 'USD',
        currentLocale: 'en-US',
        exchangeRates: { USD: 1, SGD: 0.74 },
        costCurrencyOptions: ['USD', 'SGD'],
        pricingMethodOptions: [{ label: 'Cost + markup', value: 'cost_plus' }],
        taxMode: 'single',
        isMixedTaxMode: false,
        showAmountWithTax: false,
        isGroupItem: (rowItem) => rowItem.children.length > 0,
        isSectionExpanded: () => true,
        isItemIncomplete: () => false,
        shouldShowPricingMethodSelector: () => true,
        shouldShowDetailedCostControls: () => true,
        shouldShowMarkupEditor: () => true,
        shouldShowManualPriceControls: () => false,
        shouldShowTaxSummary: () => false,
        getTextFieldValue: (rowItem, field) => String(rowItem[field] ?? ''),
        getNumberFieldValue: (rowItem, field, fallback = 0) => getNumberFieldValue(rowItem, field, fallback),
        getOptionalNumberFieldValue: (rowItem, field) => getOptionalNumberFieldValue(rowItem, field),
        getPricingMethodValue: () => 'cost_plus' as PricingMethod,
        getPricing: () => createPricingDisplay(),
        getMarkupLabel: () => '23% this item',
        getMarkupUsageLabel: () => '',
        getMarkupTooltipLabel: () => '',
        getLineMarkupAriaLabel: () => 'Line item 16.3.1 markup',
        getLineManualUnitPriceAriaLabel: () => 'Line item 16.3.1 final unit price',
        getLinePricingMethodAriaLabel: () => 'Line item 16.3.1 pricing basis',
        getTaxClassValue: () => '',
        getTaxClassOptions: () => [],
        getUnitTaxSummaryLabel: () => '',
        getTotalTaxSummaryLabel: () => '',
        getUnitSellingPrice: () => 9680.1,
        getSellingAmount: () => 38720.4,
        getAmountWithTax: () => 43754.05,
        getMismatchMessage: () => '',
      },
      global: createMountOptions(),
    })

    const unitCostInput = wrapper.get('input[aria-label="Line item 16.3.1 unit cost"]')

    expect(unitCostInput.attributes('data-mode')).toBeUndefined()
    expect(unitCostInput.attributes('data-currency')).toBeUndefined()
  })
})

const InputNumberStub = defineComponent({
  name: 'InputNumber',
  props: ['modelValue', 'mode', 'currency', 'locale'],
  template: '<input :value="modelValue" :data-mode="mode" :data-currency="currency" v-bind="$attrs">',
})

function createMountOptions() {
  return {
    plugins: [createAppI18n('en-US')],
    directives: {
      tooltip: {},
    },
    stubs: {
      Button: defineComponent({ name: 'Button', template: '<button type="button"><slot /></button>' }),
      InputNumber: InputNumberStub,
      InputText: defineComponent({
        name: 'InputText',
        props: ['modelValue'],
        template: '<input :value="modelValue" v-bind="$attrs">',
      }),
      Select: defineComponent({
        name: 'Select',
        props: ['modelValue'],
        template: '<div v-bind="$attrs">{{ modelValue }}</div>',
      }),
      Textarea: defineComponent({
        name: 'Textarea',
        props: ['modelValue'],
        template: '<textarea :value="modelValue" v-bind="$attrs" />',
      }),
    },
  }
}

function createItem(overrides: Partial<QuotationItem> = {}): QuotationItem {
  return {
    id: overrides.id ?? 'item-1',
    name: overrides.name ?? 'New item',
    description: overrides.description ?? '',
    quantity: overrides.quantity ?? 1,
    quantityUnit: overrides.quantityUnit ?? 'EA',
    pricingMethod: overrides.pricingMethod,
    manualUnitPrice: overrides.manualUnitPrice,
    unitCost: overrides.unitCost ?? 0,
    costCurrency: overrides.costCurrency ?? 'USD',
    markupRate: overrides.markupRate,
    taxClassId: overrides.taxClassId,
    expectedTotal: overrides.expectedTotal,
    notes: overrides.notes ?? '',
    children: overrides.children ?? [],
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
    effectiveMarkupRate: 23,
    fallbackMarkupRate: 23,
    markupSource: 'self',
    markupSourceLabel: 'This item',
    baseAmount: 31480.01,
    markupAmount: 7240.39,
    subtotal: 38720.4,
    unitSellingPrice: 9680.1,
    taxClassId: null,
    taxClassLabel: null,
    taxRate: null,
    effectiveTaxRate: null,
    hasMixedTaxClasses: false,
    taxAmount: 0,
    totalWithTax: 38720.4,
    unitPriceWithTax: 9680.1,
  }
}
