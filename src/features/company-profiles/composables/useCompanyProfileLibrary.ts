import { computed, getCurrentScope, onScopeDispose, ref, shallowRef } from 'vue'

import {
  deleteCompanyProfileRecord,
  loadCompanyProfileRecords,
  replaceCompanyProfileRecords,
  saveCompanyProfileRecord,
  subscribeCompanyProfileRecords,
  type CompanyProfileRecord,
} from '@/shared/services/localCompanyProfileStorage'
import { cloneSerializable } from '@/shared/utils/clone'

export type CompanyProfileEditorMode = 'idle' | 'create' | 'edit'
export type CompanyProfileValidationError = 'missing_company_name' | 'invalid_email'

export type CompanyProfileSaveResult =
  | { ok: true; record: CompanyProfileRecord }
  | { ok: false; errors: CompanyProfileValidationError[] }

export function useCompanyProfileLibrary() {
  const records = shallowRef(loadCompanyProfileRecords())
  const selectedRecordId = ref<string | null>(null)
  const editorMode = shallowRef<CompanyProfileEditorMode>('idle')
  const draft = ref(createEmptyCompanyProfileRecord())
  const baseline = ref<CompanyProfileRecord | null>(null)
  const previousSelectionId = shallowRef<string | null>(null)
  let isWriting = false

  const unsubscribe = subscribeCompanyProfileRecords((nextRecords) => {
    records.value = nextRecords

    if (isWriting) {
      return
    }

    if (editorMode.value === 'edit' && selectedRecordId.value) {
      const selectedRecord = findRecord(nextRecords, selectedRecordId.value)

      if (selectedRecord) {
        setEditRecord(selectedRecord)
        return
      }
    }

    resetEditor()
  })

  if (getCurrentScope()) {
    onScopeDispose(unsubscribe)
  }

  const hasSelectedRecord = computed(() => editorMode.value === 'edit' && selectedRecordId.value !== null)
  const validationErrors = computed(() => validateCompanyProfileRecord(draft.value))
  const isDirty = computed(() => {
    if (editorMode.value === 'idle' || !baseline.value) {
      return false
    }

    return !hasSameCompanyFields(draft.value, baseline.value)
  })
  const canSave = computed(() => isDirty.value && validationErrors.value.length === 0)

  function selectRecord(recordId: string) {
    const record = findRecord(records.value, recordId)

    if (!record) {
      return false
    }

    previousSelectionId.value = null
    setEditRecord(record)
    return true
  }

  function startNewRecord() {
    previousSelectionId.value = editorMode.value === 'edit' ? selectedRecordId.value : previousSelectionId.value
    selectedRecordId.value = null
    editorMode.value = 'create'
    draft.value = createEmptyCompanyProfileRecord(crypto.randomUUID())
    baseline.value = cloneSerializable(draft.value)
  }

  function cancelDraft() {
    if (editorMode.value === 'create') {
      const previousRecord = findRecord(records.value, previousSelectionId.value)
      previousSelectionId.value = null

      if (previousRecord) {
        setEditRecord(previousRecord)
        return
      }

      resetEditor()
      return
    }

    if (editorMode.value === 'edit' && baseline.value) {
      draft.value = cloneSerializable(baseline.value)
    }
  }

  function saveDraft(): CompanyProfileSaveResult {
    const errors = validateCompanyProfileRecord(draft.value)

    if (errors.length > 0 || editorMode.value === 'idle') {
      return { ok: false, errors }
    }

    const nextRecord: CompanyProfileRecord = {
      id: draft.value.id || crypto.randomUUID(),
      updatedAt: new Date().toISOString(),
      companyName: draft.value.companyName.trim().replace(/\s+/g, ' '),
      email: draft.value.email.trim(),
      phone: draft.value.phone.trim().replace(/\s+/g, ' '),
    }

    isWriting = true
    try {
      saveCompanyProfileRecord(nextRecord)
    } finally {
      isWriting = false
    }
    records.value = loadCompanyProfileRecords()
    previousSelectionId.value = null
    setEditRecord(findRecord(records.value, nextRecord.id) ?? nextRecord)
    return { ok: true, record: cloneSerializable(nextRecord) }
  }

  function deleteSelectedRecord() {
    if (!selectedRecordId.value) {
      return false
    }

    const deletedId = selectedRecordId.value
    isWriting = true
    try {
      deleteCompanyProfileRecord(deletedId)
    } finally {
      isWriting = false
    }
    records.value = loadCompanyProfileRecords()

    const nextRecord = getMostRecentRecord(records.value)
    if (nextRecord) {
      setEditRecord(nextRecord)
    } else {
      resetEditor()
    }
    return true
  }

  function replaceAllRecords(nextRecords: CompanyProfileRecord[]) {
    replaceCompanyProfileRecords(nextRecords)
    records.value = loadCompanyProfileRecords()
    resetEditor()
  }

  function refreshRecords() {
    records.value = loadCompanyProfileRecords()
  }

  function setEditRecord(record: CompanyProfileRecord) {
    selectedRecordId.value = record.id
    editorMode.value = 'edit'
    draft.value = cloneSerializable(record)
    baseline.value = cloneSerializable(record)
  }

  function resetEditor() {
    selectedRecordId.value = null
    editorMode.value = 'idle'
    draft.value = createEmptyCompanyProfileRecord()
    baseline.value = null
    previousSelectionId.value = null
  }

  return {
    records,
    draft,
    selectedRecordId,
    editorMode,
    hasSelectedRecord,
    validationErrors,
    isDirty,
    canSave,
    selectRecord,
    startNewRecord,
    cancelDraft,
    saveDraft,
    deleteSelectedRecord,
    replaceAllRecords,
    refreshRecords,
  }
}

export function createEmptyCompanyProfileRecord(id = ''): CompanyProfileRecord {
  return {
    id,
    updatedAt: '',
    companyName: '',
    email: '',
    phone: '',
  }
}

export function validateCompanyProfileRecord(
  record: CompanyProfileRecord,
): CompanyProfileValidationError[] {
  const errors: CompanyProfileValidationError[] = []

  if (!record.companyName.trim()) {
    errors.push('missing_company_name')
  }

  if (record.email.trim() && !isValidEmail(record.email.trim())) {
    errors.push('invalid_email')
  }

  return errors
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function hasSameCompanyFields(left: CompanyProfileRecord, right: CompanyProfileRecord) {
  return left.companyName === right.companyName
    && left.email === right.email
    && left.phone === right.phone
}

function findRecord(records: CompanyProfileRecord[], recordId: string | null) {
  if (!recordId) {
    return null
  }

  return records.find((record) => record.id === recordId) ?? null
}

function getMostRecentRecord(records: CompanyProfileRecord[]) {
  return [...records].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null
}
