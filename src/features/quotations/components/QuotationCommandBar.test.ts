// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
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

  it.each(['en-US', 'zh-CN'] as const)('opens Files from one translated %s trigger', async locale => {
    const { wrapper, t } = mountBar(locale)
    wrappers.push(wrapper)

    expect(wrapper.get('h1').text()).toBe('Plant equipment')
    const triggers = wrapper.findAll(`button[aria-label="${t('quotations.files.openAria')}"]`)
    expect(triggers).toHaveLength(1)
    const trigger = triggers[0]!
    expect(trigger.text()).toBe(t('quotations.files.title'))
    expect(trigger.attributes('aria-haspopup')).toBe('dialog')
    expect(trigger.attributes('aria-expanded')).toBe('false')
    await trigger.trigger('click')
    expect(wrapper.emitted('openFiles')).toHaveLength(1)
    await wrapper.setProps({ filesVisible: true })
    expect(trigger.attributes('aria-expanded')).toBe('true')
  })

  it('keeps Files and preview available while viewing a saved revision', async () => {
    const { wrapper, t } = mountBar('en-US')
    wrappers.push(wrapper)
    await wrapper.setProps({ selectedRevisionId: 'saved-1' })
    expect(wrapper.findAll('.workspace-toggle-button').every(button => button.attributes('disabled') !== undefined)).toBe(true)
    const files = wrapper.get(`button[aria-label="${t('quotations.files.openAria')}"]`)
    const preview = wrapper.get(`button[aria-label="${t('quotations.commandBar.preview')}"]`)
    expect(files.attributes('disabled')).toBeUndefined()
    expect(preview.attributes('disabled')).toBeUndefined()
    await files.trigger('click')
    await preview.trigger('click')
    expect(wrapper.emitted('openFiles')).toHaveLength(1)
    expect(wrapper.emitted('openPreview')).toHaveLength(1)
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
      workspaceMode: 'editor',
      hasImportReport: false,
      importReportIssueCount: 0,
      importReportHasErrors: false,
      filesVisible: false,
    },
    global: {
      plugins: [i18n, [PrimeVue, { unstyled: true }]],
      directives: { tooltip: {} },
    },
  })
  return { wrapper, t: i18n.global.t }
}
