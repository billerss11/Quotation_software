import { describe, expect, it } from 'vitest'

import type { CustomerLibraryRecord, CustomerRecordFields } from './customerRecords'

import { findMatchingCustomerRecord, getCustomerRecordLabel } from './customerSelection'

describe('customer selection', () => {
  it('finds the saved customer that matches the current header fields', () => {
    const records = [
      createCustomerRecord({
        id: 'customer-1',
        customerCompany: 'Schlumberger',
        contactPerson: 'Catalin Florin Ion',
        contactDetails: 'cion@slb.com',
      }),
      createCustomerRecord({
        id: 'customer-2',
        customerCompany: 'Baker Hughes',
        contactPerson: 'Ava Torres',
        contactDetails: 'ava@example.com',
      }),
    ]

    expect(
      findMatchingCustomerRecord(records, {
        customerCompany: 'Schlumberger',
        contactPerson: 'Catalin Florin Ion',
        contactDetails: 'cion@slb.com',
      }),
    ).toEqual(records[0])
  })

  it('returns null when the current fields do not match a saved customer', () => {
    const records = [
      createCustomerRecord({
        customerCompany: 'Schlumberger',
        contactPerson: 'Catalin Florin Ion',
        contactDetails: 'cion@slb.com',
      }),
    ]

    expect(
      findMatchingCustomerRecord(records, {
        customerCompany: 'Schlumberger',
        contactPerson: 'Different Contact',
        contactDetails: 'cion@slb.com',
      }),
    ).toBeNull()
  })

  it('prefers the company name for dropdown labels and falls back to contact person', () => {
    expect(
      getCustomerRecordLabel(
        createCustomerRecord({
          customerCompany: 'Schlumberger',
          contactPerson: 'Catalin Florin Ion',
        }),
      ),
    ).toBe('Schlumberger')

    expect(
      getCustomerRecordLabel(
        createCustomerRecord({
          customerCompany: '',
          contactPerson: 'Catalin Florin Ion',
        }),
      ),
    ).toBe('Catalin Florin Ion')
  })
})

function createCustomerRecord(
  overrides: Partial<CustomerLibraryRecord & CustomerRecordFields> = {},
): CustomerLibraryRecord {
  return {
    id: 'customer-1',
    updatedAt: '2026-04-27T08:00:00.000Z',
    customerCompany: 'Acme Industrial',
    contactPerson: 'Maria Chen',
    contactDetails: 'maria@example.com',
    ...overrides,
  }
}
