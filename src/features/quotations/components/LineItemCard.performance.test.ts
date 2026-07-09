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

  it('does not build child row display data while the root card is collapsed', async () => {
    vi.resetModules()

    const childRowsModule = await import('../utils/lineItemChildRows')
    const buildChildRowsSpy = vi.spyOn(childRowsModule, 'buildChildRows')
    const { default: LineItemCard } = await import('./LineItemCard.vue')

    mount(LineItemCard, {
      props: createProps({ expanded: false }),
      global: createMountOptions(),
    })

    expect(buildChildRowsSpy).not.toHaveBeenCalled()
  })

  it('uses precomputed incomplete counts without rescanning the item tree', async () => {
    vi.resetModules()

    const completenessModule = await import('../utils/quotationItemCompleteness')
    const incompleteCountSpy = vi.spyOn(completenessModule, 'countIncompleteQuotationItems')
    const { default: LineItemCard } = await import('./LineItemCard.vue')

    mount(LineItemCard, {
      props: createProps({
        expanded: false,
        incompleteCount: 1,
      }),
      global: createMountOptions(),
    })

    expect(incompleteCountSpy).not.toHaveBeenCalled()
  })

  it('does not mount child row controls while the root card is collapsed', async () => {
    const { default: LineItemCard } = await import('./LineItemCard.vue')

    const wrapper = mount(LineItemCard, {
      props: createProps({ expanded: false }),
      global: createMountOptions(),
    })

    expect(wrapper.find('[data-item-id="child-1"]').exists()).toBe(false)
    expect(wrapper.find('[data-item-id="detail-1"]').exists()).toBe(false)
  })

  it('collapses nested groups when collapse all runs before the root card opens', async () => {
    const { default: LineItemCard } = await import('./LineItemCard.vue')

    const wrapper = mount(LineItemCard, {
      props: createProps({ expanded: false }),
      global: createMountOptions(),
    })

    await wrapper.setProps({ collapseAllRequestKey: 1 })
    await wrapper.setProps({ expanded: true })

    expect(wrapper.get('[data-item-id="child-1"]').attributes('data-item-id')).toBe('child-1')
    expect(wrapper.find('[data-item-id="detail-1"]').exists()).toBe(false)
  })

  it('keeps nested detail row controls collapsed for large expanded root cards', async () => {
    const { default: LineItemCard } = await import('./LineItemCard.vue')

    const wrapper = mount(LineItemCard, {
      props: createProps({
        expanded: true,
        item: createItem({
          id: 'large-root',
          children: Array.from({ length: 8 }, (_, childIndex) =>
            createItem({
              id: `child-${childIndex + 1}`,
              children: Array.from({ length: 5 }, (_, detailIndex) =>
                createItem({
                  id: childIndex === 0 && detailIndex === 0
                    ? 'detail-1'
                    : `detail-${childIndex + 1}-${detailIndex + 1}`,
                }),
              ),
            }),
          ),
        }),
      }),
      global: createMountOptions(),
    })

    expect(wrapper.get('[data-item-id="child-1"]').attributes('data-item-id')).toBe('child-1')
    expect(wrapper.find('[data-item-id="detail-1"]').exists()).toBe(false)
  })
})

function createProps(overrides: Partial<{
  item: QuotationItem
  expanded: boolean
  incompleteCount: number
  collapseAllRequestKey: number
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
    incompleteCount: overrides.incompleteCount,
    collapseAllRequestKey: overrides.collapseAllRequestKey,
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
