import { describe, expect, it } from 'vitest'

import type { CompanyProfileRecord } from './localCompanyProfileStorage'
import type { CustomerLibraryRecord } from '@/features/customers/utils/customerRecords'

import {
  createQuotationLibraryFileContent,
  parseQuotationLibraryFileContent,
  QuotationLibraryFileError,
} from './quotationLibraryFile'

describe('quotation library file JSON', () => {
  it('serializes reusable library data with a schema envelope', () => {
    const parsed = JSON.parse(createQuotationLibraryFileContent({
      companyProfiles: [createCompanyProfileRecord()],
      customers: [createCustomerLibraryRecord()],
      numbering: {
        lastIssuedYear: 2026,
        lastIssuedSequence: 12,
      },
    }))

    expect(parsed).toMatchObject({
      schemaVersion: 1,
      app: 'quotation-software',
      library: {
        companyProfiles: [
          {
            id: 'company-1',
            companyName: 'CX Engineering',
          },
        ],
        customers: [
          {
            id: 'customer-1',
            customerCompany: 'Acme Industrial',
          },
        ],
        numbering: {
          lastIssuedYear: 2026,
          lastIssuedSequence: 12,
        },
      },
    })
    expect(typeof parsed.exportedAt).toBe('string')
  })

  it('parses a valid library file and normalizes its data', () => {
    const content = JSON.stringify({
      schemaVersion: 1,
      app: 'quotation-software',
      exportedAt: '2026-05-07T08:00:00.000Z',
      library: {
        companyProfiles: [
          createCompanyProfileRecord({
            companyName: ' CX Engineering ',
            email: 'sales@example.com ',
          }),
        ],
        customers: [
          createCustomerLibraryRecord({
            customerCompany: ' Acme Industrial ',
            contactDetails: 'maria@example.com ',
          }),
        ],
        numbering: {
          lastIssuedYear: 2026,
          lastIssuedSequence: 7,
        },
      },
    })

    expect(parseQuotationLibraryFileContent(content)).toEqual({
      companyProfiles: [
        {
          id: 'company-1',
          updatedAt: '2026-05-07T08:00:00.000Z',
          companyName: 'CX Engineering',
          email: 'sales@example.com',
          phone: '+86 123 4567',
        },
      ],
      customers: [
        {
          id: 'customer-1',
          updatedAt: '2026-05-07T08:00:00.000Z',
          customerCompany: 'Acme Industrial',
          contactPerson: 'Maria Chen',
          contactDetails: 'maria@example.com',
        },
      ],
      numbering: {
        lastIssuedYear: 2026,
        lastIssuedSequence: 7,
      },
    })
  })

  it('rejects malformed library envelopes', () => {
    expect(() =>
      parseQuotationLibraryFileContent(
        JSON.stringify({
          schemaVersion: 1,
          app: 'other-app',
          exportedAt: '2026-05-07T08:00:00.000Z',
          library: {},
        }),
      ),
    ).toThrowError(QuotationLibraryFileError)
  })

  it('rejects invalid numbering values', () => {
    expect(() =>
      parseQuotationLibraryFileContent(
        JSON.stringify({
          schemaVersion: 1,
          app: 'quotation-software',
          exportedAt: '2026-05-07T08:00:00.000Z',
          library: {
            companyProfiles: [],
            customers: [],
            numbering: {
              lastIssuedYear: '2026',
              lastIssuedSequence: 2,
            },
          },
        }),
      ),
    ).toThrowError(QuotationLibraryFileError)
  })
})

function createCompanyProfileRecord(
  overrides: Partial<CompanyProfileRecord> = {},
): CompanyProfileRecord {
  return {
    id: 'company-1',
    updatedAt: '2026-05-07T08:00:00.000Z',
    companyName: 'CX Engineering',
    email: 'sales@example.com',
    phone: '+86 123 4567',
    ...overrides,
  }
}

function createCustomerLibraryRecord(
  overrides: Partial<CustomerLibraryRecord> = {},
): CustomerLibraryRecord {
  return {
    id: 'customer-1',
    updatedAt: '2026-05-07T08:00:00.000Z',
    customerCompany: 'Acme Industrial',
    contactPerson: 'Maria Chen',
    contactDetails: 'maria@example.com',
    ...overrides,
  }
}
