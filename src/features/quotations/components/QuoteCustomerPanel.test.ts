// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createAppI18n } from '@/shared/i18n/createAppI18n'
import { createInitialQuotation } from '../utils/quotationDraft'
import QuoteCustomerPanel from './QuoteCustomerPanel.vue'

describe('QuoteCustomerPanel management shortcuts', () => {
  afterEach(() => vi.unstubAllGlobals())

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
