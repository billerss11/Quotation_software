// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import { describe, expect, it } from 'vitest'

import { createAppI18n } from '@/shared/i18n/createAppI18n'
import type { CompanyProfileRecord } from '@/shared/services/localCompanyProfileStorage'
import CompanyProfileLibraryList from './CompanyProfileLibraryList.vue'

describe('CompanyProfileLibraryList', () => {
  it('sorts recent profiles first and filters when the library is large', async () => {
    const records = Array.from({ length: 7 }, (_, index) => createRecord(index))
    records[1] = createRecord(1, { companyName: 'Needle Industries' })
    const wrapper = mount(CompanyProfileLibraryList, {
      props: { records, selectedRecordId: null },
      global: { plugins: [PrimeVue, createAppI18n('en-US')] },
    })

    expect(wrapper.findAll('.record-card strong')[0]?.text()).toBe('Company 6')
    await wrapper.get('input[type="search"]').setValue('needle')
    expect(wrapper.findAll('.record-card')).toHaveLength(1)
    expect(wrapper.get('.record-card strong').text()).toBe('Needle Industries')
  })
})

function createRecord(index: number, overrides: Partial<CompanyProfileRecord> = {}): CompanyProfileRecord {
  return {
    id: `company-${index}`,
    updatedAt: `2026-07-${String(index + 1).padStart(2, '0')}T10:00:00.000Z`,
    companyName: `Company ${index}`,
    phone: `100${index}`,
    email: `company-${index}@example.com`,
    ...overrides,
  }
}
