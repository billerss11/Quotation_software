// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createAppI18n } from '@/shared/i18n/createAppI18n'
import type { SupportedLocale } from '@/shared/i18n/locale'

import { createInitialQuotation } from '../utils/quotationDraft'
import QuotationCommandBar from './QuotationCommandBar.vue'

describe('QuotationCommandBar', () => {
  const wrappers: ReturnType<typeof mountBar>['wrapper'][] = []

  beforeEach(() => {
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  })

  afterEach(() => {
    wrappers.forEach(wrapper => wrapper.unmount())
    wrappers.length = 0
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
  })

  it.each(['en-US', 'zh-CN'] as const)('keeps secondary exports available through the %s export menu', async locale => {
    const { wrapper, t } = mountBar(locale)
    wrappers.push(wrapper)

    expect(wrapper.get('h1').text()).toBe('Plant equipment')
    await wrapper.get(`button[aria-label="${t('quotations.commandBar.exportAria')}"]`).trigger('click')
    await flushPromises()
    const excel = getMenuItem(t('quotations.excel.title'))
    expect(excel.getAttribute('aria-disabled')).not.toBe('true')
    excel.querySelector('a')!.click()
    await flushPromises()
    expect(wrapper.emitted('exportExcel')).toHaveLength(1)

    await wrapper.get(`button[aria-label="${t('quotations.commandBar.exportAria')}"]`).trigger('click')
    await flushPromises()
    getMenuItem(t('quotations.commandBar.generateGoodsReceipt')).querySelector('a')!.click()
    await flushPromises()
    expect(wrapper.emitted('generateGoodsReceipt')).toHaveLength(1)
  })

  it('preserves saved-revision and empty-receipt restrictions in the export menu', async () => {
    const { wrapper, t } = mountBar('en-US')
    wrappers.push(wrapper)
    const openExports = () => wrapper.get(`button[aria-label="${t('quotations.commandBar.exportAria')}"]`).trigger('click')

    await wrapper.setProps({ hasGoodsReceiptItems: false })
    await openExports()
    await flushPromises()
    expect(getMenuItem(t('quotations.commandBar.generateGoodsReceipt')).getAttribute('aria-disabled')).toBe('true')
    getMenuItem(t('quotations.commandBar.generateGoodsReceipt')).querySelector('a')!.click()
    await flushPromises()
    expect(wrapper.emitted('generateGoodsReceipt')).toBeUndefined()
    await openExports()

    await wrapper.setProps({ hasGoodsReceiptItems: true, selectedRevisionId: 'saved-1' })
    await openExports()
    await flushPromises()
    expect(getMenuItem(t('quotations.commandBar.generateGoodsReceipt')).getAttribute('aria-disabled')).toBe('true')
    expect(getMenuItem(t('quotations.excel.title')).getAttribute('aria-disabled')).not.toBe('true')
    expect(wrapper.findAll('.workspace-toggle-button').every(button => button.attributes('disabled') !== undefined)).toBe(true)
    expect(wrapper.get(`button[aria-label="${t('quotations.commandBar.print')}"]`).attributes('disabled')).toBeDefined()
    expect(wrapper.get(`button[aria-label="${t('quotations.commandBar.more')}"]`).attributes('disabled')).toBeDefined()

    await wrapper.setProps({ supportsDirectPdfExport: true })
    expect(wrapper.get(`button[aria-label="${t('quotations.commandBar.exportPdf')}"]`).attributes('disabled')).toBeUndefined()
  })
})

function mountBar(locale: SupportedLocale) {
  const i18n = createAppI18n(locale)
  const quotation = createInitialQuotation([], locale)
  quotation.header.projectName = 'Plant equipment'
  const wrapper = mount(QuotationCommandBar, {
    attachTo: document.body,
    props: {
      header: quotation.header,
      statusMessage: '',
      currentFilePath: '',
      hasNativeFileDialogs: false,
      supportsDirectPdfExport: false,
      workspaceMode: 'editor',
      hasImportReport: false,
      importReportIssueCount: 0,
      importReportHasErrors: false,
      hasGoodsReceiptItems: true,
    },
    global: {
      plugins: [i18n, [PrimeVue, { unstyled: true }]],
      directives: { tooltip: {} },
    },
  })
  return { wrapper, t: i18n.global.t }
}

function getMenuItem(label: string) {
  const item = document.querySelector<HTMLElement>(`[role="menuitem"][aria-label="${label}"]`)
  expect(item).not.toBeNull()
  return item!
}
