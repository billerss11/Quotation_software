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
  openActivityHistoryFolder: vi.fn(),
  appendActivityHistoryEntry: vi.fn(),
  runtimeState: { isDesktop: true },
}))

vi.mock('@/shared/runtime/quotationRuntime', () => ({
  getQuotationRuntime: () => ({
    capabilities: {
      isDesktop: mocks.runtimeState.isDesktop,
      hasNativeFileDialogs: mocks.runtimeState.isDesktop,
      supportsFileSystemAccess: false,
      supportsDirectPdfExport: mocks.runtimeState.isDesktop,
      supportsBrowserPrint: !mocks.runtimeState.isDesktop,
    },
    openActivityHistoryFolder: mocks.openActivityHistoryFolder,
    appendActivityHistoryEntry: mocks.appendActivityHistoryEntry,
  }),
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
    Object.values(mocks).forEach((mock) => {
      if (typeof mock === 'function' && 'mockReset' in mock) mock.mockReset()
    })
    mocks.runtimeState.isDesktop = true
    mocks.openActivityHistoryFolder.mockResolvedValue({ ok: true, folderPath: 'C:/AppData/Quotation Activity History - Safe to Delete' })
    mocks.appendActivityHistoryEntry.mockResolvedValue({ ok: true, folderPath: 'C:/AppData/history' })
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

  it('shows the desktop activity-history limits and opens its folder', async () => {
    const wrapper = mountPanel()

    expect(wrapper.text()).toContain('Quotation Activity History - Safe to Delete')
    expect(wrapper.text()).toContain('100 MB')
    expect(wrapper.text()).toContain('Deleting this folder does not affect quotations.')

    await wrapper.findAll('button').find((button) => button.text() === 'Open activity history folder')!.trigger('click')
    await flushPromises()

    expect(mocks.openActivityHistoryFolder).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('Opened activity history folder')
  })

  it('shows activity-history guidance in Chinese', () => {
    const wrapper = mountPanel('zh-CN')

    expect(wrapper.text()).toContain('操作历史')
    expect(wrapper.text()).toContain('删除此文件夹不会影响报价。')
    expect(wrapper.text()).toContain('Quotation Activity History - Safe to Delete')
  })

  it('does not show activity-history controls in the web build', () => {
    mocks.runtimeState.isDesktop = false
    const wrapper = mountPanel()

    expect(wrapper.text()).not.toContain('Open activity history folder')
  })
})

function mountPanel(locale: 'en-US' | 'zh-CN' = 'en-US') {
  return mount(SettingsPanel, {
    props: { uiLocale: locale, uiTheme: 'ledger-teal' },
    global: {
      plugins: [PrimeVue, createAppI18n(locale)],
      stubs: {
        Select: { template: '<select />' },
        CompanyProfilesPanel: { template: '<div>company panel mounted</div>' },
        CustomersPanel: { template: '<div>customer panel mounted</div>' },
      },
    },
  })
}
