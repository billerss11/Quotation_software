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
        summaries: [
          {
            itemId: 'item-1',
            baseSubtotal: 100,
            markupAmount: 10,
            subtotal: 110,
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
})
