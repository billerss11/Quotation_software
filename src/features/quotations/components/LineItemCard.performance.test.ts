// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import { createAppI18n } from '@/shared/i18n/createAppI18n'

import type { ExchangeRateTable, QuotationItem, TotalsConfig } from '../types'

describe('LineItemCard performance', () => {
  it('does not build child-row pricing display while the root card is collapsed', async () => {
    vi.resetModules()

    const pricingModule = await import('../utils/quotationItemPricing')
    const pricingSpy = vi.spyOn(pricingModule, 'getQuotationItemPricingDisplay')
    const { default: LineItemCard } = await import('./LineItemCard.vue')

    mount(LineItemCard, {
      props: createProps({ expanded: false }),
      global: createMountOptions(),
    })

    const pricedItemIds = pricingSpy.mock.calls.map(([item]) => (item as QuotationItem).id)

    expect(pricedItemIds).toContain('root-1')
    expect(pricedItemIds).not.toContain('child-1')
    expect(pricedItemIds).not.toContain('detail-1')
  })
})

function createProps(overrides: Partial<{
  item: QuotationItem
  expanded: boolean
}> = {}) {
  return {
    item: overrides.item ?? createItem({
      id: 'root-1',
      quantity: 1,
      children: [
        createItem({
          id: 'child-1',
          quantity: 2,
          unitCost: 100,
          children: [
            createItem({
              id: 'detail-1',
              quantity: 1,
              unitCost: 50,
            }),
          ],
        }),
      ],
    }),
    itemIndex: 0,
    displayIndex: 0,
    totalItems: 1,
    currency: 'USD',
    lineItemEntryMode: 'detailed' as const,
    globalMarkupRate: 10,
    totalsConfig: createTotalsConfig(),
    exchangeRates: { USD: 1 } satisfies ExchangeRateTable,
    costCurrencyOptions: ['USD'],
    focused: false,
    expanded: overrides.expanded ?? true,
  }
}

function createMountOptions() {
  return {
    plugins: [createAppI18n('en-US')],
    directives: {
      tooltip: {},
    },
    stubs: {
      Button: {
        template: '<button type="button"><slot /></button>',
      },
      InputText: {
        props: ['modelValue'],
        template: '<input :value="modelValue" />',
      },
      InputNumber: {
        props: ['modelValue'],
        template: '<input :value="modelValue" />',
      },
      Select: {
        props: ['modelValue'],
        template: '<div>{{ modelValue }}</div>',
      },
      Textarea: {
        props: ['modelValue'],
        template: '<textarea :value="modelValue" />',
      },
      CalculationSheetDialog: true,
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
    unitCost: overrides.unitCost ?? 0,
    costCurrency: overrides.costCurrency ?? 'USD',
    markupRate: overrides.markupRate,
    taxClassId: overrides.taxClassId,
    expectedTotal: overrides.expectedTotal,
    notes: overrides.notes ?? '',
    children: overrides.children ?? [],
  }
}
