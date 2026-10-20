// @vitest-environment jsdom

import { enableAutoUnmount, mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import Select from 'primevue/select'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createAppI18n } from '@/shared/i18n/createAppI18n'

import QuotationNavigator from './QuotationNavigator.vue'
import QuotationMoveDialog from './QuotationMoveDialog.vue'
import type { QuotationItem, QuotationRootItem } from '../types'

enableAutoUnmount(afterEach)

describe('QuotationNavigator', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {} })))
  })

  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('expands and collapses all visible groups from the header action', async () => {
    const wrapper = mount(QuotationNavigator, {
      props: {
        items: createItems(),
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

  it('centers the selected outline item when selection changes', async () => {
    const scrollIntoView = vi.fn()
    const originalScrollIntoView = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = scrollIntoView

    const wrapper = mount(QuotationNavigator, {
      props: {
        items: createItems(),
      },
      global: {
        plugins: [createAppI18n('en-US')],
      },
    })

    try {
      await wrapper.get('.navigator-toolbar-action').trigger('click')
      await wrapper.setProps({ selectedItemId: 'item-1-1' })
      await wrapper.vm.$nextTick()

      expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center' })
    } finally {
      wrapper.unmount()
      Element.prototype.scrollIntoView = originalScrollIntoView
    }
  })

  it('shows root section headers in the outline without consuming item numbering', async () => {
    const wrapper = mount(QuotationNavigator, {
      props: {
        items: createMixedRootRows(),
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

  it.each([
    ['before', 102, 'moveRootRowToIndex', ['item-2', 0]],
    ['inside', 115, 'moveQuotationTreeRow', ['item-2', 'item-1', 1, 'inside']],
    ['after', 128, 'moveRootRowToIndex', ['item-2', 1]],
  ])('moves a root item %s another root row', async (_mode, clientY, eventName, payload) => {
    const wrapper = mountNavigator(createMixedRootRows())
    const target = wrapper.get('[data-nav-row-id="item-1"]')
    setRect(target.element, 100, 130)
    await startDrag(wrapper, 'item-2')
    await target.trigger('dragover', { clientX: 20, clientY })
    expect(wrapper.emitted(eventName as string)).toBeUndefined()
    await target.trigger('drop', { clientX: 20, clientY })
    expect(wrapper.emitted(eventName as string)).toEqual([payload])
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
  })

  it.each([
    ['before', 102, ['item-2-1', 'item-1', 0, 'before']],
    ['inside', 115, ['item-2-1', 'item-1-1', 1, 'inside']],
    ['after', 128, ['item-2-1', 'item-1', 1, 'after']],
  ])('moves a nested item %s another nested row', async (_mode, clientY, payload) => {
    const wrapper = mountNavigator(createItems())
    await wrapper.get('.navigator-toolbar-action').trigger('click')
    const target = wrapper.get('[data-nav-row-id="item-1-1"]')
    setRect(target.element, 100, 130)
    await startDrag(wrapper, 'item-2-1')
    await target.trigger('drop', { clientX: 20, clientY })
    expect(wrapper.emitted('moveQuotationTreeRow')).toEqual([payload])
  })

  it.each([
    ['cycle', 'item-1', 'item-1-1', 115, 'itself or its descendants'],
    ['depth', 'item-2', 'item-1-1', 115, 'three levels'],
    ['section parent', 'section-1', 'item-1-1', 102, 'top level'],
    ['no change', 'item-2', 'item-2', 102, 'already in this position'],
  ])('rejects a %s hover and drop and clears previous feedback', async (_reason, source, targetId, clientY, reasonText) => {
    const wrapper = mountNavigator(createMixedRootRows())
    await wrapper.get('.navigator-toolbar-action').trigger('click')
    await startDrag(wrapper, source)
    const validTarget = wrapper.get('[data-dropzone-index="0"]')
    await validTarget.trigger('dragover', { clientX: 20, clientY: 100 })
    vi.advanceTimersByTime(17)
    await wrapper.vm.$nextTick()
    if (source !== 'item-1') expect(validTarget.classes()).toContain('nav-dropzone-active')

    const target = wrapper.get(`[data-nav-row-id="${targetId}"]`)
    setRect(target.element, 100, 130)
    const transfer = { dropEffect: 'move' }
    await target.trigger('dragover', { clientX: 20, clientY, dataTransfer: transfer })
    vi.advanceTimersByTime(17)
    await wrapper.vm.$nextTick()
    expect(transfer.dropEffect).toBe('none')
    expect(wrapper.find('.nav-dropzone-active').exists()).toBe(false)
    expect(wrapper.get('[role="status"]').text()).toContain(reasonText)
    await target.trigger('drop', { clientX: 20, clientY, dataTransfer: transfer })
    expect(wrapper.emitted('moveRootRowToIndex')).toBeUndefined()
    expect(wrapper.emitted('moveQuotationTreeRow')).toBeUndefined()
  })

  it('rejects no-op gap zones instead of advertising a move', async () => {
    const wrapper = mountNavigator(createMixedRootRows())
    await startDrag(wrapper, 'item-2')
    const transfer = { dropEffect: 'move' }
    const gap = wrapper.get('[data-dropzone-index="2"]')
    await gap.trigger('dragover', { dataTransfer: transfer })
    expect(transfer.dropEffect).toBe('none')
    expect(wrapper.get('[role="status"]').text()).toContain('already in this position')
    await gap.trigger('drop')
    expect(wrapper.emitted('moveRootRowToIndex')).toBeUndefined()
  })

  it('keeps section headers at root level and allows dropping beside root rows', async () => {
    const wrapper = mountNavigator(createMixedRootRows())
    const target = wrapper.get('[data-nav-row-id="item-2"]')
    setRect(target.element, 100, 130)
    await startDrag(wrapper, 'section-1')
    await target.trigger('drop', { clientX: 20, clientY: 128 })
    expect(wrapper.emitted('moveRootRowToIndex')).toEqual([['section-1', 3]])
  })

  it('clears drag feedback and prevents a move when Escape is pressed', async () => {
    const wrapper = mountNavigator(createMixedRootRows())
    await startDrag(wrapper, 'item-2')
    const gap = wrapper.get('[data-dropzone-index="0"]')
    await gap.trigger('dragover', { clientX: 20, clientY: 100 })
    vi.advanceTimersByTime(17)
    expect(gap.classes()).toContain('nav-dropzone-active')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await gap.trigger('drop')
    expect(gap.classes()).not.toContain('nav-dropzone-active')
    expect(wrapper.emitted('moveRootRowToIndex')).toBeUndefined()
  })

  it('locks moves as soon as a search is entered, before search debounce', async () => {
    const wrapper = mountNavigator(createMixedRootRows())
    await startDrag(wrapper, 'item-2')
    await wrapper.get('.navigator-search-input').setValue('pump')
    expect(wrapper.get('.nav-drag-handle').attributes('disabled')).toBeDefined()
    await wrapper.get('[data-dropzone-index="0"]').trigger('drop')
    expect(wrapper.emitted('moveRootRowToIndex')).toBeUndefined()
    await setSearch(wrapper, 'pump')
    await wrapper.get('.nav-depth-1').trigger('contextmenu')
    const action = wrapper.findAll('.navigator-context-action').find((entry) => entry.text() === 'Move…')!
    expect(action.attributes('disabled')).toBeDefined()
  })

  it('stops autoscroll and feedback when leaving the outline or the panel', async () => {
    const panel = document.createElement('div')
    panel.className = 'panel-body'
    document.body.append(panel)
    setRect(panel, 0, 200)
    Object.defineProperties(panel, { scrollHeight: { value: 1000 }, clientHeight: { value: 200 } })
    panel.scrollTop = 200
    const wrapper = mount(QuotationNavigator, {
      props: { items: createMixedRootRows() },
      global: { plugins: [createAppI18n('en-US')] },
      attachTo: panel,
    })
    await startDrag(wrapper, 'item-2')
    const gap = wrapper.get('[data-dropzone-index="0"]')
    await gap.trigger('dragover', { clientX: 20, clientY: 2 })
    vi.advanceTimersByTime(17)
    expect(panel.scrollTop).toBeLessThan(200)

    // Moving between descendants must keep the current drag active.
    await wrapper.get('.navigator').trigger('dragleave', { relatedTarget: gap.element })
    vi.advanceTimersByTime(17)
    expect(gap.classes()).toContain('nav-dropzone-active')

    await wrapper.get('.navigator').trigger('dragleave', { relatedTarget: panel })
    const stoppedScrollTop = panel.scrollTop
    vi.advanceTimersByTime(64)
    expect(panel.scrollTop).toBe(stoppedScrollTop)
    expect(gap.classes()).not.toContain('nav-dropzone-active')

    await gap.trigger('dragover', { clientX: 20, clientY: 2 })
    vi.advanceTimersByTime(17)
    panel.dispatchEvent(new MouseEvent('dragleave', { relatedTarget: document.body }))
    const leftPanelScrollTop = panel.scrollTop
    vi.advanceTimersByTime(64)
    expect(panel.scrollTop).toBe(leftPanelScrollTop)
    expect(gap.classes()).not.toContain('nav-dropzone-active')
  })

  it('does not autoscroll outside the actual panel bounds', async () => {
    const wrapper = mountNavigator(createMixedRootRows())
    const navigator = wrapper.get('.navigator').element as HTMLElement
    Object.defineProperties(navigator, { scrollHeight: { value: 1000 }, clientHeight: { value: 400 } })
    navigator.scrollTop = 200
    await startDrag(wrapper, 'item-2')
    await wrapper.get('[data-dropzone-index="0"]').trigger('dragover', { clientX: 500, clientY: 2 })
    vi.advanceTimersByTime(50)
    expect(navigator.scrollTop).toBe(200)
    expect(wrapper.find('.nav-dropzone-active').exists()).toBe(false)
  })

  it('cleans up pending drag frames on dragend and unmount', async () => {
    const wrapper = mountNavigator(createMixedRootRows())
    const cancelFrame = vi.spyOn(window, 'cancelAnimationFrame')
    const gap = wrapper.get('[data-dropzone-index="0"]')
    await startDrag(wrapper, 'item-2')
    await gap.trigger('dragover', { clientX: 20, clientY: 100 })
    window.dispatchEvent(new Event('dragend'))
    expect(cancelFrame).toHaveBeenCalledTimes(2)
    expect(wrapper.get('.navigator').classes()).not.toContain('navigator-dragging')
    await gap.trigger('drop')
    expect(wrapper.emitted('moveRootRowToIndex')).toBeUndefined()

    await startDrag(wrapper, 'item-2')
    await gap.trigger('dragover', { clientX: 20, clientY: 100 })
    wrapper.unmount()
    expect(cancelFrame).toHaveBeenCalledTimes(4)
  })

  it('opens Move from the handle with Enter and from the section context menu', async () => {
    const wrapper = mountNavigator(createMixedRootRows())
    await wrapper.get('[data-nav-row-id="item-2"] .nav-drag-handle').trigger('keydown', { key: 'Enter' })
    expect(wrapper.getComponent(QuotationMoveDialog).props('itemId')).toBe('item-2')
    await wrapper.getComponent(QuotationMoveDialog).vm.$emit('close')
    await wrapper.vm.$nextTick()
    expect(document.activeElement).toBe(wrapper.get('[data-nav-row-id="item-2"] .nav-drag-handle').element)
    await wrapper.get('[data-nav-row-id="section-1"]').trigger('contextmenu')
    await wrapper.findAll('.navigator-context-action').find((entry) => entry.text() === 'Move…')!.trigger('click')
    expect(wrapper.getComponent(QuotationMoveDialog).props('itemId')).toBe('section-1')
  })

  it('uses the keyboard move dialog to request a nested move without claiming success', async () => {
    const wrapper = mountNavigator(createMixedRootRows())
    await wrapper.get('.navigator-toolbar-action').trigger('click')
    await wrapper.get('[data-nav-row-id="item-2-1"] .nav-drag-handle').trigger('click')
    const dialog = wrapper.getComponent(QuotationMoveDialog)
    await dialog.findAllComponents(Select)[0]!.vm.$emit('update:modelValue', 'item:item-1-1')
    await wrapper.vm.$nextTick()
    await dialog.findAllComponents(Select)[1]!.vm.$emit('update:modelValue', 'inside')
    await wrapper.vm.$nextTick()
    await dialog.get('form').trigger('submit')
    expect(wrapper.emitted('moveQuotationTreeRow')).toEqual([['item-2-1', 'item-1-1', 1, 'inside']])
    expect(wrapper.findComponent(QuotationMoveDialog).exists()).toBe(false)
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
  })

  it.each(['search', 'removed destination'] as const)('revalidates a dialog move if %s changes while closing', async change => {
    const items = createMixedRootRows()
    const wrapper = mountNavigator(items)
    await wrapper.get('[data-nav-row-id="item-2"] .nav-drag-handle').trigger('click')
    const dialog = wrapper.getComponent(QuotationMoveDialog)
    await dialog.findAllComponents(Select)[0]!.vm.$emit('update:modelValue', 'item:item-1')
    await wrapper.vm.$nextTick()
    await dialog.findAllComponents(Select)[1]!.vm.$emit('update:modelValue', 'inside')
    await wrapper.vm.$nextTick()

    const submission = dialog.get('form').trigger('submit')
    if (change === 'search') await wrapper.get('.navigator-search-input').setValue('pump')
    else await wrapper.setProps({ items: items.filter(item => item.id !== 'item-1') })
    await submission
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('moveRootRowToIndex')).toBeUndefined()
    expect(wrapper.emitted('moveQuotationTreeRow')).toBeUndefined()
    expect(wrapper.findComponent(QuotationMoveDialog).exists()).toBe(false)
  })

  it('reveals and focuses a successfully moved nested item and labels expansion controls', async () => {
    const wrapper = mountNavigator(createItems())
    const scrollIntoView = vi.fn()
    Object.defineProperty(Element.prototype, 'scrollIntoView', { configurable: true, value: scrollIntoView })
    expect(wrapper.get('.nav-toggle').attributes('aria-expanded')).toBe('false')
    expect(wrapper.get('.nav-toggle').attributes('aria-label')).toBe('Expand Pump package')
    await wrapper.vm.revealMovedItem('item-1-1-1')
    expect(wrapper.get('.nav-toggle').attributes('aria-expanded')).toBe('true')
    expect(wrapper.get('.nav-toggle').attributes('aria-label')).toBe('Collapse Pump package')
    expect(document.activeElement).toBe(wrapper.get('[data-nav-row-id="item-1-1-1"] .nav-entry').element)
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' })
    expect(wrapper.get('[role="status"]').text()).toBe('Moved Motor')
    expect(wrapper.emitted('selectItem')).toBeUndefined()
  })

  it('keeps an accepted move announcement when native dragend follows the reveal', async () => {
    const wrapper = mountNavigator(createMixedRootRows())
    const target = wrapper.get('[data-nav-row-id="item-1"]')
    setRect(target.element, 100, 130)
    await startDrag(wrapper, 'item-2')
    await target.trigger('drop', { clientX: 20, clientY: 115 })
    expect(wrapper.emitted('moveQuotationTreeRow')).toEqual([['item-2', 'item-1', 1, 'inside']])
    await wrapper.vm.revealMovedItem('item-2')

    window.dispatchEvent(new Event('dragend'))
    await wrapper.vm.$nextTick()
    expect(wrapper.get('[role="status"]').text()).toBe('Moved Base frame')
    expect(wrapper.get('.navigator').classes()).not.toContain('navigator-dragging')

    await startDrag(wrapper, 'item-2')
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
    await wrapper.get('[data-dropzone-index="2"]').trigger('dragover', { clientX: 20, clientY: 100 })
    expect(wrapper.get('[role="status"]').text()).toContain('already in this position')
    window.dispatchEvent(new Event('dragend'))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
  })
})

async function setSearch(wrapper: ReturnType<typeof mount<typeof QuotationNavigator>>, query: string) {
  await wrapper.get('.navigator-search-input').setValue(query)
  vi.advanceTimersByTime(130)
  await wrapper.vm.$nextTick()
}

function mountNavigator(items: QuotationRootItem[]) {
  const wrapper = mount(QuotationNavigator, {
    props: {
      items,
    },
    global: {
      plugins: [createAppI18n('en-US'), PrimeVue],
      stubs: { teleport: true },
    },
    attachTo: document.body,
  })
  setRect(wrapper.get('.navigator').element, 0, 400)
  return wrapper
}

function setRect(element: Element, top: number, bottom: number) {
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    top, bottom, left: 0, right: 300, width: 300, height: bottom - top, x: 0, y: top, toJSON() {},
  })
}

async function startDrag(wrapper: ReturnType<typeof mountNavigator>, itemId: string) {
  await wrapper.get(`[data-nav-row-id="${itemId}"] .nav-drag-handle`).trigger('dragstart', {
    dataTransfer: { effectAllowed: '', setData() {} },
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
