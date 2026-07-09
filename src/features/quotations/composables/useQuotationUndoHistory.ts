import { computed, shallowRef, watch } from 'vue'
import type { Ref } from 'vue'

import { cloneSerializable } from '@/shared/utils/clone'

import type { QuotationDraft } from '../types'

const DEFAULT_MAX_CHANGES = 50

interface UseQuotationUndoHistoryOptions {
  quotation: Ref<QuotationDraft>
  restoreQuotation: (quotation: QuotationDraft) => void
  maxChanges?: number
}

export type QuotationHistoryAction = 'undo' | 'redo'

export type QuotationHistoryResult =
  | {
    ok: true
    action: QuotationHistoryAction
    change: {
      before: QuotationDraft
      after: QuotationDraft
    }
  }
  | {
    ok: false
    action: QuotationHistoryAction
  }

export function useQuotationUndoHistory(options: UseQuotationUndoHistoryOptions) {
  const maxChanges = normalizeMaxChanges(options.maxChanges)
  const undoStack = shallowRef<QuotationDraft[]>([])
  const redoStack = shallowRef<QuotationDraft[]>([])
  let currentSnapshot = cloneQuotation(options.quotation.value)
  let currentSerialized = serializeQuotation(currentSnapshot)

  const canUndo = computed(() => undoStack.value.length > 0)
  const canRedo = computed(() => redoStack.value.length > 0)

  watch(
    options.quotation,
    () => {
      syncPendingChange()
    },
    { deep: true },
  )

  function undo() {
    const pendingSnapshot = getPendingSnapshot()

    if (pendingSnapshot) {
      const targetSnapshot = currentSnapshot
      pushRedoSnapshot(pendingSnapshot)
      restoreSnapshot(targetSnapshot)
      return createChangeResult('undo', pendingSnapshot, targetSnapshot)
    }

    const previousSnapshot = undoStack.value.at(-1)
    if (!previousSnapshot) {
      return createNoChangeResult('undo')
    }

    const beforeSnapshot = currentSnapshot
    undoStack.value = undoStack.value.slice(0, -1)
    pushRedoSnapshot(beforeSnapshot)
    restoreSnapshot(previousSnapshot)
    return createChangeResult('undo', beforeSnapshot, previousSnapshot)
  }

  function redo() {
    if (syncPendingChange()) {
      return createNoChangeResult('redo')
    }

    const nextSnapshot = redoStack.value.at(-1)
    if (!nextSnapshot) {
      return createNoChangeResult('redo')
    }

    const beforeSnapshot = currentSnapshot
    redoStack.value = redoStack.value.slice(0, -1)
    pushUndoSnapshot(beforeSnapshot)
    restoreSnapshot(nextSnapshot)
    return createChangeResult('redo', beforeSnapshot, nextSnapshot)
  }

  function reset() {
    undoStack.value = []
    redoStack.value = []
    currentSnapshot = cloneQuotation(options.quotation.value)
    currentSerialized = serializeQuotation(currentSnapshot)
  }

  function syncPendingChange() {
    const nextSnapshot = getPendingSnapshot()
    if (!nextSnapshot) {
      return false
    }

    pushUndoSnapshot(currentSnapshot)
    redoStack.value = []
    currentSnapshot = nextSnapshot
    currentSerialized = serializeQuotation(nextSnapshot)
    return true
  }

  function getPendingSnapshot() {
    const nextSnapshot = cloneQuotation(options.quotation.value)
    const nextSerialized = serializeQuotation(nextSnapshot)

    if (nextSerialized === currentSerialized) {
      return null
    }

    return nextSnapshot
  }

  function restoreSnapshot(snapshot: QuotationDraft) {
    const nextSnapshot = cloneQuotation(snapshot)
    currentSnapshot = cloneQuotation(snapshot)
    currentSerialized = serializeQuotation(currentSnapshot)
    options.restoreQuotation(nextSnapshot)
  }

  function pushUndoSnapshot(snapshot: QuotationDraft) {
    undoStack.value = pushBoundedSnapshot(undoStack.value, snapshot, maxChanges)
  }

  function pushRedoSnapshot(snapshot: QuotationDraft) {
    redoStack.value = pushBoundedSnapshot(redoStack.value, snapshot, maxChanges)
  }

  return {
    canUndo,
    canRedo,
    undo,
    redo,
    reset,
  }
}

function pushBoundedSnapshot(
  snapshots: QuotationDraft[],
  snapshot: QuotationDraft,
  maxChanges: number,
) {
  return [...snapshots, cloneQuotation(snapshot)].slice(-maxChanges)
}

function cloneQuotation(quotation: QuotationDraft) {
  return cloneSerializable(quotation)
}

function createChangeResult(
  action: QuotationHistoryAction,
  before: QuotationDraft,
  after: QuotationDraft,
): QuotationHistoryResult {
  return {
    ok: true,
    action,
    change: {
      before: cloneQuotation(before),
      after: cloneQuotation(after),
    },
  }
}

function createNoChangeResult(action: QuotationHistoryAction): QuotationHistoryResult {
  return {
    ok: false,
    action,
  }
}

function serializeQuotation(quotation: QuotationDraft) {
  return JSON.stringify(quotation)
}

function normalizeMaxChanges(maxChanges = DEFAULT_MAX_CHANGES) {
  if (!Number.isInteger(maxChanges) || maxChanges <= 0) {
    return DEFAULT_MAX_CHANGES
  }

  return maxChanges
}
