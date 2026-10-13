import { getCurrentScope, onScopeDispose, shallowRef } from 'vue'
import type { Ref } from 'vue'

import type { CustomerLibraryRecord } from '@/features/customers/utils/customerRecords'
import type { SupportedLocale } from '@/shared/i18n/locale'
import {
  createDefaultCompanyProfile,
  loadCompanyProfileRecords,
  subscribeCompanyProfileRecords,
  type CompanyProfile,
  type CompanyProfileRecord,
} from '@/shared/services/localCompanyProfileStorage'
import {
  loadCustomerLibraryRecords,
  subscribeCustomerLibraryRecords,
} from '@/shared/services/localCustomerLibraryStorage'
import {
  loadLatestQuotationDraft,
  loadSavedQuotationsWithRecovery,
  saveQuotationDraft,
} from '@/shared/services/localQuotationStorage'
import {
  allocateNextReusableLibraryQuotationNumber,
  observeReusableLibraryQuotationNumber,
  type ReusableLibraryStorageError,
  trackReusableLibraryQuotationNumber,
} from '@/shared/services/reusableLibraryStore'
import { cloneSerializable } from '@/shared/utils/clone'

import type { QuotationDraft } from '../types'
import { createInitialQuotation, normalizeQuotationDraft } from '../utils/quotationDraft'

export function useQuotationEditorLibraries(uiLocale: Ref<SupportedLocale>) {
  const initialStorageLoad = loadSavedQuotationsWithRecovery()
  const savedDrafts = shallowRef(initialStorageLoad.drafts)
  const customerRecords = shallowRef<CustomerLibraryRecord[]>(loadCustomerLibraryRecords())
  const companyProfileRecords = shallowRef<CompanyProfileRecord[]>(loadCompanyProfileRecords())
  const libraryStorageWarning = shallowRef<ReusableLibraryStorageError | null>(null)

  const unsubscribeCustomerLibrary = subscribeCustomerLibraryRecords((records) => {
    customerRecords.value = records
  })
  const unsubscribeCompanyProfileLibrary = subscribeCompanyProfileRecords((records) => {
    companyProfileRecords.value = records
  })

  if (getCurrentScope()) {
    onScopeDispose(unsubscribeCustomerLibrary)
    onScopeDispose(unsubscribeCompanyProfileLibrary)
  }

  function createDraft() {
    const allocation = allocateNextReusableLibraryQuotationNumber()
    libraryStorageWarning.value = allocation.warning ?? null

    return createInitialQuotation(
      savedDrafts.value,
      uiLocale.value,
      {
        ...getInitialCompanyProfileSelection(companyProfileRecords.value, uiLocale.value),
        quotationNumber: allocation.quotationNumber,
      },
    )
  }

  function saveDraft(draft: QuotationDraft, updatedAt?: string, hasRevisionHistory = false) {
    trackQuotationNumber(draft.header.quotationNumber)
    saveQuotationDraft(draft, updatedAt, hasRevisionHistory)
    savedDrafts.value = upsertSavedDraft(savedDrafts.value, draft)
  }

  function loadLatestDraft() {
    const draft = loadLatestQuotationDraft()
    if (draft) {
      trackQuotationNumber(draft.header.quotationNumber)
    }

    return draft
  }

  function trackQuotationNumber(quotationNumber: string) {
    const result = trackReusableLibraryQuotationNumber(quotationNumber)
    if (result.warning) libraryStorageWarning.value = result.warning
    else if (result.persisted) libraryStorageWarning.value = null
    return result.warning ?? null
  }

  function observeQuotationNumber(quotationNumber: string) {
    return observeReusableLibraryQuotationNumber(quotationNumber)
  }

  return {
    savedDrafts,
    customerRecords,
    companyProfileRecords,
    libraryStorageWarning,
    storageRecoveryReport: initialStorageLoad.recovery,
    createDraft,
    saveDraft,
    loadLatestDraft,
    trackQuotationNumber,
    observeQuotationNumber,
  }
}

export function createCompanyProfileSnapshot(record: CompanyProfileRecord): CompanyProfile {
  return {
    companyName: record.companyName,
    email: record.email,
    phone: record.phone,
  }
}

function getInitialCompanyProfileSelection(
  records: CompanyProfileRecord[],
  locale: SupportedLocale,
): {
  companyProfileId: string | null
  companyProfileSnapshot: CompanyProfile
} {
  const firstRecord = records[0]

  if (!firstRecord) {
    return {
      companyProfileId: null,
      companyProfileSnapshot: createDefaultCompanyProfile(locale),
    }
  }

  return {
    companyProfileId: firstRecord.id,
    companyProfileSnapshot: createCompanyProfileSnapshot(firstRecord),
  }
}

function upsertSavedDraft(savedDrafts: QuotationDraft[], nextDraft: QuotationDraft) {
  const index = savedDrafts.findIndex((draft) => draft.id === nextDraft.id)
  const normalizedDraft = normalizeQuotationDraft(cloneSerializable(nextDraft), {
    ensureAtLeastOneItem: false,
  })

  if (index === -1) {
    return [...savedDrafts, normalizedDraft]
  }

  return savedDrafts.map((draft, draftIndex) => (draftIndex === index ? normalizedDraft : draft))
}
