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
  it('starts collapsed and reports selected descendants without a group checkbox', async () => {
    const { items, lines } = createFixture()
    const wrapper = mountNavigator(items, lines)

    expect(wrapper.findAll('.goods-receipt-outline-row')).toHaveLength(1)
    expect(wrapper.get('.goods-receipt-outline-row').attributes('aria-expanded')).toBe('false')
    expect(wrapper.findAllComponents(Checkbox)).toHaveLength(0)
    expect(wrapper.get('.goods-receipt-outline-group-action').attributes('aria-pressed')).toBe('false')
    expect(wrapper.text()).toContain('2 receipt lines included')

    await wrapper.get('.goods-receipt-outline-toggle').trigger('click')

    expect(wrapper.findAll('.goods-receipt-outline-row')).toHaveLength(3)
    expect(wrapper.text()).toContain('1.1')
    expect(wrapper.text()).toContain('1.2')

    await wrapper.findAll('.goods-receipt-outline-toggle')[1]!.trigger('click')

    expect(wrapper.findAll('.goods-receipt-outline-row')).toHaveLength(4)
    expect(wrapper.text()).toContain('1.2.1')
  })

  it('emits exact group, leaf, and customization actions', async () => {
    const { items, lines } = createFixture()
    const wrapper = mountNavigator(items, lines)

    await wrapper.get('.goods-receipt-outline-group-action').trigger('click')

    expect(wrapper.emitted('setLineSelected')).toEqual([
      ['group-a', true],
    ])

    await wrapper.get('.goods-receipt-outline-toggle').trigger('click')
    const leafCheckbox = wrapper.findComponent(Checkbox)
    leafCheckbox.vm.$emit('update:modelValue', false)

    expect(wrapper.emitted('setLineSelected')).toEqual([
      ['group-a', true],
      ['leaf-a', false],
    ])

    await wrapper.get('.goods-receipt-outline-edit-button').trigger('click')

    expect(wrapper.emitted('editLine')).toEqual([
      ['leaf-a'],
    ])
  })

  it('searches customized text and keeps the matching ancestor path', async () => {
    const { items, lines } = createFixture()
    lines.find((line) => line.id === 'leaf-b')!.description = 'Custom received pipe'
    const wrapper = mountNavigator(items, lines)

    await wrapper.get('input').setValue('custom received')

    const rows = wrapper.findAll('.goods-receipt-outline-row')
    expect(rows).toHaveLength(3)
    expect(rows.map((row) => row.text())).toEqual([
      expect.stringContaining('Electrolyzer package'),
      expect.stringContaining('Piping'),
      expect.stringContaining('Custom received pipe'),
    ])
    expect(wrapper.get('.goods-receipt-outline-result-count').text()).toBe('1 match')

    await rows[2]!.get('.goods-receipt-outline-edit-button').trigger('click')

    expect(wrapper.emitted('editLine')).toEqual([
      ['leaf-b'],
    ])
  })

  it('shows included lines with their unselected ancestors', () => {
    const { items, lines } = createFixture()
    lines.find((line) => line.id === 'leaf-a')!.selected = false
    const wrapper = mountNavigator(items, lines, true)

    const rows = wrapper.findAll('.goods-receipt-outline-row')
    expect(rows).toHaveLength(3)
    expect(rows.map((row) => row.text())).toEqual([
      expect.stringContaining('Electrolyzer package'),
      expect.stringContaining('Piping'),
      expect.stringContaining('Pipe spool'),
    ])
  })

  it('handles a 216-item hierarchy with expand-all, deep search, and selection', async () => {
    const items = createLargeFixture()
    const lines = createGoodsReceiptLineDrafts(items)
    const wrapper = mountNavigator(items, lines)

    expect(lines).toHaveLength(216)
    expect(wrapper.findAll('.goods-receipt-outline-row')).toHaveLength(6)

    await findButton(wrapper, 'Expand all').trigger('click')
    expect(wrapper.findAll('.goods-receipt-outline-row')).toHaveLength(216)

    await wrapper.get('input').setValue('Part 6-5-6')
    const rows = wrapper.findAll('.goods-receipt-outline-row')
    expect(rows).toHaveLength(3)

    const checkbox = wrapper.findComponent(Checkbox)
    checkbox.vm.$emit('update:modelValue', false)
    expect(wrapper.emitted('setLineSelected')).toContainEqual(['part-6-5-6', false])
  })
})

function mountNavigator(
  items: ReturnType<typeof createFixture>['items'],
  lines: ReturnType<typeof createFixture>['lines'],
  includedOnly = false,
) {
  return mount(GoodsReceiptNavigator, {
    props: { items, lines, includedOnly },
    global: {
      plugins: [PrimeVue, createAppI18n('en-US')],
      directives: {
        tooltip: {},
      },
    },
  })
}

function findButton(wrapper: ReturnType<typeof mount<typeof GoodsReceiptNavigator>>, label: string) {
  const button = wrapper.findAll('button').find((candidate) => candidate.text().includes(label))

  if (!button) {
    throw new Error(`Button not found: ${label}`)
  }

  return button
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

function createLargeFixture() {
  return Array.from({ length: 6 }, (_, rootIndex) =>
    createQuotationItem('USD', {
      id: `root-${rootIndex + 1}`,
      name: `Package ${rootIndex + 1}`,
      children: Array.from({ length: 5 }, (_, groupIndex) =>
        createQuotationItem('USD', {
          id: `group-${rootIndex + 1}-${groupIndex + 1}`,
          name: `Group ${rootIndex + 1}-${groupIndex + 1}`,
          children: Array.from({ length: 6 }, (_, partIndex) =>
            createQuotationItem('USD', {
              id: `part-${rootIndex + 1}-${groupIndex + 1}-${partIndex + 1}`,
              name: `Part ${rootIndex + 1}-${groupIndex + 1}-${partIndex + 1}`,
              quantity: 1,
              quantityUnit: 'EA',
            }),
          ),
        }),
      ),
    }),
  )
}
