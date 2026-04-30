// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createAppI18n } from '@/shared/i18n/createAppI18n'

import LineItemCard from './LineItemCard.vue'
import type { QuotationItem, TotalsConfig } from '../types'

describe('LineItemCard buffering', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('buffers text edits before emitting row updates', async () => {
    const wrapper = mount(LineItemCard, {
      props: createProps(),
      global: {
        plugins: [createAppI18n('en-US')],
        directives: {
          tooltip: {},
        },
        stubs: {
          Button: defineComponent({ name: 'Button', template: '<button type="button"><slot /></button>' }),
          InputText: defineComponent({ name: 'InputText', emits: ['update:model-value', 'blur'], template: '<div />' }),
          InputNumber: defineComponent({ name: 'InputNumber', emits: ['update:model-value', 'blur'], template: '<div />' }),
          Select: defineComponent({ name: 'Select', emits: ['update:model-value'], template: '<div />' }),
          Textarea: defineComponent({ name: 'Textarea', emits: ['update:model-value', 'blur'], template: '<div />' }),
        },
      },
    })

    wrapper.findAllComponents({ name: 'InputText' })[0]?.vm.$emit('update:model-value', 'Updated item')
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('updateItemField')).toBeUndefined()

    vi.advanceTimersByTime(160)
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('updateItemField')).toEqual([
      ['item-1', 'name', 'Updated item'],
    ])
  })

  it('flushes buffered text edits on blur', async () => {
    const wrapper = mount(LineItemCard, {
      props: createProps(),
      global: {
        plugins: [createAppI18n('en-US')],
        directives: {
          tooltip: {},
        },
        stubs: {
          Button: defineComponent({ name: 'Button', template: '<button type="button"><slot /></button>' }),
          InputText: defineComponent({ name: 'InputText', emits: ['update:model-value', 'blur'], template: '<div />' }),
          InputNumber: defineComponent({ name: 'InputNumber', emits: ['update:model-value', 'blur'], template: '<div />' }),
          Select: defineComponent({ name: 'Select', emits: ['update:model-value'], template: '<div />' }),
          Textarea: defineComponent({ name: 'Textarea', emits: ['update:model-value', 'blur'], template: '<div />' }),
        },
      },
    })

    const inputText = wrapper.findAllComponents({ name: 'InputText' })[0]
    inputText?.vm.$emit('update:model-value', 'Blurred item')
    inputText?.vm.$emit('blur')
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('updateItemField')).toEqual([
      ['item-1', 'name', 'Blurred item'],
    ])
  })
})

function createProps() {
  const item: QuotationItem = {
    id: 'item-1',
    name: 'Valve set',
    description: '',
    quantity: 1,
    quantityUnit: 'set',
    unitCost: 100,
    costCurrency: 'USD',
    children: [],
  }

  const totalsConfig: TotalsConfig = {
    globalMarkupRate: 10,
    discountMode: 'percentage',
    discountValue: 0,
    taxMode: 'single',
    defaultTaxClassId: 'tax-default',
    taxClasses: [{ id: 'tax-default', label: '13%', rate: 13 }],
  }

  return {
    item,
    itemIndex: 0,
    totalItems: 1,
    currency: 'USD',
    globalMarkupRate: 10,
    totalsConfig,
    exchangeRates: { USD: 1 },
    costCurrencyOptions: ['USD'],
    focused: false,
    expanded: true,
  }
}
