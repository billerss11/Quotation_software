// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createAppI18n } from '@/shared/i18n/createAppI18n'
import { createQuotationItem } from '@/features/quotations/utils/quotationItems'

import GoodsReceiptItemsEditor from './GoodsReceiptItemsEditor.vue'
import GoodsReceiptNavigator from './GoodsReceiptNavigator.vue'
import { createGoodsReceiptLineDrafts } from '../utils/goodsReceipt'

describe('GoodsReceiptItemsEditor', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows quotation item numbers and filters to included lines', async () => {
    const { items, lines } = createFixture()
    const wrapper = mountEditor(items, lines)

    expect(wrapper.findAll('.goods-receipt-line-number').map((node) => node.text())).toEqual([
      '1',
      '1.1',
      '1.2',
      '1.2.1',
      '1.3',
    ])

    await findButton(wrapper, 'Included only').trigger('click')

    expect(wrapper.findAll('.goods-receipt-line-row')).toHaveLength(2)
    expect(wrapper.findAll('.goods-receipt-line-number').map((node) => node.text())).toEqual(['1.1', '1.2.1'])

    await findButton(wrapper, 'Clear').trigger('click')

    expect(wrapper.findAll('.goods-receipt-line-row')).toHaveLength(0)
    expect(wrapper.text()).toContain('No included items to show.')
  })

  it('replaces ancestors and descendants when selecting an exact hierarchy item', async () => {
    const { items, lines } = createFixture()
    const scrollIntoView = vi.fn()
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    })
    const wrapper = mountEditor(items, lines)
    const navigator = wrapper.findComponent(GoodsReceiptNavigator)

    navigator.vm.$emit('setLineSelected', 'group-a', true)
    await wrapper.vm.$nextTick()

    expect(lines.map((line) => line.selected)).toEqual([true, false, false, false, false])
    expect(wrapper.text()).toContain('Covered by selected item 1.')

    navigator.vm.$emit('setLineSelected', 'leaf-b', true)
    await wrapper.vm.$nextTick()

    expect(lines.map((line) => line.selected)).toEqual([false, false, false, true, false])

    await findButton(wrapper, 'Included only').trigger('click')
    expect(wrapper.findAll('.goods-receipt-line-row')).toHaveLength(1)
    expect(wrapper.get('.goods-receipt-line-number').text()).toBe('1.2.1')

    navigator.vm.$emit('selectLine', 'leaf-zero')
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('.goods-receipt-line-row')).toHaveLength(5)
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' })
    expect(wrapper.get('[data-source-item-id="leaf-zero"]').classes()).toContain('is-focused')
  })

  it('applies Level 1, Level 2, and Detail item presets', async () => {
    const { items, lines } = createFixture()
    const wrapper = mountEditor(items, lines)

    await findButton(wrapper, 'Level 1').trigger('click')
    expect(getSelectedIds(lines)).toEqual(['group-a'])

    await findButton(wrapper, 'Level 2').trigger('click')
    expect(getSelectedIds(lines)).toEqual(['leaf-a', 'group-b'])

    await findButton(wrapper, 'Detail items').trigger('click')
    expect(getSelectedIds(lines)).toEqual(['leaf-a', 'leaf-b'])
  })
})

function mountEditor(
  items: ReturnType<typeof createFixture>['items'],
  lines: ReturnType<typeof createFixture>['lines'],
) {
  return mount(GoodsReceiptItemsEditor, {
    props: {
      modelValue: lines,
      quotationItems: items,
      warnings: [],
      'onUpdate:modelValue': () => {},
    },
    global: {
      plugins: [PrimeVue, createAppI18n('en-US')],
      directives: {
        tooltip: {},
      },
    },
  })
}

function findButton(wrapper: ReturnType<typeof mount<typeof GoodsReceiptItemsEditor>>, label: string) {
  const button = wrapper.findAll('button').find((candidate) => candidate.text().includes(label))

  if (!button) {
    throw new Error(`Button not found: ${label}`)
  }

  return button
}

function getSelectedIds(lines: ReturnType<typeof createFixture>['lines']) {
  return lines.filter((line) => line.selected).map((line) => line.id)
}

function createFixture() {
  const items = [
    createQuotationItem('USD', {
      id: 'group-a',
      name: 'Package',
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
        createQuotationItem('USD', {
          id: 'leaf-zero',
          name: 'Optional label',
          quantity: 0,
          quantityUnit: 'EA',
        }),
      ],
    }),
  ]

  return {
    items,
    lines: createGoodsReceiptLineDrafts(items),
  }
}
