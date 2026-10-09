// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createAppI18n } from '@/shared/i18n/createAppI18n'
import type { SupportedLocale } from '@/shared/i18n/locale'
import { createInitialQuotation } from '../utils/quotationDraft'
import QuoteCustomerPanel from './QuoteCustomerPanel.vue'

describe('QuoteCustomerPanel', () => {
  afterEach(() => vi.unstubAllGlobals())

  it.each<SupportedLocale>(['en-US', 'zh-CN'])('allows company entry without saved profiles in %s', async (locale) => {
    const quotation = createInitialQuotation([], locale)
    const originalCompany = { ...quotation.companyProfileSnapshot }
    const wrapper = mount(QuoteCustomerPanel, {
      props: {
        header: quotation.header,
        customerRecords: [],
        companyProfileRecords: [],
        selectedCompanyProfileId: null,
        companyProfileSnapshot: quotation.companyProfileSnapshot,
      },
      global: { plugins: [PrimeVue, createAppI18n(locale)] },
    })

    await wrapper.get('[data-history-target="company:companyName"] input').setValue('Quotation Company')
    await wrapper.get('[data-history-target="company:phone"] input').setValue('+86 12345678')
    await wrapper.get('[data-history-target="company:email"] input').setValue('quote@example.com')

    expect(wrapper.emitted('updateCompanyProfileField')).toEqual([
      ['companyName', 'Quotation Company'],
      ['phone', '+86 12345678'],
      ['email', 'quote@example.com'],
    ])
    expect(quotation.companyProfileSnapshot).toEqual(originalCompany)
    expect(wrapper.get('[data-history-target="company:companyName"]').text()).toBe(
      locale === 'en-US' ? 'Company Name' : '公司名称',
    )
    wrapper.unmount()
  })

  it('emits typed management actions beside both empty selectors', async () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'quotation-1' })
    const quotation = createInitialQuotation([], 'en-US')
    const wrapper = mount(QuoteCustomerPanel, {
      props: {
        header: quotation.header,
        customerRecords: [],
        companyProfileRecords: [],
        selectedCompanyProfileId: null,
        companyProfileSnapshot: quotation.companyProfileSnapshot,
      },
      global: { plugins: [PrimeVue, createAppI18n('en-US')] },
    })

    await wrapper.findAll('button').find((button) => button.text().includes('Manage profiles'))!.trigger('click')
    await wrapper.findAll('button').find((button) => button.text().includes('Manage customers'))!.trigger('click')

    expect(wrapper.emitted('manageCompanyProfiles')).toHaveLength(1)
    expect(wrapper.emitted('manageCustomers')).toHaveLength(1)
  })
})
