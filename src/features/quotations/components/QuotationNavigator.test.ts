// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createAppI18n } from '@/shared/i18n/createAppI18n'

import QuotationNavigator from './QuotationNavigator.vue'
import type { LineItemEntryMode, QuotationItem, QuotationRootItem } from '../types'

describe('QuotationNavigator', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

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
    expect(bulkToggle.get('i').classes()).toContain('pi-plus')
    expect(bulkToggle.get('.navigator-toolbar-label').text()).toBe('Expand all')

    await bulkToggle.trigger('click')

    expect(wrapper.findAll('.nav-row')).toHaveLength(5)
    expect(wrapper.text()).toContain('1.1')
    expect(wrapper.text()).toContain('1.1.1')
    expect(wrapper.text()).toContain('2.1')

    const collapseAll = wrapper.get('.navigator-toolbar-action')
    expect(collapseAll.text()).toContain('Collapse all')
    expect(collapseAll.get('i').classes()).toContain('pi-minus')
    expect(collapseAll.get('.navigator-toolbar-label').text()).toBe('Collapse all')

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

    const sectionRow = wrapper.get('.nav-row-section')
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

    const dragHandle = wrapper.findAll('.nav-drag-handle')[2]

    await dragHandle!.trigger('dragstart', {
      dataTransfer: {
        effectAllowed: '',
        setData() {},
      },
    })

    const firstDropzone = wrapper.findAll('.nav-dropzone')[0]

    await firstDropzone!.trigger('dragover', {
      clientY: 12,
      preventDefault() {},
    })

    expect(wrapper.emitted('moveRootRowToIndex')).toBeUndefined()

    await firstDropzone!.trigger('drop', {
      preventDefault() {},
    })

    expect(wrapper.emitted('moveRootRowToIndex')).toEqual([
      ['item-2', 0],
    ])
  })

  it('renders drag handles for visible nested priced rows', async () => {
    const wrapper = mount(QuotationNavigator, {
      props: {
        items: createItems(),
        lineItemEntryMode: 'detailed' as LineItemEntryMode,
      },
      global: {
        plugins: [createAppI18n('en-US')],
      },
      attachTo: document.body,
    })

    await wrapper.get('.navigator-toolbar-action').trigger('click')

    const dragHandles = wrapper.findAll('.nav-drag-handle')
    expect(dragHandles).toHaveLength(5)
  })

  it('filters the outline after two characters while keeping parent context', async () => {
    const wrapper = mountNavigator(createMixedRootRows())

    await setSearch(wrapper, 'm')

    expect(wrapper.find('.navigator-search-count').exists()).toBe(false)
    expect(wrapper.findAll('.nav-row')).toHaveLength(3)
    expect(wrapper.text()).toContain('Valve section')
    expect(wrapper.findAll('.nav-dropzone').length).toBeGreaterThan(0)
    expect(wrapper.findAll('.nav-drag-handle').every((handle) => handle.attributes('disabled') === undefined)).toBe(true)

    await setSearch(wrapper, 'motor')

    expect(wrapper.get('.navigator-search-count').text()).toBe('1 match')
    expect(wrapper.findAll('.nav-row')).toHaveLength(3)
    expect(wrapper.text()).toContain('Pump package')
    expect(wrapper.text()).toContain('Pump skid')
    expect(wrapper.text()).toContain('Motor')
    expect(wrapper.text()).not.toContain('Base frame')
    expect(wrapper.findAll('.nav-match-text').map((node) => node.text())).toContain('Motor')
    expect(wrapper.findAll('.nav-dropzone')).toHaveLength(0)
    expect(wrapper.findAll('.nav-drag-handle').every((handle) => handle.attributes('disabled') !== undefined)).toBe(true)

    await wrapper.get('.navigator-search-clear').trigger('click')

    expect(wrapper.find('.navigator-search-count').exists()).toBe(false)
    expect(wrapper.findAll('.nav-row')).toHaveLength(3)
    expect(wrapper.text()).toContain('Valve section')
  })

  it('restores the previous expansion state after clearing search', async () => {
    const wrapper = mountNavigator(createMixedRootRows())

    await wrapper.get('.navigator-toolbar-action').trigger('click')
    expect(wrapper.findAll('.nav-row')).toHaveLength(6)

    await setSearch(wrapper, 'motor')
    expect(wrapper.findAll('.nav-row')).toHaveLength(3)

    await wrapper.get('.navigator-search-clear').trigger('click')

    expect(wrapper.findAll('.nav-row')).toHaveLength(6)
    expect(wrapper.text()).toContain('1.1.1')
    expect(wrapper.text()).toContain('2.1')
  })

  it('matches descriptions and shows the matching snippet only while searching', async () => {
    const wrapper = mountNavigator(createMixedRootRows())

    await setSearch(wrapper, 'steel')

    expect(wrapper.get('.navigator-search-count').text()).toBe('1 match')
    expect(wrapper.findAll('.nav-row')).toHaveLength(2)
    expect(wrapper.text()).toContain('Base frame')
    expect(wrapper.text()).toContain('Anchor bolts')
    expect(wrapper.text()).not.toContain('Pump package')

    const detail = wrapper.get('.nav-match-detail')
    expect(detail.text()).toContain('steel')
    expect(detail.get('.nav-match-text').text()).toBe('steel')
  })

  it('auto-expands a matching group row and shows its descendants as context', async () => {
    const wrapper = mountNavigator(createMixedRootRows())

    await setSearch(wrapper, 'package')

    expect(wrapper.get('.navigator-search-count').text()).toBe('1 match')
    expect(wrapper.findAll('.nav-row')).toHaveLength(3)
    expect(wrapper.text()).toContain('Pump package')
    expect(wrapper.text()).toContain('Pump skid')
    expect(wrapper.text()).toContain('Motor')
    expect(wrapper.text()).not.toContain('Base frame')
    expect(wrapper.find('.nav-count').exists()).toBe(false)
    expect(wrapper.findAll('.nav-match-text').map((node) => node.text())).toContain('package')
  })

  it('matches section header titles', async () => {
    const wrapper = mountNavigator(createMixedRootRows())

    await setSearch(wrapper, 'valve')

    expect(wrapper.get('.navigator-search-count').text()).toBe('1 match')
    expect(wrapper.findAll('.nav-row')).toHaveLength(1)
    expect(wrapper.get('.nav-row-section').text()).toContain('Valve section')
    expect(wrapper.findAll('.nav-match-text').map((node) => node.text())).toContain('Valve')
  })

  it('jumps to the first match when pressing Enter', async () => {
    const wrapper = mountNavigator(createMixedRootRows())

    await wrapper.get('.navigator-search-input').setValue('motor')
    await wrapper.get('.navigator-search-input').trigger('keydown.enter')

    expect(wrapper.emitted('selectItem')).toEqual([
      ['item-1-1-1'],
    ])
  })

  it('keeps the search query when clicking a matching result', async () => {
    const wrapper = mountNavigator(createMixedRootRows())

    await setSearch(wrapper, 'steel')
    await wrapper.findAll('.nav-entry').at(1)!.trigger('click')

    expect(wrapper.emitted('selectItem')).toEqual([
      ['item-2-1'],
    ])
    expect((wrapper.get('.navigator-search-input').element as HTMLInputElement).value).toBe('steel')
    expect(wrapper.get('.navigator-search-count').text()).toBe('1 match')
  })

  it('opens a context menu and emits outline item actions', async () => {
    const wrapper = mountNavigator(createMixedRootRows())

    await wrapper.get('.nav-depth-1').trigger('contextmenu', {
      clientX: 120,
      clientY: 160,
    })

    expect(wrapper.emitted('selectItem')).toEqual([
      ['item-1'],
    ])
    expect(wrapper.get('.navigator-context-menu').text()).toContain('Add child item')
    expect(wrapper.get('.navigator-context-menu').text()).toContain('Duplicate')
    expect(wrapper.get('.navigator-context-menu').text()).toContain('Delete')

    const actions = wrapper.findAll('.navigator-context-action')
    await actions.find((action) => action.text() === 'Add child item')!.trigger('click')
    expect(wrapper.emitted('addChildItem')).toEqual([
      ['item-1'],
    ])

    await wrapper.get('.nav-depth-1').trigger('contextmenu', {
      clientX: 120,
      clientY: 160,
    })
    await wrapper.findAll('.navigator-context-action').find((action) => action.text() === 'Duplicate')!.trigger('click')
    expect(wrapper.emitted('duplicateRootItem')).toEqual([
      ['item-1'],
    ])

    await wrapper.get('.nav-depth-1').trigger('contextmenu', {
      clientX: 120,
      clientY: 160,
    })
    await wrapper.findAll('.navigator-context-action').find((action) => action.text() === 'Delete')!.trigger('click')
    expect(wrapper.emitted('removeItem')).toEqual([
      ['item-1'],
    ])
  })

  it('deletes the selected outline item from the Delete key without affecting search typing', async () => {
    const wrapper = mount(QuotationNavigator, {
      props: {
        items: createMixedRootRows(),
        lineItemEntryMode: 'detailed' as LineItemEntryMode,
        selectedItemId: 'item-2',
      },
      global: {
        plugins: [createAppI18n('en-US')],
      },
      attachTo: document.body,
    })

    await wrapper.get('.navigator-search-input').trigger('keydown', { key: 'Delete' })
    expect(wrapper.emitted('removeItem')).toBeUndefined()

    await wrapper.get('.navigator').trigger('keydown', { key: 'Delete' })
    expect(wrapper.emitted('removeItem')).toEqual([
      ['item-2'],
    ])
  })

  it('shows an empty state when active search has no matches', async () => {
    const wrapper = mountNavigator(createMixedRootRows())

    await setSearch(wrapper, 'zz')

    expect(wrapper.get('.navigator-search-count').text()).toBe('0 matches')
    expect(wrapper.get('.nav-empty').text()).toBe('No matching items')
    expect(wrapper.findAll('.nav-row')).toHaveLength(0)
  })
})

async function setSearch(wrapper: ReturnType<typeof mount<typeof QuotationNavigator>>, query: string) {
  await wrapper.get('.navigator-search-input').setValue(query)
  vi.advanceTimersByTime(130)
  await wrapper.vm.$nextTick()
}

function mountNavigator(items: QuotationRootItem[]) {
  return mount(QuotationNavigator, {
    props: {
      items,
      lineItemEntryMode: 'detailed' as LineItemEntryMode,
    },
    global: {
      plugins: [createAppI18n('en-US')],
    },
    attachTo: document.body,
  })
}

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
          description: 'Galvanized steel hardware',
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
