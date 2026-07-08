// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'

import { createAppI18n } from '@/shared/i18n/createAppI18n'

import LineItemChildTable from './LineItemChildTable.vue'
import type { CurrencyCode, ExchangeRateTable, PricingMethod, QuotationItem, QuotationItemField } from '../types'
import type { ChildRow } from '../utils/lineItemChildRows'
import type { QuotationItemPricingDisplay } from '../utils/quotationItemPricing'

describe('LineItemChildTable cost over sales', () => {
  it('renders cost over sales for nested rows from pre-tax pricing', () => {
    const item = createItem()
    const rows: ChildRow[] = [{
      item,
      depth: 2,
      itemNumber: '1.1',
      inheritedMarkupContext: null,
      parentItemId: 'parent-1',
    }]

    const wrapper = mount(LineItemChildTable, {
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
        shouldShowMarkupEditor: () => false,
        shouldShowManualPriceControls: () => false,
        shouldShowTaxSummary: () => false,
        getTextFieldValue: (rowItem: QuotationItem, field: QuotationItemField) => String(rowItem[field] ?? ''),
        getNumberFieldValue: (rowItem: QuotationItem, field: QuotationItemField) => Number(rowItem[field] ?? 0),
        getOptionalNumberFieldValue: () => undefined,
        getPricingMethodValue: () => 'cost_plus',
        getPricing: () => createPricingDisplay(),
        getMarkupLabel: () => '',
        getMarkupUsageLabel: () => '',
        getMarkupTooltipLabel: () => '',
        getLineMarkupAriaLabel: () => '',
        getLineManualUnitPriceAriaLabel: () => '',
        getLinePricingMethodAriaLabel: () => '',
        getTaxClassValue: () => '',
        getTaxClassOptions: () => [],
        getUnitTaxSummaryLabel: () => '',
        getTotalTaxSummaryLabel: () => '',
        getUnitSellingPrice: () => 100,
        getSellingAmount: () => 100,
        getAmountWithTax: () => 100,
        getMismatchMessage: () => '',
      },
      global: createMountOptions(),
    })

    expect(wrapper.text()).toContain('Total cost: $75.00')
    expect(wrapper.text()).toContain('Cost / Sales: 75.00%')
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
        template: '<button type="button" @click="$emit(\'click\')"><slot /></button>',
      }),
      InputText: defineComponent({
        name: 'InputText',
        template: '<span />',
      }),
      InputNumber: defineComponent({
        name: 'InputNumber',
        template: '<span />',
      }),
      Select: defineComponent({
        name: 'Select',
        template: '<span />',
      }),
      Textarea: defineComponent({
        name: 'Textarea',
        template: '<span />',
      }),
    },
  }
}

function createPricingDisplay(): QuotationItemPricingDisplay {
  return {
    effectiveMarkupRate: 33.33,
    fallbackMarkupRate: 33.33,
    markupSource: 'global',
    markupSourceLabel: 'Global',
    baseAmount: 75,
    markupAmount: 25,
    subtotal: 100,
    unitSellingPrice: 100,
    taxClassId: null,
    taxClassLabel: null,
    taxRate: null,
    effectiveTaxRate: null,
    hasMixedTaxClasses: false,
    taxAmount: 0,
    totalWithTax: 100,
    unitPriceWithTax: 100,
  }
}

function createItem(): QuotationItem {
  return {
    id: 'child-1',
    name: 'Pump',
    description: '',
    quantity: 1,
    quantityUnit: 'EA',
    pricingMethod: 'cost_plus',
    unitCost: 75,
    costCurrency: 'USD',
    children: [],
  }
}
