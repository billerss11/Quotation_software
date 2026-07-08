// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'

import { createAppI18n } from '@/shared/i18n/createAppI18n'

import LineItemCard from './LineItemCard.vue'
import type { LineItemEntryMode, QuotationItem, TotalsConfig } from '../types'

describe('LineItemCard entry mode controls', () => {
  it('keeps cost-plus controls visible for cost-plus rows in quick entry mode', () => {
    const wrapper = mount(LineItemCard, {
      props: createProps({
        lineItemEntryMode: 'quick',
        item: createItem({
          pricingMethod: 'cost_plus',
          manualUnitPrice: undefined,
          unitCost: 100,
        }),
      }),
      global: createMountOptions(),
    })

    const editor = wrapper.get('[data-test="root-editor"]')

    expect(editor.attributes('data-pricing-selector')).toBe('true')
    expect(editor.attributes('data-detailed-controls')).toBe('true')
    expect(editor.attributes('data-manual-controls')).toBe('false')
    expect(editor.attributes('data-markup-editor')).toBe('true')
  })

  it('keeps group markup controls visible in quick entry mode', () => {
    const wrapper = mount(LineItemCard, {
      props: createProps({
        lineItemEntryMode: 'quick',
        item: createItem({
          children: [
            createItem({
              id: 'child-1',
              unitCost: 100,
            }),
          ],
        }),
      }),
      global: createMountOptions(),
    })

    const editor = wrapper.get('[data-test="root-editor"]')

    expect(editor.attributes('data-markup-editor')).toBe('true')
  })
})

function createProps(overrides: Partial<{
  item: QuotationItem
  lineItemEntryMode: LineItemEntryMode
}> = {}) {
  return {
    item: overrides.item ?? createItem(),
    itemIndex: 0,
    totalItems: 1,
    currency: 'USD',
    lineItemEntryMode: overrides.lineItemEntryMode ?? 'detailed',
    globalMarkupRate: 10,
    totalsConfig: createTotalsConfig(),
    exchangeRates: { USD: 1 },
    costCurrencyOptions: ['USD'],
    focused: false,
    expanded: true,
  }
}

function createMountOptions() {
  return {
    plugins: [createAppI18n('en-US')],
    directives: {
      tooltip: {},
    },
    stubs: {
      Button: true,
      CalculationExplanationDialog: true,
      CalculationSheetDialog: true,
      LineItemCardHeader: true,
      LineItemChildTable: true,
      LineItemSummaryMetrics: true,
      LineItemRootEditor: defineComponent({
        name: 'LineItemRootEditor',
        props: {
          showPricingMethodSelector: Boolean,
          showManualPriceControls: Boolean,
          showDetailedCostControls: Boolean,
          showMarkupEditor: Boolean,
        },
        template: `
          <div
            data-test="root-editor"
            :data-pricing-selector="String(showPricingMethodSelector)"
            :data-manual-controls="String(showManualPriceControls)"
            :data-detailed-controls="String(showDetailedCostControls)"
            :data-markup-editor="String(showMarkupEditor)"
          />
        `,
      }),
    },
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

function createItem(overrides: Partial<QuotationItem> = {}): QuotationItem {
  return {
    id: overrides.id ?? 'item-1',
    name: overrides.name ?? 'New item',
    description: overrides.description ?? '',
    quantity: overrides.quantity ?? 1,
    quantityUnit: overrides.quantityUnit ?? 'pc',
    pricingMethod: overrides.pricingMethod ?? 'cost_plus',
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
