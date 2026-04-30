// @vitest-environment jsdom

import { nextTick, reactive } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import { createAppI18n } from '@/shared/i18n/createAppI18n'

describe('LineItemsTable performance', () => {
  it('updates tax class labels without rerunning numeric row pricing', async () => {
    vi.resetModules()

    const pricingModule = await import('../utils/quotationItemPricing')
    const pricingSpy = vi.spyOn(pricingModule, 'getQuotationItemPricingDisplay')
    const { default: LineItemsTable } = await import('./LineItemsTable.vue')

    const totalsConfig = reactive({
      globalMarkupRate: 10,
      discountMode: 'percentage' as const,
      discountValue: 0,
      taxMode: 'mixed' as const,
      defaultTaxClassId: 'tax-goods',
      taxClasses: [
        { id: 'tax-goods', label: 'Goods 13%', rate: 13 },
        { id: 'tax-service', label: 'Service 6%', rate: 6 },
      ],
    })

    const wrapper = mount(LineItemsTable, {
      props: {
        items: [
          {
            id: 'item-1',
            name: 'Valve set',
            description: '',
            quantity: 1,
            quantityUnit: 'set',
            unitCost: 100,
            costCurrency: 'USD',
            taxClassId: 'tax-goods',
            children: [],
          },
        ],
        currency: 'USD',
        grandTotal: 124.3,
        globalMarkupRate: 10,
        totalsConfig,
        exchangeRates: {
          USD: 1,
        },
        costCurrencyOptions: ['USD'],
        quotationCurrencyOptions: ['USD'],
      },
      global: {
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
        },
      },
    })

    expect(wrapper.text()).toContain('Goods 13%')

    pricingSpy.mockClear()
    totalsConfig.taxClasses[0].label = 'Updated Goods 13%'
    await nextTick()

    expect(wrapper.text()).toContain('Updated Goods 13%')
    expect(pricingSpy).not.toHaveBeenCalled()
  })

  it('does not reprice unrelated root items when editing one numeric row', async () => {
    vi.resetModules()

    const pricingModule = await import('../utils/quotationItemPricing')
    const pricingSpy = vi.spyOn(pricingModule, 'getQuotationItemPricingDisplay')
    const { default: LineItemsTable } = await import('./LineItemsTable.vue')

    const items = reactive([
      {
        id: 'item-1',
        name: 'Valve set',
        description: '',
        quantity: 1,
        quantityUnit: 'set',
        unitCost: 100,
        costCurrency: 'USD',
        children: [],
      },
      {
        id: 'item-2',
        name: 'Pump set',
        description: '',
        quantity: 1,
        quantityUnit: 'set',
        unitCost: 200,
        costCurrency: 'USD',
        children: [],
      },
    ])

    mount(LineItemsTable, {
      props: {
        items,
        currency: 'USD',
        grandTotal: 330,
        globalMarkupRate: 10,
        totalsConfig: {
          globalMarkupRate: 10,
          discountMode: 'percentage',
          discountValue: 0,
          taxMode: 'single',
          defaultTaxClassId: 'tax-default',
          taxClasses: [{ id: 'tax-default', label: '13%', rate: 13 }],
        },
        exchangeRates: {
          USD: 1,
        },
        costCurrencyOptions: ['USD'],
        quotationCurrencyOptions: ['USD'],
      },
      global: {
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
        },
      },
    })

    pricingSpy.mockClear()
    items[0].quantity = 2
    await nextTick()

    const repricedItemIds = pricingSpy.mock.calls.map(([item]) => (item as { id: string }).id)

    expect(repricedItemIds).toContain('item-1')
    expect(repricedItemIds).not.toContain('item-2')
  })
})
