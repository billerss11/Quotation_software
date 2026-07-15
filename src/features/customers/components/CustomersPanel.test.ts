// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createAppI18n } from '@/shared/i18n/createAppI18n'
import { replaceCustomerLibraryRecords } from '@/shared/services/localCustomerLibraryStorage'
import CustomersPanel from './CustomersPanel.vue'

const { confirmRequire } = vi.hoisted(() => ({ confirmRequire: vi.fn() }))

vi.mock('primevue/useconfirm', () => ({
  useConfirm: () => ({ require: confirmRequire }),
}))

describe('CustomersPanel', () => {
  const localStorageMock = createLocalStorageMock()

  beforeEach(() => {
    let nextId = 10
    confirmRequire.mockReset()
    Object.defineProperty(window, 'localStorage', { value: localStorageMock, configurable: true })
    Object.defineProperty(window, 'quotationApp', { value: undefined, configurable: true })
    vi.stubGlobal('crypto', { randomUUID: () => `customer-${nextId++}` })
    vi.stubGlobal('ResizeObserver', ResizeObserverMock)
    localStorageMock.clear()
    replaceCustomerLibraryRecords([
      createRecord('alpha', 'Alpha Company', '2026-07-10T10:00:00.000Z'),
      createRecord('beta', 'Beta Company', '2026-07-11T10:00:00.000Z'),
    ])
  })

  afterEach(() => vi.unstubAllGlobals())

  it('uses one New action, guards record changes, confirms delete, and announces deletion', async () => {
    const wrapper = mountPanel()

    expect(wrapper.findAll('button').filter((button) => button.text() === 'New customer')).toHaveLength(1)
    expect(wrapper.text()).toContain('Select a customer')

    await wrapper.findAll('.record-card').find((button) => button.text().includes('Beta Company'))!.trigger('click')
    await wrapper.get('input[autocomplete="organization"]').setValue('Changed Company')
    await wrapper.findAll('.record-card').find((button) => button.text().includes('Alpha Company'))!.trigger('click')

    expect(confirmRequire).toHaveBeenCalledTimes(1)
    expect(wrapper.get('.record-card-active').text()).toContain('Beta Company')
    confirmRequire.mock.calls[0]?.[0].accept()
    await wrapper.vm.$nextTick()
    expect(wrapper.get('.record-card-active').text()).toContain('Alpha Company')

    await wrapper.findAll('button').find((button) => button.text() === 'Delete')!.trigger('click')
    expect(confirmRequire).toHaveBeenCalledTimes(2)
    expect(confirmRequire.mock.calls[1]?.[0].message).toContain('Alpha Company')
    confirmRequire.mock.calls[1]?.[0].accept()
    await wrapper.vm.$nextTick()

    expect(wrapper.get('[role="status"]').text()).toContain('Deleted Alpha Company')
    wrapper.unmount()
  })

  it('shows the create editor and live validation feedback without storing an invalid record', async () => {
    replaceCustomerLibraryRecords([])
    const wrapper = mountPanel()

    await wrapper.findAll('button').find((button) => button.text() === 'New customer')!.trigger('click')
    expect(wrapper.text()).toContain('New customer')
    await wrapper.get('textarea').setValue('details only')
    await wrapper.findAll('button').find((button) => button.text() === 'Save record')!.trigger('click')

    expect(wrapper.find('#customer-identity-error').exists()).toBe(true)
    expect(wrapper.get('[role="status"]').text()).toContain('Fix the highlighted fields')
    expect(wrapper.findAll('.record-card')).toHaveLength(0)
    wrapper.unmount()
  })
})

function mountPanel() {
  return mount(CustomersPanel, {
    global: { plugins: [PrimeVue, createAppI18n('en-US')] },
  })
}

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function createRecord(id: string, customerCompany: string, updatedAt: string) {
  return {
    id,
    updatedAt,
    customerCompany,
    contactPerson: `${customerCompany} contact`,
    contactDetails: `${id}@example.com`,
  }
}

function createLocalStorageMock() {
  const store = new Map<string, string>()
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  }
}
