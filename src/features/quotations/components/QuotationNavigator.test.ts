// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { createAppI18n } from '@/shared/i18n/createAppI18n'

import QuotationNavigator from './QuotationNavigator.vue'
import type { LineItemEntryMode, QuotationItem, QuotationRootItem } from '../types'

describe('QuotationNavigator', () => {
  it('expands and collapses all visible groups from the header action', async () => {
    const wrapper = mount(QuotationNavigator, {
      props: {
        items: createItems(),
        lineItemEntryMode: 'detailed' as LineItemEntryMode,
      },
      global: {
        plugins: [createAppI18n('en-US')],
      },
    })

    expect(wrapper.findAll('.nav-row')).toHaveLength(2)

    const bulkToggle = wrapper.get('.navigator-toolbar-action')
    expect(bulkToggle.text()).toContain('Expand all')

    await bulkToggle.trigger('click')

    expect(wrapper.findAll('.nav-row')).toHaveLength(5)
    expect(wrapper.text()).toContain('1.1')
    expect(wrapper.text()).toContain('1.1.1')
    expect(wrapper.text()).toContain('2.1')

    const collapseAll = wrapper.get('.navigator-toolbar-action')
    expect(collapseAll.text()).toContain('Collapse all')

    await collapseAll.trigger('click')

    expect(wrapper.findAll('.nav-row')).toHaveLength(2)
    expect(wrapper.text()).not.toContain('1.1')
    expect(wrapper.text()).not.toContain('1.1.1')
    expect(wrapper.text()).not.toContain('2.1')
  })

  it('highlights incomplete items in the outline', () => {
    const items = createItems()
    items[1]!.children[0]!.unitCost = 0

    const wrapper = mount(QuotationNavigator, {
      props: {
        items,
        lineItemEntryMode: 'detailed' as LineItemEntryMode,
      },
      global: {
        plugins: [createAppI18n('en-US')],
      },
    })

    const rows = wrapper.findAll('.nav-row')
    expect(rows[1]?.classes()).toContain('nav-row-incomplete')
    expect(rows[1]?.find('.nav-entry').classes()).toContain('nav-entry-incomplete')
    expect(rows[0]?.classes()).not.toContain('nav-row-incomplete')
  })

  it('shows root section headers in the outline without consuming item numbering', async () => {
    const wrapper = mount(QuotationNavigator, {
      props: {
        items: createMixedRootRows(),
        lineItemEntryMode: 'detailed' as LineItemEntryMode,
      },
      global: {
        plugins: [createAppI18n('en-US')],
      },
    })

    await wrapper.get('.navigator-toolbar-action').trigger('click')

    const sectionRow = wrapper.find('.nav-row-section')
    expect(sectionRow.exists()).toBe(true)
    expect(sectionRow.text()).toContain('Valve section')
    expect(sectionRow.find('.nav-num').exists()).toBe(false)

    const rootNumbers = wrapper.findAll('.nav-depth-1 .nav-num').map((node) => node.text())
    expect(rootNumbers).toEqual(['1', '2'])
  })

  it('emits a root move only on drop, not during drag hover', async () => {
    const wrapper = mount(QuotationNavigator, {
      props: {
        items: createMixedRootRows(),
        lineItemEntryMode: 'detailed' as LineItemEntryMode,
      },
      global: {
        plugins: [createAppI18n('en-US')],
      },
      attachTo: document.body,
    })

    const dragHandle = wrapper.findAll('.nav-drag-handle').at(2)
    expect(dragHandle?.exists()).toBe(true)

    await dragHandle?.trigger('dragstart', {
      dataTransfer: {
        effectAllowed: '',
        setData() {},
      },
    })

    const firstDropzone = wrapper.findAll('.nav-dropzone').at(0)
    await firstDropzone?.trigger('dragover', {
      clientY: 12,
      preventDefault() {},
    })

    expect(wrapper.emitted('moveRootRowToIndex')).toBeUndefined()

    await firstDropzone?.trigger('drop', {
      preventDefault() {},
    })

    expect(wrapper.emitted('moveRootRowToIndex')).toEqual([
      ['item-2', 0],
    ])
  })

  it('still commits the root move when the mouse is released on the row body', async () => {
    const wrapper = mount(QuotationNavigator, {
      props: {
        items: createMixedRootRows(),
        lineItemEntryMode: 'detailed' as LineItemEntryMode,
      },
      global: {
        plugins: [createAppI18n('en-US')],
      },
      attachTo: document.body,
    })

    const dragHandle = wrapper.findAll('.nav-drag-handle').at(2)
    await dragHandle?.trigger('dragstart', {
      dataTransfer: {
        effectAllowed: '',
        setData() {},
      },
    })

    const destinationRow = wrapper.findAll('.nav-row.nav-depth-1').at(0)
    if (!destinationRow) {
      throw new Error('Expected destination row')
    }

    destinationRow.element.getBoundingClientRect = () => ({
      top: 10,
      bottom: 34,
      left: 0,
      right: 100,
      width: 100,
      height: 24,
      x: 0,
      y: 10,
      toJSON() {
        return {}
      },
    } as DOMRect)

    await destinationRow.trigger('dragover', {
      clientY: 12,
      preventDefault() {},
      dataTransfer: {
        dropEffect: '',
      },
    })

    await destinationRow.trigger('drop', {
      clientY: 12,
      preventDefault() {},
    })

    expect(wrapper.emitted('moveRootRowToIndex')).toEqual([
      ['item-2', 0],
    ])
  })
})

function createItems(): QuotationItem[] {
  return [
    {
      id: 'item-1',
      name: 'Pump package',
      description: '',
      quantity: 1,
      quantityUnit: 'set',
      unitCost: 0,
      costCurrency: 'USD',
      children: [
        {
          id: 'item-1-1',
          name: 'Pump skid',
          description: '',
          quantity: 1,
          quantityUnit: 'set',
          unitCost: 0,
          costCurrency: 'USD',
          children: [
            {
              id: 'item-1-1-1',
              name: 'Motor',
              description: '',
              quantity: 1,
              quantityUnit: 'pc',
              unitCost: 120,
              costCurrency: 'USD',
              children: [],
            },
          ],
        },
      ],
    },
    {
      id: 'item-2',
      name: 'Base frame',
      description: '',
      quantity: 1,
      quantityUnit: 'pc',
      unitCost: 40,
      costCurrency: 'USD',
      children: [
        {
          id: 'item-2-1',
          name: 'Anchor bolts',
          description: '',
          quantity: 4,
          quantityUnit: 'pc',
          unitCost: 5,
          costCurrency: 'USD',
          children: [],
        },
      ],
    },
  ]
}

function createMixedRootRows(): QuotationRootItem[] {
  return [
    createItems()[0],
    {
      id: 'section-1',
      kind: 'section_header',
      title: 'Valve section',
    },
    createItems()[1],
  ]
}
