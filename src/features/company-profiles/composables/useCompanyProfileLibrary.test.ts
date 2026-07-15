import { effectScope, type EffectScope } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { CompanyProfileRecord } from '@/shared/services/localCompanyProfileStorage'
import { replaceCompanyProfileRecords } from '@/shared/services/localCompanyProfileStorage'
import { useCompanyProfileLibrary } from './useCompanyProfileLibrary'

describe('useCompanyProfileLibrary', () => {
  const localStorageMock = createLocalStorageMock()
  let scope: EffectScope

  beforeEach(() => {
    let nextId = 1

    vi.stubGlobal('window', { localStorage: localStorageMock, quotationApp: undefined })
    vi.stubGlobal('crypto', { randomUUID: () => `company-${nextId++}` })
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-07T10:00:00.000Z'))
    localStorageMock.clear()
    replaceCompanyProfileRecords([])
    scope = effectScope()
  })

  afterEach(() => {
    scope.stop()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('starts idle and restores the previous selection after canceling create', () => {
    replaceCompanyProfileRecords([createCompanyProfileRecord({ id: 'existing' })])
    const library = createLibrary(scope)

    expect(library.editorMode.value).toBe('idle')
    expect(library.draft.value.updatedAt).toBe('')
    library.selectRecord('existing')
    library.startNewRecord()
    library.draft.value.companyName = 'Unsaved company'
    library.cancelDraft()

    expect(library.editorMode.value).toBe('edit')
    expect(library.selectedRecordId.value).toBe('existing')
    expect(library.draft.value.companyName).toBe('CX Engineering')
  })

  it.each([
    [{ companyName: '', email: '' }, ['missing_company_name']],
    [{ companyName: 'Valid name', email: 'not-an-email' }, ['invalid_email']],
  ])('rejects invalid profiles without writing them', (values, errors) => {
    const library = createLibrary(scope)
    library.startNewRecord()
    Object.assign(library.draft.value, values)

    expect(library.saveDraft()).toEqual({ ok: false, errors })
    expect(library.records.value).toEqual([])
  })

  it('saves a valid profile and does not validate phone formatting', () => {
    const library = createLibrary(scope)
    library.startNewRecord()
    library.draft.value.companyName = '  CX Engineering  '
    library.draft.value.email = 'sales@example.com'
    library.draft.value.phone = 'phone extension seventeen'

    expect(library.canSave.value).toBe(true)
    expect(library.saveDraft()).toMatchObject({ ok: true })
    expect(library.records.value[0]).toMatchObject({
      companyName: 'CX Engineering',
      email: 'sales@example.com',
      phone: 'phone extension seventeen',
    })
    expect(library.editorMode.value).toBe('edit')
    expect(library.isDirty.value).toBe(false)
  })

  it('selects the most recent remaining profile after deletion', () => {
    replaceCompanyProfileRecords([
      createCompanyProfileRecord({ id: 'old', updatedAt: '2026-05-01T10:00:00.000Z' }),
      createCompanyProfileRecord({ id: 'selected', companyName: 'Delete me' }),
      createCompanyProfileRecord({ id: 'recent', updatedAt: '2026-05-06T10:00:00.000Z' }),
    ])
    const library = createLibrary(scope)
    library.selectRecord('selected')

    library.deleteSelectedRecord()

    expect(library.selectedRecordId.value).toBe('recent')
  })

  it('returns to idle when shared storage is replaced', () => {
    replaceCompanyProfileRecords([createCompanyProfileRecord({ id: 'existing' })])
    const library = createLibrary(scope)
    library.selectRecord('existing')

    replaceCompanyProfileRecords([])

    expect(library.records.value).toEqual([])
    expect(library.editorMode.value).toBe('idle')
    expect(library.draft.value).toMatchObject({ companyName: '', updatedAt: '' })
  })
})

function createLibrary(scope: EffectScope) {
  return scope.run(() => useCompanyProfileLibrary())!
}

function createCompanyProfileRecord(
  overrides: Partial<CompanyProfileRecord> = {},
): CompanyProfileRecord {
  return {
    id: 'company-1',
    updatedAt: '2026-05-07T10:00:00.000Z',
    companyName: 'CX Engineering',
    email: 'sales@example.com',
    phone: '+86 123 4567',
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
