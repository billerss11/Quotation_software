import { describe, expect, it } from 'vitest'

import type { CustomerLibraryRecord } from './customerRecords'

import { createCustomerLibraryFileContent, parseCustomerLibraryFileContent } from './customerLibraryFile'

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
          customerName: 'Maria Chen',
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
          customerName: ' maria chen ',
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
        customerName: 'maria chen',
        contactPerson: 'maria chen',
        contactDetails: 'MARIA@EXAMPLE.COM',
      },
    ])
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
    ).toThrow('Customer library file has an invalid envelope.')

    expect(() =>
      parseCustomerLibraryFileContent(
        JSON.stringify({
          schemaVersion: 1,
          app: 'quotation-software',
          exportedAt: 123,
          customers: [createCustomerLibraryRecord()],
        }),
      ),
    ).toThrow('Customer library file has an invalid envelope.')

    expect(() =>
      parseCustomerLibraryFileContent(
        JSON.stringify({
          schemaVersion: 1,
          app: 'quotation-software',
          exportedAt: '2026-04-24T08:00:00Z',
          customers: [createCustomerLibraryRecord()],
        }),
      ),
    ).toThrow('Customer library file has an invalid envelope.')
  })

  it('rejects invalid JSON', () => {
    expect(() => parseCustomerLibraryFileContent('{invalid')).toThrow(
      'Customer library file is not valid JSON.',
    )
  })

  it('rejects non-object JSON', () => {
    expect(() => parseCustomerLibraryFileContent('[]')).toThrow(
      'Customer library file must contain a JSON object.',
    )
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
    ).toThrow('Customer library file is missing customer data.')

    expect(() =>
      parseCustomerLibraryFileContent(
        JSON.stringify({
          schemaVersion: 1,
          app: 'quotation-software',
          exportedAt: '2026-04-24T08:00:00.000Z',
          customers: {},
        }),
      ),
    ).toThrow('Customer library file is missing customer data.')
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
    ).toThrow('Customer library file contains an invalid customer record.')
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
    ).toThrow('Customer library file contains an invalid customer record.')
  })
})

function createCustomerLibraryRecord(
  overrides: Partial<CustomerLibraryRecord> = {},
): CustomerLibraryRecord {
  return {
    id: 'customer-1',
    updatedAt: '2026-04-23T08:00:00.000Z',
    customerCompany: 'Acme Industrial',
    customerName: 'Maria Chen',
    contactPerson: 'Maria Chen',
    contactDetails: 'maria@example.com',
    ...overrides,
  }
}
