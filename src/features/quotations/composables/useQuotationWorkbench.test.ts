// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, shallowRef } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { RAIL_WIDTH_MAX, RAIL_WIDTH_MIN, saveAppSettings } from '@/shared/services/localAppSettingsStorage'

import { useQuotationWorkbench } from './useQuotationWorkbench'

describe('useQuotationWorkbench', () => {
  const localStorageMock = createLocalStorageMock()

  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: localStorageMock,
    })
    localStorageMock.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('loads persisted workbench settings on mount', () => {
    saveAppSettings({
      quotationSupportPanelsCollapsed: true,
      quotationRailWidth: 420,
    })

    const { workbench, wrapper } = mountWorkbench()

    expect(workbench.supportPanelsCollapsed.value).toBe(true)
    expect(workbench.railWidth.value).toBe(420)

    wrapper.unmount()
  })

  it('persists panel collapse toggles', () => {
    const { workbench, wrapper } = mountWorkbench()

    workbench.toggleSupportPanels()

    expect(workbench.supportPanelsCollapsed.value).toBe(true)
    expect(localStorageMock.getRawValue('quotation-software:app-settings')).toContain('"quotationSupportPanelsCollapsed":true')

    wrapper.unmount()
  })

  it('clamps and persists rail width when resizing ends', () => {
    const { workbench, wrapper } = mountWorkbench()

    workbench.onResizeHandleMouseDown(new MouseEvent('mousedown', { clientX: 100 }))
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: -1000 }))
    window.dispatchEvent(new MouseEvent('mouseup'))

    expect(workbench.railWidth.value).toBe(RAIL_WIDTH_MAX)
    expect(workbench.isResizing.value).toBe(false)
    expect(localStorageMock.getRawValue('quotation-software:app-settings')).toContain(`"quotationRailWidth":${RAIL_WIDTH_MAX}`)

    workbench.onResizeHandleMouseDown(new MouseEvent('mousedown', { clientX: 100 }))
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 1000 }))
    window.dispatchEvent(new MouseEvent('mouseup'))

    expect(workbench.railWidth.value).toBe(RAIL_WIDTH_MIN)

    wrapper.unmount()
  })

  it('registers the save shortcut', () => {
    const onSaveShortcut = vi.fn()
    const { wrapper } = mountWorkbench({ onSaveShortcut })

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true }))

    expect(onSaveShortcut).toHaveBeenCalledTimes(1)

    wrapper.unmount()
  })

  it('scrolls to the focused item and clears the focus after the delay', async () => {
    vi.useFakeTimers()
    const scrollIntoView = vi.fn()
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    })

    const focusedItemId = shallowRef('')
    const clearFocusedItem = vi.fn(() => {
      focusedItemId.value = ''
    })
    const { wrapper } = mountWorkbench({
      focusedItemId,
      clearFocusedItem,
    })

    document.body.innerHTML += '<div data-item-id="item-2"></div>'
    focusedItemId.value = 'item-2'
    await nextTick()
    await nextTick()

    expect(scrollIntoView).toHaveBeenCalledTimes(1)
    expect(scrollIntoView).toHaveBeenCalledWith({
      block: 'start',
    })

    vi.advanceTimersByTime(2200)

    expect(clearFocusedItem).toHaveBeenCalledTimes(1)

    wrapper.unmount()
  })
})

function mountWorkbench(options: {
  focusedItemId?: ReturnType<typeof shallowRef<string>>
  clearFocusedItem?: () => void
  onSaveShortcut?: () => void
} = {}) {
  const focusedItemId = options.focusedItemId ?? shallowRef('')
  const clearFocusedItem = options.clearFocusedItem ?? vi.fn(() => {
    focusedItemId.value = ''
  })
  const onSaveShortcut = options.onSaveShortcut ?? vi.fn()
  let workbench!: ReturnType<typeof useQuotationWorkbench>

  const Host = defineComponent({
    setup() {
      workbench = useQuotationWorkbench({
        focusedItemId,
        clearFocusedItem,
        onSaveShortcut,
      })

      return () => h('div')
    },
  })

  const wrapper = mount(Host)

  return {
    wrapper,
    workbench,
    focusedItemId,
    clearFocusedItem,
    onSaveShortcut,
  }
}

function createLocalStorageMock() {
  const store = new Map<string, string>()

  return {
    getItem(key: string) {
      return store.get(key) ?? null
    },
    setItem(key: string, value: string) {
      store.set(key, value)
    },
    removeItem(key: string) {
      store.delete(key)
    },
    clear() {
      store.clear()
    },
    getRawValue(key: string) {
      return store.get(key) ?? ''
    },
  }
}
