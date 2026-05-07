import { computed, getCurrentScope, onScopeDispose, ref, shallowRef } from 'vue'

import {
  createDefaultCompanyProfileRecord,
  deleteCompanyProfileRecord,
  loadCompanyProfileRecords,
  replaceCompanyProfileRecords,
  saveCompanyProfileRecord,
  subscribeCompanyProfileRecords,
  type CompanyProfileRecord,
} from '@/shared/services/localCompanyProfileStorage'
import { cloneSerializable } from '@/shared/utils/clone'

export function useCompanyProfileLibrary() {
  const records = shallowRef(loadCompanyProfileRecords())
  const selectedRecordId = ref<string | null>(records.value[0]?.id ?? null)
  const draft = ref(
    createDraftRecord(findRecord(records.value, selectedRecordId.value) ?? createEmptyCompanyProfileRecord()),
  )
  const unsubscribe = subscribeCompanyProfileRecords((nextRecords) => {
    records.value = nextRecords

    if (selectedRecordId.value) {
      const selectedRecord = findRecord(nextRecords, selectedRecordId.value)

      if (selectedRecord) {
        draft.value = createDraftRecord(selectedRecord)
        return
      }
    }

    if (nextRecords[0]) {
      selectedRecordId.value = nextRecords[0].id
      draft.value = createDraftRecord(nextRecords[0])
      return
    }

    selectedRecordId.value = null
    draft.value = createEmptyCompanyProfileRecord()
  })

  if (getCurrentScope()) {
    onScopeDispose(unsubscribe)
  }

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
    draft.value = createEmptyCompanyProfileRecord()
  }

  function saveDraft() {
    const nextRecord: CompanyProfileRecord = {
      ...cloneSerializable(draft.value),
      updatedAt: new Date().toISOString(),
    }

    saveCompanyProfileRecord(nextRecord)
    refreshRecords()
    selectRecord(nextRecord.id)
  }

  function deleteSelectedRecord() {
    if (!selectedRecordId.value) {
      return
    }

    deleteCompanyProfileRecord(selectedRecordId.value)
    refreshRecords()

    if (records.value[0]) {
      selectRecord(records.value[0].id)
      return
    }

    selectedRecordId.value = null
    draft.value = createEmptyCompanyProfileRecord()
  }

  function replaceAllRecords(nextRecords: CompanyProfileRecord[]) {
    replaceCompanyProfileRecords(nextRecords)
    refreshRecords()

    if (records.value[0]) {
      selectRecord(records.value[0].id)
      return
    }

    startNewRecord()
  }

  function refreshRecords() {
    records.value = loadCompanyProfileRecords()
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

export function createEmptyCompanyProfileRecord(): CompanyProfileRecord {
  return createDefaultCompanyProfileRecord()
}

function createDraftRecord(record: CompanyProfileRecord): CompanyProfileRecord {
  return cloneSerializable(record)
}

function findRecord(records: CompanyProfileRecord[], recordId: string | null) {
  if (!recordId) {
    return null
  }

  return records.find((record) => record.id === recordId) ?? null
}
