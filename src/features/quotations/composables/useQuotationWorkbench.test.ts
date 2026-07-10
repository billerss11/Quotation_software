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

  it('coalesces resize mousemove updates to animation frames without reactive width churn', () => {
    const requestAnimationFrame = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      return window.setTimeout(() => callback(performance.now()), 16)
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((handle) => {
      window.clearTimeout(handle)
    })
    vi.useFakeTimers()

    const railElement = document.createElement('div')
    const railElementRef = shallowRef<HTMLElement | null>(railElement)
    const { workbench, wrapper } = mountWorkbench({ railElement: railElementRef })

    workbench.onResizeHandleMouseDown(new MouseEvent('mousedown', { clientX: 100 }))
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 80 }))
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 60 }))
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 40 }))

    expect(requestAnimationFrame).toHaveBeenCalledTimes(1)
    expect(workbench.railWidth.value).toBe(380)

    vi.advanceTimersByTime(16)

    expect(workbench.railWidth.value).toBe(380)
    expect(railElement.style.width).toBe('440px')

    window.dispatchEvent(new MouseEvent('mouseup'))

    expect(workbench.railWidth.value).toBe(440)

    wrapper.unmount()
  })

  it('registers the save shortcut', () => {
    const onSaveShortcut = vi.fn()
    const { wrapper } = mountWorkbench({ onSaveShortcut })

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true }))

    expect(onSaveShortcut).toHaveBeenCalledTimes(1)

    wrapper.unmount()
  })

  it('registers undo and redo shortcuts', () => {
    const onUndoShortcut = vi.fn()
    const onRedoShortcut = vi.fn()
    const { wrapper } = mountWorkbench({ onUndoShortcut, onRedoShortcut })

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'y', ctrlKey: true }))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, shiftKey: true }))

    expect(onUndoShortcut).toHaveBeenCalledTimes(1)
    expect(onRedoShortcut).toHaveBeenCalledTimes(2)

    wrapper.unmount()
  })

  it('does not intercept native undo inside editable fields', () => {
    const onUndoShortcut = vi.fn()
    const { wrapper } = mountWorkbench({ onUndoShortcut })
    const input = document.createElement('input')
    document.body.append(input)
    input.focus()
    const event = new KeyboardEvent('keydown', {
      key: 'z',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    })

    input.dispatchEvent(event)

    expect(onUndoShortcut).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)

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
      block: 'center',
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
  onUndoShortcut?: () => void
  onRedoShortcut?: () => void
  railElement?: ReturnType<typeof shallowRef<HTMLElement | null>>
} = {}) {
  const focusedItemId = options.focusedItemId ?? shallowRef('')
  const clearFocusedItem = options.clearFocusedItem ?? vi.fn(() => {
    focusedItemId.value = ''
  })
  const onSaveShortcut = options.onSaveShortcut ?? vi.fn()
  const onUndoShortcut = options.onUndoShortcut ?? vi.fn()
  const onRedoShortcut = options.onRedoShortcut ?? vi.fn()
  let workbench!: ReturnType<typeof useQuotationWorkbench>

  const Host = defineComponent({
    setup() {
      workbench = useQuotationWorkbench({
        focusedItemId,
        clearFocusedItem,
        onSaveShortcut,
        onUndoShortcut,
        onRedoShortcut,
        railElement: options.railElement,
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
    onUndoShortcut,
    onRedoShortcut,
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
