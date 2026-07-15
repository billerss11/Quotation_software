// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createAppI18n } from '@/shared/i18n/createAppI18n'
import SettingsPanel from './SettingsPanel.vue'

const mocks = vi.hoisted(() => ({
  confirmRequire: vi.fn(),
  selectLibraryFile: vi.fn(),
  applyLibraryReplacement: vi.fn(),
  createEmptyLibrary: vi.fn(),
  saveLibrary: vi.fn(),
  saveLibraryAs: vi.fn(),
}))

vi.mock('primevue/useconfirm', () => ({
  useConfirm: () => ({ require: mocks.confirmRequire }),
}))

vi.mock('../composables/useQuotationLibraryFileActions', async () => {
  const { shallowRef } = await import('vue')
  return {
    useQuotationLibraryFileActions: () => ({
      currentLibraryFilePath: shallowRef(''),
      statusMessage: shallowRef(''),
      ...mocks,
    }),
  }
})

describe('SettingsPanel', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset())
    mocks.selectLibraryFile.mockResolvedValue({
      filePath: 'C:/backup.json',
      data: {
        companyProfiles: [],
        customers: [],
        numbering: { lastIssuedYear: null, lastIssuedSequence: 0 },
      },
    })
  })

  it('confirms before creating an empty library', async () => {
    const wrapper = mountPanel()

    await wrapper.findAll('button').find((button) => button.text() === 'Create empty library')!.trigger('click')

    expect(mocks.createEmptyLibrary).not.toHaveBeenCalled()
    expect(mocks.confirmRequire).toHaveBeenCalledTimes(1)
    mocks.confirmRequire.mock.calls[0]?.[0].accept()
    expect(mocks.createEmptyLibrary).toHaveBeenCalledTimes(1)
  })

  it('parses first and applies a replacement only after confirmation', async () => {
    const wrapper = mountPanel()

    await wrapper.findAll('button').find((button) => button.text() === 'Open backup')!.trigger('click')
    await flushPromises()

    expect(mocks.selectLibraryFile).toHaveBeenCalledTimes(1)
    expect(mocks.applyLibraryReplacement).not.toHaveBeenCalled()
    expect(mocks.confirmRequire).toHaveBeenCalledTimes(1)

    mocks.confirmRequire.mock.calls[0]?.[0].accept()
    expect(mocks.applyLibraryReplacement).toHaveBeenCalledWith(expect.objectContaining({ filePath: 'C:/backup.json' }))
  })

  it('shows all available application themes', () => {
    const wrapper = mountPanel()

    expect(wrapper.text()).toContain('Ledger Teal')
    expect(wrapper.text()).toContain('Modern Blue')
    expect(wrapper.text()).toContain('Warm Sand')
    expect(wrapper.text()).toContain('Graphite Night')
  })
})

function mountPanel() {
  return mount(SettingsPanel, {
    props: { uiLocale: 'en-US', uiTheme: 'ledger-teal' },
    global: {
      plugins: [PrimeVue, createAppI18n('en-US')],
      stubs: {
        Select: { template: '<select />' },
        CompanyProfilesPanel: { template: '<div>company panel mounted</div>' },
        CustomersPanel: { template: '<div>customer panel mounted</div>' },
      },
    },
  })
}
