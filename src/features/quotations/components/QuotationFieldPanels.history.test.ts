// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { defineComponent, nextTick } from 'vue'
import { describe, expect, it } from 'vitest'

import { createAppI18n } from '@/shared/i18n/createAppI18n'

import QuoteCustomerPanel from './QuoteCustomerPanel.vue'
import QuoteInfoPanel from './QuoteInfoPanel.vue'
import type { QuotationHeader } from '../types'

describe('quotation field panels history boundary', () => {
  it('emits quote header edits without mutating the header prop', async () => {
    const header = createHeader()
    const wrapper = mount(QuoteInfoPanel, {
      props: {
        header,
        templateId: 'legacy',
        outputItemDetailLevel: 2,
        quotationCurrencyOptions: ['USD', 'CNY'],
      },
      global: createMountOptions(),
    })

    wrapper.get('[data-history-target="header:projectName"]')
      .findComponent({ name: 'InputText' })
      .vm.$emit('update:model-value', 'Hydrogen plant')
    await nextTick()

    expect(header.projectName).toBe('')
    expect(wrapper.emitted('updateHeaderField')).toEqual([
      ['projectName', 'Hydrogen plant'],
    ])
  })

  it('emits customer header edits without mutating the header prop', async () => {
    const header = createHeader()
    const wrapper = mount(QuoteCustomerPanel, {
      props: {
        header,
        customerRecords: [],
        companyProfileRecords: [],
        selectedCompanyProfileId: null,
        companyProfileSnapshot: { companyName: '', email: '', phone: '' },
      },
      global: createMountOptions(),
    })

    wrapper.get('[data-history-target="header:customerCompany"]')
      .findComponent({ name: 'InputText' })
      .vm.$emit('update:model-value', 'Northwind')
    await nextTick()

    expect(header.customerCompany).toBe('')
    expect(wrapper.emitted('updateHeaderField')).toEqual([
      ['customerCompany', 'Northwind'],
    ])
  })
})

function createHeader(): QuotationHeader {
  return {
    quotationNumber: 'Q-001',
    revisionNumber: 1,
    quotationDate: '2026-07-12',
    customerCompany: '',
    contactPerson: '',
    contactDetails: '',
    projectName: '',
    validityPeriod: '30 days',
    currency: 'USD',
    documentLocale: 'en-US',
    notes: '',
    terms: '',
  }
}

function createMountOptions() {
  return {
    plugins: [createAppI18n('en-US')],
    stubs: {
      InputText: defineComponent({
        name: 'InputText',
        emits: ['update:model-value'],
        template: '<input />',
      }),
      InputNumber: defineComponent({
        name: 'InputNumber',
        emits: ['update:model-value'],
        template: '<input />',
      }),
      Select: defineComponent({
        name: 'Select',
        emits: ['update:model-value'],
        template: '<div><slot name="value" /><slot name="option" /></div>',
      }),
      Textarea: defineComponent({
        name: 'Textarea',
        emits: ['update:model-value'],
        template: '<textarea />',
      }),
      QuotationTemplateSelector: true,
    },
  }
}
