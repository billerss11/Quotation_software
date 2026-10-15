// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { defineComponent, shallowRef } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import App from './App.vue'
import { createAppI18n } from './shared/i18n/createAppI18n'
import type { SupportedLocale } from './shared/i18n/locale'
import { enUsShell, zhCnShell } from './shared/i18n/shellMessages'

const mocks = vi.hoisted(() => ({
  saveAppSettings: vi.fn(),
  applyAppTheme: vi.fn(),
}))

vi.mock('./shared/services/localAppSettingsStorage', () => ({
  saveAppSettings: mocks.saveAppSettings,
}))

vi.mock('./shared/theme/appTheme', async (importOriginal) => ({
  ...await importOriginal<typeof import('./shared/theme/appTheme')>(),
  applyAppTheme: mocks.applyAppTheme,
}))

const QuotationEditorStub = defineComponent({
  emits: ['manageCustomers', 'manageCompanyProfiles'],
  setup() {
    return { draft: shallowRef('') }
  },
  template: '<section data-testid="editor"><input v-model="draft" /><button data-testid="manage-customers" @click="$emit(\'manageCustomers\')" /><button data-testid="manage-companies" @click="$emit(\'manageCompanyProfiles\')" /></section>',
})

const SettingsPanelStub = defineComponent({
  props: { activeSection: String, hideNavigation: Boolean },
  setup() {
    return { draft: shallowRef('') }
  },
  template: '<section data-testid="settings" :data-section="activeSection"><input v-model="draft" /></section>',
})

describe('App navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('opens libraries directly while preserving the quotation and library drafts', async () => {
    const wrapper = mountApp()
    const editor = wrapper.get('[data-testid="editor"]')
    const settings = wrapper.get('[data-testid="settings"]')

    await editor.get('input').setValue('Unsaved quotation')
    await wrapper.get('[data-nav="customers"]').trigger('click')

    expect(settings.attributes('data-section')).toBe('customers')
    expect((editor.element as HTMLElement).style.display).toBe('none')
    expect((wrapper.get('.padded-module').element as HTMLElement).style.display).not.toBe('none')
    expect(wrapper.get('[data-nav="customers"]').attributes('aria-current')).toBe('page')
    expect(wrapper.findComponent(SettingsPanelStub).props('hideNavigation')).toBe(true)

    await settings.get('input').setValue('Unsaved library draft')
    await wrapper.get('[data-nav="companyProfiles"]').trigger('click')
    expect(settings.attributes('data-section')).toBe('companyProfiles')

    await wrapper.get('[data-nav="quotation"]').trigger('click')
    expect((editor.element as HTMLElement).style.display).not.toBe('none')
    expect((editor.get('input').element as HTMLInputElement).value).toBe('Unsaved quotation')

    await wrapper.get('[data-nav="general"]').trigger('click')
    expect(settings.attributes('data-section')).toBe('general')
    expect((settings.get('input').element as HTMLInputElement).value).toBe('Unsaved library draft')
  })

  it('keeps quotation management shortcuts connected to their library pages', async () => {
    const wrapper = mountApp()

    await wrapper.get('[data-testid="manage-customers"]').trigger('click')
    expect(wrapper.get('[data-nav="customers"]').attributes('aria-current')).toBe('page')
    expect(wrapper.get('[data-testid="settings"]').attributes('data-section')).toBe('customers')

    await wrapper.get('[data-nav="quotation"]').trigger('click')
    await wrapper.get('[data-testid="manage-companies"]').trigger('click')
    expect(wrapper.get('[data-nav="companyProfiles"]').attributes('aria-current')).toBe('page')
    expect(wrapper.get('[data-testid="settings"]').attributes('data-section')).toBe('companyProfiles')
  })

  it.each([
    ['en-US', enUsShell],
    ['zh-CN', zhCnShell],
  ] as const)('labels navigation and the skip link in %s', (locale, messages) => {
    const wrapper = mountApp(locale)

    expect(wrapper.get('[data-nav="quotation"]').text()).toBe(messages.navigation.quotation)
    expect(wrapper.get('[data-nav="customers"]').attributes('aria-label')).toBe(messages.navigation.customers)
    expect(wrapper.get('[data-nav="companyProfiles"]').attributes('aria-label')).toBe(messages.navigation.companyProfiles)
    expect(wrapper.get('.skip-link').text()).toBe(messages.skipToContent)
    expect(wrapper.get('[data-nav="quotation"]').attributes('aria-current')).toBe('page')
  })
})

function mountApp(locale: SupportedLocale = 'en-US') {
  return mount(App, {
    props: { initialUiLocale: locale, initialUiTheme: 'ledger-teal' },
    global: {
      plugins: [createAppI18n(locale)],
      stubs: {
        Toast: true,
        ConfirmDialog: true,
        QuotationEditor: QuotationEditorStub,
        SettingsPanel: SettingsPanelStub,
        UserManual: true,
      },
    },
  })
}
