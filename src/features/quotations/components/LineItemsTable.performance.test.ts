// @vitest-environment jsdom

import { nextTick, reactive } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import { createAppI18n } from '@/shared/i18n/createAppI18n'

import type { QuotationItem } from '../types'

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
        lineItemEntryMode: 'detailed',
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
            props: ['modelValue', 'options', 'optionLabel', 'optionValue'],
            template: '<div>{{ Array.isArray(options) ? ((options.find((option) => (optionValue ? option[optionValue] : option) === modelValue) || {})[optionLabel || "label"] || modelValue) : modelValue }}</div>',
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
        lineItemEntryMode: 'detailed',
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

  it('opens large quotations with root cards collapsed', async () => {
    const { default: LineItemsTable } = await import('./LineItemsTable.vue')
    const rootItem = createItem({
      id: 'large-root',
      children: Array.from({ length: 80 }, (_, index) =>
        createItem({
          id: `child-${index + 1}`,
          name: `Child ${index + 1}`,
          unitCost: 100,
        }),
      ),
    })

    const wrapper = mount(LineItemsTable, {
      props: {
        items: [rootItem],
        currency: 'USD',
        grandTotal: 8800,
        lineItemEntryMode: 'detailed',
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

    expect(wrapper.find('[data-item-id="child-1"]').exists()).toBe(false)
  })

  it('marks large quotations for lightweight rendering', async () => {
    const { default: LineItemsTable } = await import('./LineItemsTable.vue')
    const rootItem = createItem({
      id: 'large-root',
      children: Array.from({ length: 80 }, (_, index) =>
        createItem({
          id: `child-${index + 1}`,
          name: `Child ${index + 1}`,
          unitCost: 100,
        }),
      ),
    })

    const wrapper = mount(LineItemsTable, {
      props: {
        items: [rootItem],
        currency: 'USD',
        grandTotal: 8800,
        lineItemEntryMode: 'detailed',
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

    expect(wrapper.get('.workbench').classes()).toContain('workbench-large-quote')
  })

  it('expands nested groups when expanding all root cards', async () => {
    const { default: LineItemsTable } = await import('./LineItemsTable.vue')
    const rootItem = createItem({
      id: 'large-root',
      children: [
        createItem({
          id: 'child-group',
          name: 'Child group',
          children: Array.from({ length: 80 }, (_, index) =>
            createItem({
              id: `grandchild-${index + 1}`,
              name: `Grandchild ${index + 1}`,
              unitCost: 100,
            }),
          ),
        }),
      ],
    })

    const wrapper = mount(LineItemsTable, {
      props: {
        items: [rootItem],
        currency: 'USD',
        grandTotal: 8800,
        lineItemEntryMode: 'detailed',
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
            props: ['label'],
            emits: ['click'],
            template: '<button type="button" @click="$emit(\'click\')">{{ label }}</button>',
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

    expect(wrapper.find('[data-item-id="grandchild-1"]').exists()).toBe(false)

    await wrapper.get('.heading-buttons button').trigger('click')

    expect(wrapper.find('[data-item-id="child-group"]').exists()).toBe(true)
    expect(wrapper.find('[data-item-id="grandchild-1"]').exists()).toBe(true)
  })
})

function createItem(overrides: Partial<QuotationItem> = {}): QuotationItem {
  return {
    id: overrides.id ?? 'item-1',
    name: overrides.name ?? 'New item',
    description: '',
    quantity: 1,
    quantityUnit: 'set',
    unitCost: overrides.unitCost ?? 0,
    costCurrency: 'USD',
    children: overrides.children ?? [],
  }
}
