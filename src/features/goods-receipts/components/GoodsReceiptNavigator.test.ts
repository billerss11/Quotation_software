// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import Checkbox from 'primevue/checkbox'
import PrimeVue from 'primevue/config'
import { describe, expect, it } from 'vitest'

import { createAppI18n } from '@/shared/i18n/createAppI18n'
import { createQuotationItem } from '@/features/quotations/utils/quotationItems'

import GoodsReceiptNavigator from './GoodsReceiptNavigator.vue'
import { createGoodsReceiptLineDrafts } from '../utils/goodsReceipt'

describe('GoodsReceiptNavigator', () => {
  it('starts collapsed and reports selected descendants without selecting the group', async () => {
    const { items, lines } = createFixture()
    const wrapper = mountNavigator(items, lines)

    expect(wrapper.findAll('.goods-receipt-outline-row')).toHaveLength(1)
    expect(wrapper.get('.goods-receipt-outline-row').attributes('aria-expanded')).toBe('false')
    expect(wrapper.findComponent(Checkbox).props('modelValue')).toBe(false)
    expect(wrapper.findComponent(Checkbox).props('indeterminate')).toBeFalsy()
    expect(wrapper.text()).toContain('2 selected')

    await wrapper.get('.goods-receipt-outline-toggle').trigger('click')

    expect(wrapper.findAll('.goods-receipt-outline-row')).toHaveLength(3)
    expect(wrapper.text()).toContain('1.1')
    expect(wrapper.text()).toContain('1.2')

    await wrapper.findAll('.goods-receipt-outline-toggle')[1]!.trigger('click')

    expect(wrapper.findAll('.goods-receipt-outline-row')).toHaveLength(4)
    expect(wrapper.text()).toContain('1.2.1')
  })

  it('emits exact selection actions for groups and leaves', async () => {
    const { items, lines } = createFixture()
    const wrapper = mountNavigator(items, lines)

    wrapper.findComponent(Checkbox).vm.$emit('update:modelValue', true)

    expect(wrapper.emitted('setLineSelected')).toEqual([
      ['group-a', true],
    ])

    await wrapper.get('.goods-receipt-outline-toggle').trigger('click')
    const leafCheckbox = wrapper.findAllComponents(Checkbox)[1]!
    leafCheckbox.vm.$emit('update:modelValue', false)

    expect(wrapper.emitted('setLineSelected')).toEqual([
      ['group-a', true],
      ['leaf-a', false],
    ])
  })

  it('shows matching leaves with their ancestors and jumps to the editable row', async () => {
    const { items, lines } = createFixture()
    const wrapper = mountNavigator(items, lines)

    await wrapper.get('input').setValue('pipe spool')

    const rows = wrapper.findAll('.goods-receipt-outline-row')
    expect(rows).toHaveLength(3)
    expect(rows.map((row) => row.text())).toEqual([
      expect.stringContaining('Electrolyzer package'),
      expect.stringContaining('Piping'),
      expect.stringContaining('Pipe spool'),
    ])
    expect(wrapper.text()).toContain('1.2.1')
    expect(wrapper.get('.goods-receipt-outline-result-count').text()).toBe('1 match')

    await rows[2]!.get('.goods-receipt-outline-entry').trigger('click')

    expect(wrapper.emitted('selectLine')).toEqual([
      ['leaf-b'],
    ])
  })
})

function mountNavigator(
  items: ReturnType<typeof createFixture>['items'],
  lines: ReturnType<typeof createFixture>['lines'],
) {
  return mount(GoodsReceiptNavigator, {
    props: { items, lines },
    global: {
      plugins: [PrimeVue, createAppI18n('en-US')],
    },
  })
}

function createFixture() {
  const items = [
    createQuotationItem('USD', {
      id: 'group-a',
      name: 'Electrolyzer package',
      children: [
        createQuotationItem('USD', {
          id: 'leaf-a',
          name: 'Frame',
          quantity: 1,
          quantityUnit: 'EA',
        }),
        createQuotationItem('USD', {
          id: 'group-b',
          name: 'Piping',
          children: [
            createQuotationItem('USD', {
              id: 'leaf-b',
              name: 'Pipe spool',
              quantity: 2,
              quantityUnit: 'EA',
            }),
          ],
        }),
      ],
    }),
  ]

  return {
    items,
    lines: createGoodsReceiptLineDrafts(items),
  }
}
