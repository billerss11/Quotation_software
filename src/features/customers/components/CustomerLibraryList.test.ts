// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import { describe, expect, it } from 'vitest'

import { createAppI18n } from '@/shared/i18n/createAppI18n'
import type { CustomerLibraryRecord } from '../utils/customerRecords'
import CustomerLibraryList from './CustomerLibraryList.vue'

describe('CustomerLibraryList', () => {
  it('shows search only above six records, sorts by recent update, and filters results', async () => {
    const records = Array.from({ length: 7 }, (_, index) => createRecord(index))
    records[2] = createRecord(2, { customerCompany: 'Needle Company' })
    const wrapper = mount(CustomerLibraryList, {
      props: { records, selectedRecordId: null },
      global: { plugins: [PrimeVue, createAppI18n('en-US')] },
    })

    expect(wrapper.find('input[type="search"]').exists()).toBe(true)
    expect(wrapper.findAll('.record-card strong')[0]?.text()).toBe('Company 6')

    await wrapper.get('input[type="search"]').setValue('needle')

    expect(wrapper.findAll('.record-card')).toHaveLength(1)
    expect(wrapper.get('.record-card strong').text()).toBe('Needle Company')
  })

  it('does not show search for six records', () => {
    const wrapper = mount(CustomerLibraryList, {
      props: { records: Array.from({ length: 6 }, (_, index) => createRecord(index)), selectedRecordId: null },
      global: { plugins: [PrimeVue, createAppI18n('zh-CN')] },
    })

    expect(wrapper.find('input[type="search"]').exists()).toBe(false)
  })
})

function createRecord(index: number, overrides: Partial<CustomerLibraryRecord> = {}): CustomerLibraryRecord {
  return {
    id: `customer-${index}`,
    updatedAt: `2026-07-${String(index + 1).padStart(2, '0')}T10:00:00.000Z`,
    customerCompany: `Company ${index}`,
    contactPerson: `Contact ${index}`,
    contactDetails: `contact-${index}@example.com`,
    ...overrides,
  }
}
