import { describe, expect, it } from 'vitest'

import type { CustomerLibraryRecord } from './customerRecords'

import {
  createCustomerLibraryFileContent,
  CustomerLibraryFileError,
  parseCustomerLibraryFileContent,
} from './customerLibraryFile'

describe('customer library file JSON', () => {
  it('serializes customer library records with a schema envelope', () => {
    const parsed = JSON.parse(
      createCustomerLibraryFileContent([
        createCustomerLibraryRecord({
          customerCompany: ' Acme Industrial ',
          contactDetails: 'maria@example.com ',
        }),
      ]),
    )

    expect(parsed).toMatchObject({
      schemaVersion: 1,
      app: 'quotation-software',
      customers: [
        {
          id: 'customer-1',
          updatedAt: '2026-04-23T08:00:00.000Z',
          customerCompany: 'Acme Industrial',
          contactPerson: 'Maria Chen',
          contactDetails: 'maria@example.com',
        },
      ],
    })
    expect(typeof parsed.exportedAt).toBe('string')
  })

  it('parses a valid customer library file and removes identical records after normalization', () => {
    const content = JSON.stringify({
      schemaVersion: 1,
      app: 'quotation-software',
      exportedAt: '2026-04-24T08:00:00.000Z',
      customers: [
        createCustomerLibraryRecord({
          id: 'customer-1',
          updatedAt: '2026-04-23T08:00:00.000Z',
          customerCompany: ' Acme Industrial ',
          contactDetails: 'maria@example.com ',
        }),
        createCustomerLibraryRecord({
          id: 'customer-2',
          updatedAt: '2026-04-24T08:00:00.000Z',
          customerCompany: 'acme industrial',
          contactPerson: 'maria chen',
          contactDetails: 'MARIA@EXAMPLE.COM',
        }),
      ],
    })

    expect(parseCustomerLibraryFileContent(content)).toEqual([
      {
        id: 'customer-2',
        updatedAt: '2026-04-24T08:00:00.000Z',
        customerCompany: 'acme industrial',
        contactPerson: 'maria chen',
        contactDetails: 'MARIA@EXAMPLE.COM',
      },
    ])
  })

  it('rejects customer library records without contactPerson', () => {
    const content = JSON.stringify({
      schemaVersion: 1,
      app: 'quotation-software',
      exportedAt: '2026-04-24T08:00:00.000Z',
      customers: [
        Object.fromEntries(
          Object.entries({
            id: 'customer-1',
            updatedAt: '2026-04-23T08:00:00.000Z',
            customerCompany: 'Acme Industrial',
            customerName: 'Maria Chen',
            contactDetails: 'maria@example.com',
          }),
        ),
      ],
    })

    expect(() => parseCustomerLibraryFileContent(content)).toThrowError(CustomerLibraryFileError)

    try {
      parseCustomerLibraryFileContent(content)
    } catch (error) {
      expect((error as CustomerLibraryFileError).code).toBe('invalid_record')
    }
  })

  it('rejects a malformed customer library envelope', () => {
    expect(() =>
      parseCustomerLibraryFileContent(
        JSON.stringify({
          schemaVersion: 1,
          app: 'other-app',
          exportedAt: '2026-04-24T08:00:00.000Z',
          customers: [createCustomerLibraryRecord()],
        }),
      ),
    ).toThrowError(CustomerLibraryFileError)

    expect(() =>
      parseCustomerLibraryFileContent(
        JSON.stringify({
          schemaVersion: 1,
          app: 'quotation-software',
          exportedAt: 123,
          customers: [createCustomerLibraryRecord()],
        }),
      ),
    ).toThrowError(CustomerLibraryFileError)

    expect(() =>
      parseCustomerLibraryFileContent(
        JSON.stringify({
          schemaVersion: 1,
          app: 'quotation-software',
          exportedAt: '2026-04-24T08:00:00Z',
          customers: [createCustomerLibraryRecord()],
        }),
      ),
    ).toThrowError(CustomerLibraryFileError)
  })

  it('rejects invalid JSON', () => {
    expect(() => parseCustomerLibraryFileContent('{invalid')).toThrowError(CustomerLibraryFileError)
  })

  it('rejects non-object JSON', () => {
    expect(() => parseCustomerLibraryFileContent('[]')).toThrowError(CustomerLibraryFileError)
  })

  it('rejects files without a customer array', () => {
    expect(() =>
      parseCustomerLibraryFileContent(
        JSON.stringify({
          schemaVersion: 1,
          app: 'quotation-software',
          exportedAt: '2026-04-24T08:00:00.000Z',
        }),
      ),
    ).toThrowError(CustomerLibraryFileError)

    expect(() =>
      parseCustomerLibraryFileContent(
        JSON.stringify({
          schemaVersion: 1,
          app: 'quotation-software',
          exportedAt: '2026-04-24T08:00:00.000Z',
          customers: {},
        }),
      ),
    ).toThrowError(CustomerLibraryFileError)
  })

  it('rejects invalid customer record field types', () => {
    expect(() =>
      parseCustomerLibraryFileContent(
        JSON.stringify({
          schemaVersion: 1,
          app: 'quotation-software',
          exportedAt: '2026-04-24T08:00:00.000Z',
          customers: [
            {
              ...createCustomerLibraryRecord(),
              id: 123,
            },
          ],
        }),
      ),
    ).toThrowError(CustomerLibraryFileError)
  })

  it('rejects customer records with malformed updatedAt timestamps', () => {
    expect(() =>
      parseCustomerLibraryFileContent(
        JSON.stringify({
          schemaVersion: 1,
          app: 'quotation-software',
          exportedAt: '2026-04-24T08:00:00.000Z',
          customers: [
            {
              ...createCustomerLibraryRecord(),
              updatedAt: '2026-04-24T08:00:00Z',
            },
          ],
        }),
      ),
    ).toThrowError(CustomerLibraryFileError)
  })
})

function createCustomerLibraryRecord(
  overrides: Partial<CustomerLibraryRecord> = {},
): CustomerLibraryRecord {
  return {
    id: 'customer-1',
    updatedAt: '2026-04-23T08:00:00.000Z',
    customerCompany: 'Acme Industrial',
    contactPerson: 'Maria Chen',
    contactDetails: 'maria@example.com',
    ...overrides,
  }
}
