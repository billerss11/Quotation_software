import { effectScope, type EffectScope } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { CustomerLibraryRecord } from '../utils/customerRecords'
import { replaceCustomerLibraryRecords } from '@/shared/services/localCustomerLibraryStorage'
import { useCustomerLibrary } from './useCustomerLibrary'

describe('useCustomerLibrary', () => {
  const localStorageMock = createLocalStorageMock()
  let scope: EffectScope

  beforeEach(() => {
    let nextId = 1

    vi.stubGlobal('window', { localStorage: localStorageMock, quotationApp: undefined })
    vi.stubGlobal('crypto', { randomUUID: () => `customer-${nextId++}` })
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-24T10:00:00.000Z'))
    localStorageMock.clear()
    replaceCustomerLibraryRecords([])
    scope = effectScope()
  })

  afterEach(() => {
    scope.stop()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('starts idle and enters create mode without a fake timestamp', () => {
    replaceCustomerLibraryRecords([createCustomerLibraryRecord()])
    const library = createLibrary(scope)

    expect(library.editorMode.value).toBe('idle')
    expect(library.selectedRecordId.value).toBe(null)
    expect(library.draft.value.updatedAt).toBe('')

    library.startNewRecord()

    expect(library.editorMode.value).toBe('create')
    expect(library.draft.value.id).toBe('customer-1')
    expect(library.draft.value.updatedAt).toBe('')
    expect(library.isDirty.value).toBe(false)
  })

  it('rejects an invalid customer without changing storage', () => {
    const library = createLibrary(scope)
    library.startNewRecord()
    library.draft.value.contactDetails = 'details only'

    expect(library.saveDraft()).toEqual({ ok: false, errors: ['missing_identity'] })
    expect(library.records.value).toEqual([])
    expect(library.canSave.value).toBe(false)
  })

  it('saves a valid customer and tracks later edits and cancel', () => {
    const library = createLibrary(scope)
    library.startNewRecord()
    library.draft.value.customerCompany = '  Acme Industrial  '
    library.draft.value.contactDetails = 'maria@example.com'

    expect(library.isDirty.value).toBe(true)
    expect(library.canSave.value).toBe(true)
    expect(library.saveDraft()).toMatchObject({ ok: true })
    expect(library.records.value).toEqual([
      createCustomerLibraryRecord({ contactPerson: '' }),
    ])
    expect(library.editorMode.value).toBe('edit')

    library.draft.value.contactPerson = 'Maria Chen'
    expect(library.isDirty.value).toBe(true)
    library.cancelDraft()
    expect(library.draft.value.contactPerson).toBe('')
    expect(library.isDirty.value).toBe(false)
  })

  it('restores the previous selection when a new draft is canceled', () => {
    replaceCustomerLibraryRecords([createCustomerLibraryRecord({ id: 'existing' })])
    const library = createLibrary(scope)

    library.selectRecord('existing')
    library.startNewRecord()
    library.draft.value.contactPerson = 'Unsaved'
    library.cancelDraft()

    expect(library.editorMode.value).toBe('edit')
    expect(library.selectedRecordId.value).toBe('existing')
    expect(library.draft.value.customerCompany).toBe('Acme Industrial')
  })

  it('selects the most recently updated remaining record after deletion', () => {
    replaceCustomerLibraryRecords([
      createCustomerLibraryRecord({ id: 'old', updatedAt: '2026-04-20T10:00:00.000Z' }),
      createCustomerLibraryRecord({ id: 'selected', customerCompany: 'Delete me' }),
      createCustomerLibraryRecord({ id: 'recent', updatedAt: '2026-04-23T10:00:00.000Z' }),
    ])
    const library = createLibrary(scope)

    library.selectRecord('selected')
    library.deleteSelectedRecord()

    expect(library.selectedRecordId.value).toBe('recent')
    expect(library.editorMode.value).toBe('edit')
  })

  it('returns to idle when shared storage is replaced', () => {
    replaceCustomerLibraryRecords([createCustomerLibraryRecord({ id: 'existing' })])
    const library = createLibrary(scope)
    library.selectRecord('existing')

    replaceCustomerLibraryRecords([])

    expect(library.records.value).toEqual([])
    expect(library.editorMode.value).toBe('idle')
    expect(library.selectedRecordId.value).toBe(null)
    expect(library.draft.value.updatedAt).toBe('')
  })
})

function createLibrary(scope: EffectScope) {
  return scope.run(() => useCustomerLibrary())!
}

function createCustomerLibraryRecord(
  overrides: Partial<CustomerLibraryRecord> = {},
): CustomerLibraryRecord {
  return {
    id: 'customer-1',
    updatedAt: '2026-04-24T10:00:00.000Z',
    customerCompany: 'Acme Industrial',
    contactPerson: 'Maria Chen',
    contactDetails: 'maria@example.com',
    ...overrides,
  }
}

function createLocalStorageMock() {
  const store = new Map<string, string>()

  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  }
}
