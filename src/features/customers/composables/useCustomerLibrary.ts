import { computed, ref, shallowRef } from 'vue'

import type { CustomerLibraryRecord } from '../utils/customerRecords'
import {
  deleteCustomerLibraryRecord,
  loadCustomerLibraryRecords,
  replaceCustomerLibraryRecords,
  saveCustomerLibraryRecord,
} from '@/shared/services/localCustomerLibraryStorage'
import { cloneSerializable } from '@/shared/utils/clone'

export function useCustomerLibrary() {
  const records = shallowRef(loadCustomerLibraryRecords())
  const selectedRecordId = ref<string | null>(records.value[0]?.id ?? null)
  const draft = ref(
    createDraftRecord(findRecord(records.value, selectedRecordId.value) ?? createEmptyCustomerLibraryRecord()),
  )

  const hasSelectedRecord = computed(() => selectedRecordId.value !== null)

  function selectRecord(recordId: string) {
    const record = findRecord(records.value, recordId)

    if (!record) {
      return
    }

    selectedRecordId.value = recordId
    draft.value = createDraftRecord(record)
  }

  function startNewRecord() {
    selectedRecordId.value = null
    draft.value = createEmptyCustomerLibraryRecord()
  }

  function saveDraft() {
    const nextRecord: CustomerLibraryRecord = {
      ...cloneSerializable(draft.value),
      updatedAt: new Date().toISOString(),
    }

    saveCustomerLibraryRecord(nextRecord)
    refreshRecords()
    selectRecord(nextRecord.id)
  }

  function deleteSelectedRecord() {
    if (!selectedRecordId.value) {
      return
    }

    deleteCustomerLibraryRecord(selectedRecordId.value)
    refreshRecords()

    if (records.value[0]) {
      selectRecord(records.value[0].id)
      return
    }

    selectedRecordId.value = null
    draft.value = createEmptyCustomerLibraryRecord()
  }

  function replaceAllRecords(nextRecords: CustomerLibraryRecord[]) {
    replaceCustomerLibraryRecords(nextRecords)
    refreshRecords()

    if (records.value[0]) {
      selectRecord(records.value[0].id)
      return
    }

    startNewRecord()
  }

  function refreshRecords() {
    records.value = loadCustomerLibraryRecords()
  }

  return {
    records,
    draft,
    selectedRecordId,
    hasSelectedRecord,
    selectRecord,
    startNewRecord,
    saveDraft,
    deleteSelectedRecord,
    replaceAllRecords,
    refreshRecords,
  }
}

export function createEmptyCustomerLibraryRecord(): CustomerLibraryRecord {
  return {
    id: crypto.randomUUID(),
    updatedAt: new Date().toISOString(),
    customerCompany: '',
    customerName: '',
    contactPerson: '',
    contactDetails: '',
  }
}

function createDraftRecord(record: CustomerLibraryRecord): CustomerLibraryRecord {
  return cloneSerializable(record)
}

function findRecord(records: CustomerLibraryRecord[], recordId: string | null) {
  if (!recordId) {
    return null
  }

  return records.find((record) => record.id === recordId) ?? null
}
