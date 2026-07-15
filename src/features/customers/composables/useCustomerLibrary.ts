import { computed, getCurrentScope, onScopeDispose, ref, shallowRef } from 'vue'

import type { CustomerLibraryRecord } from '../utils/customerRecords'
import { normalizeCustomerRecordFields } from '../utils/customerRecords'
import {
  deleteCustomerLibraryRecord,
  loadCustomerLibraryRecords,
  replaceCustomerLibraryRecords,
  saveCustomerLibraryRecord,
  subscribeCustomerLibraryRecords,
} from '@/shared/services/localCustomerLibraryStorage'
import { cloneSerializable } from '@/shared/utils/clone'

export type CustomerEditorMode = 'idle' | 'create' | 'edit'
export type CustomerValidationError = 'missing_identity'

export type CustomerSaveResult =
  | { ok: true; record: CustomerLibraryRecord }
  | { ok: false; errors: CustomerValidationError[] }

export function useCustomerLibrary() {
  const records = shallowRef(loadCustomerLibraryRecords())
  const selectedRecordId = ref<string | null>(null)
  const editorMode = shallowRef<CustomerEditorMode>('idle')
  const draft = ref(createEmptyCustomerLibraryRecord())
  const baseline = ref<CustomerLibraryRecord | null>(null)
  const previousSelectionId = shallowRef<string | null>(null)
  let isWriting = false

  const unsubscribe = subscribeCustomerLibraryRecords((nextRecords) => {
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
  const validationErrors = computed(() => validateCustomerRecord(draft.value))
  const isDirty = computed(() => {
    if (editorMode.value === 'idle' || !baseline.value) {
      return false
    }

    return !hasSameCustomerFields(draft.value, baseline.value)
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
    draft.value = createEmptyCustomerLibraryRecord(crypto.randomUUID())
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

  function saveDraft(): CustomerSaveResult {
    const errors = validateCustomerRecord(draft.value)

    if (errors.length > 0 || editorMode.value === 'idle') {
      return { ok: false, errors }
    }

    const normalizedFields = normalizeCustomerRecordFields(draft.value)
    const nextRecord: CustomerLibraryRecord = {
      id: draft.value.id || crypto.randomUUID(),
      updatedAt: new Date().toISOString(),
      ...normalizedFields,
    }

    isWriting = true
    try {
      saveCustomerLibraryRecord(nextRecord)
    } finally {
      isWriting = false
    }
    records.value = loadCustomerLibraryRecords()
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
      deleteCustomerLibraryRecord(deletedId)
    } finally {
      isWriting = false
    }
    records.value = loadCustomerLibraryRecords()

    const nextRecord = getMostRecentRecord(records.value)
    if (nextRecord) {
      setEditRecord(nextRecord)
    } else {
      resetEditor()
    }
    return true
  }

  function replaceAllRecords(nextRecords: CustomerLibraryRecord[]) {
    replaceCustomerLibraryRecords(nextRecords)
    records.value = loadCustomerLibraryRecords()
    resetEditor()
  }

  function refreshRecords() {
    records.value = loadCustomerLibraryRecords()
  }

  function setEditRecord(record: CustomerLibraryRecord) {
    selectedRecordId.value = record.id
    editorMode.value = 'edit'
    draft.value = cloneSerializable(record)
    baseline.value = cloneSerializable(record)
  }

  function resetEditor() {
    selectedRecordId.value = null
    editorMode.value = 'idle'
    draft.value = createEmptyCustomerLibraryRecord()
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

export function createEmptyCustomerLibraryRecord(id = ''): CustomerLibraryRecord {
  return {
    id,
    updatedAt: '',
    customerCompany: '',
    contactPerson: '',
    contactDetails: '',
  }
}

export function validateCustomerRecord(record: CustomerLibraryRecord): CustomerValidationError[] {
  if (!record.customerCompany.trim() && !record.contactPerson.trim()) {
    return ['missing_identity']
  }

  return []
}

function hasSameCustomerFields(left: CustomerLibraryRecord, right: CustomerLibraryRecord) {
  return left.customerCompany === right.customerCompany
    && left.contactPerson === right.contactPerson
    && left.contactDetails === right.contactDetails
}

function findRecord(records: CustomerLibraryRecord[], recordId: string | null) {
  if (!recordId) {
    return null
  }

  return records.find((record) => record.id === recordId) ?? null
}

function getMostRecentRecord(records: CustomerLibraryRecord[]) {
  return [...records].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null
}
