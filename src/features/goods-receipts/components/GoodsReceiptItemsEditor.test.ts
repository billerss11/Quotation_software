// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import Select from 'primevue/select'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createAppI18n } from '@/shared/i18n/createAppI18n'
import { createQuotationItem } from '@/features/quotations/utils/quotationItems'

import GoodsReceiptItemsEditor from './GoodsReceiptItemsEditor.vue'
import GoodsReceiptLineCustomizer from './GoodsReceiptLineCustomizer.vue'
import GoodsReceiptNavigator from './GoodsReceiptNavigator.vue'
import { createGoodsReceiptLineDrafts } from '../utils/goodsReceipt'

describe('GoodsReceiptItemsEditor', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses the hierarchy as the only inclusion surface and filters to included paths', async () => {
    const { items, lines } = createFixture()
    const wrapper = mountEditor(items, lines)

    expect(wrapper.find('.goods-receipt-line-list').exists()).toBe(false)
    expect(wrapper.text()).toContain('2 receipt lines included')

    await findButton(wrapper, 'Included only').trigger('click')

    expect(wrapper.findAll('.goods-receipt-outline-row')).toHaveLength(4)
    expect(wrapper.text()).toContain('Package')
    expect(wrapper.text()).toContain('Frame')
    expect(wrapper.text()).toContain('Pipe spool')

    await findButton(wrapper, 'Exclude all').trigger('click')

    expect(getSelectedIds(lines)).toEqual([])
    expect(wrapper.findAll('.goods-receipt-outline-row')).toHaveLength(0)
    expect(wrapper.text()).toContain('No receipt lines are included.')
  })

  it('customizes one included line and closes the editor when a parent replaces it', async () => {
    const { items, lines } = createFixture()
    const wrapper = mountEditor(items, lines)
    const navigator = wrapper.findComponent(GoodsReceiptNavigator)

    navigator.vm.$emit('editLine', 'leaf-a')
    await wrapper.vm.$nextTick()

    const customizer = wrapper.findComponent(GoodsReceiptLineCustomizer)
    expect(customizer.exists()).toBe(true)

    customizer.vm.$emit('updateQuantity', 3)
    customizer.vm.$emit('updateUnit', 'PC')
    customizer.vm.$emit('updateDescription', 'Received frame')
    customizer.vm.$emit('updateRemarks', 'Checked on arrival')
    await wrapper.vm.$nextTick()

    expect(lines.find((line) => line.id === 'leaf-a')).toMatchObject({
      quantity: 3,
      unit: 'PC',
      description: 'Received frame',
      remarks: 'Checked on arrival',
      selected: true,
    })
    expect(wrapper.text()).toContain('Customized')

    navigator.vm.$emit('setLineSelected', 'group-a', true)
    await wrapper.vm.$nextTick()

    expect(getSelectedIds(lines)).toEqual(['group-a'])
    expect(wrapper.findComponent(GoodsReceiptLineCustomizer).exists()).toBe(false)
    expect(lines.find((line) => line.id === 'leaf-a')?.description).toBe('Received frame')
  })

  it('applies receipt-detail presets without erasing custom values', async () => {
    const { items, lines } = createFixture()
    const wrapper = mountEditor(items, lines)
    const navigator = wrapper.findComponent(GoodsReceiptNavigator)
    const presetSelect = wrapper.findComponent(Select)

    navigator.vm.$emit('editLine', 'leaf-a')
    await wrapper.vm.$nextTick()
    wrapper.findComponent(GoodsReceiptLineCustomizer).vm.$emit('updateDescription', 'Custom frame')

    presetSelect.vm.$emit('update:modelValue', 'summary')
    await wrapper.vm.$nextTick()
    expect(getSelectedIds(lines)).toEqual(['group-a'])

    presetSelect.vm.$emit('update:modelValue', 'grouped')
    await wrapper.vm.$nextTick()
    expect(getSelectedIds(lines)).toEqual(['leaf-a', 'group-b'])

    presetSelect.vm.$emit('update:modelValue', 'detailed')
    await wrapper.vm.$nextTick()
    expect(getSelectedIds(lines)).toEqual(['leaf-a', 'leaf-b'])
    expect(lines.find((line) => line.id === 'leaf-a')?.description).toBe('Custom frame')
  })

  it('resets quantity and text to their quotation values without excluding the line', async () => {
    const { items, lines } = createFixture()
    const wrapper = mountEditor(items, lines)
    const navigator = wrapper.findComponent(GoodsReceiptNavigator)

    navigator.vm.$emit('editLine', 'leaf-a')
    await wrapper.vm.$nextTick()
    const customizer = wrapper.findComponent(GoodsReceiptLineCustomizer)

    customizer.vm.$emit('updateQuantity', 7)
    customizer.vm.$emit('updateUnit', 'PC')
    customizer.vm.$emit('updateDescription', 'Changed frame')
    customizer.vm.$emit('updateRemarks', 'Changed remarks')
    customizer.vm.$emit('reset')
    await wrapper.vm.$nextTick()

    expect(lines.find((line) => line.id === 'leaf-a')).toMatchObject({
      selected: true,
      quantity: 1,
      unit: 'EA',
      description: 'Frame',
      remarks: '',
    })
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
