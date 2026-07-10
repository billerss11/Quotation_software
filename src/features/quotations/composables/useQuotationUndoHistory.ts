import { computed, shallowRef, watch } from 'vue'
import type { Ref } from 'vue'

import { cloneSerializable } from '@/shared/utils/clone'

import type { QuotationDraft } from '../types'
import type { QuotationHistoryChangeSummary } from '../utils/quotationHistoryChangeSummary'

const DEFAULT_MAX_CHANGES = 50
const LARGE_HISTORY_CHANGE_SERIALIZED_LENGTH = 250_000

interface UseQuotationUndoHistoryOptions {
  quotation: Ref<QuotationDraft>
  restoreQuotation: (quotation: QuotationDraft) => QuotationHistoryChangeSummary | null | void
  maxChanges?: number
}

export type QuotationHistoryAction = 'undo' | 'redo'

export interface QuotationHistoryCommandOptions {
  skipPendingCheck?: boolean
}

interface QuotationSnapshot {
  quotation: QuotationDraft
  serialized: string
}

export type QuotationHistoryResult =
  | {
    ok: true
    action: QuotationHistoryAction
    change: {
      before: QuotationDraft
      after: QuotationDraft
      isLarge: boolean
      summary?: QuotationHistoryChangeSummary
    }
  }
  | {
    ok: false
    action: QuotationHistoryAction
  }

export function useQuotationUndoHistory(options: UseQuotationUndoHistoryOptions) {
  const maxChanges = normalizeMaxChanges(options.maxChanges)
  const undoStack = shallowRef<QuotationSnapshot[]>([])
  const redoStack = shallowRef<QuotationSnapshot[]>([])
  let currentSnapshot = createSnapshot(options.quotation.value)
  let skipNextRestoredSerialized: string | null = null

  const canUndo = computed(() => undoStack.value.length > 0)
  const canRedo = computed(() => redoStack.value.length > 0)

  watch(
    options.quotation,
    () => {
      if (skipNextRestoredSerialized !== null) {
        const restoredSerialized = skipNextRestoredSerialized
        skipNextRestoredSerialized = null
        const nextSerialized = serializeQuotation(options.quotation.value)

        if (nextSerialized === restoredSerialized) {
          return
        }

        syncPendingChange(nextSerialized)
        return
      }

      syncPendingChange()
    },
    { deep: true },
  )

  function undo(commandOptions: QuotationHistoryCommandOptions = {}) {
    const pendingSnapshot = commandOptions.skipPendingCheck ? null : getPendingSnapshot()

    if (pendingSnapshot) {
      const targetSnapshot = currentSnapshot
      pushRedoSnapshot(pendingSnapshot)
      const summary = restoreSnapshot(targetSnapshot)
      return createChangeResult('undo', pendingSnapshot, targetSnapshot, summary)
    }

    const previousSnapshot = undoStack.value.at(-1)
    if (!previousSnapshot) {
      return createNoChangeResult('undo')
    }

    const beforeSnapshot = currentSnapshot
    undoStack.value = undoStack.value.slice(0, -1)
    pushRedoSnapshot(beforeSnapshot)
    const summary = restoreSnapshot(previousSnapshot)
    return createChangeResult('undo', beforeSnapshot, previousSnapshot, summary)
  }

  function redo(commandOptions: QuotationHistoryCommandOptions = {}) {
    if (!commandOptions.skipPendingCheck && syncPendingChange()) {
      return createNoChangeResult('redo')
    }

    const nextSnapshot = redoStack.value.at(-1)
    if (!nextSnapshot) {
      return createNoChangeResult('redo')
    }

    const beforeSnapshot = currentSnapshot
    redoStack.value = redoStack.value.slice(0, -1)
    pushUndoSnapshot(beforeSnapshot)
    const summary = restoreSnapshot(nextSnapshot)
    return createChangeResult('redo', beforeSnapshot, nextSnapshot, summary)
  }

  function reset() {
    undoStack.value = []
    redoStack.value = []
    currentSnapshot = createSnapshot(options.quotation.value)
  }

  function syncPendingChange(serialized?: string) {
    const nextSnapshot = getPendingSnapshot(serialized)
    if (!nextSnapshot) {
      return false
    }

    pushUndoSnapshot(currentSnapshot)
    redoStack.value = []
    currentSnapshot = nextSnapshot
    return true
  }

  function getPendingSnapshot(serialized?: string) {
    const nextSnapshot = createSnapshot(options.quotation.value, serialized)

    if (nextSnapshot.serialized === currentSnapshot.serialized) {
      return null
    }

    return nextSnapshot
  }

  function restoreSnapshot(snapshot: QuotationSnapshot) {
    currentSnapshot = snapshot
    skipNextRestoredSerialized = snapshot.serialized
    return options.restoreQuotation(cloneQuotation(snapshot.quotation)) ?? undefined
  }

  function pushUndoSnapshot(snapshot: QuotationSnapshot) {
    undoStack.value = pushBoundedSnapshot(undoStack.value, snapshot, maxChanges)
  }

  function pushRedoSnapshot(snapshot: QuotationSnapshot) {
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
  snapshots: QuotationSnapshot[],
  snapshot: QuotationSnapshot,
  maxChanges: number,
) {
  return [...snapshots, snapshot].slice(-maxChanges)
}

function createSnapshot(quotation: QuotationDraft, serialized?: string): QuotationSnapshot {
  const clonedQuotation = cloneQuotation(quotation)

  return {
    quotation: clonedQuotation,
    serialized: serialized ?? serializeQuotation(clonedQuotation),
  }
}

function cloneQuotation(quotation: QuotationDraft) {
  return cloneSerializable(quotation)
}

function createChangeResult(
  action: QuotationHistoryAction,
  before: QuotationSnapshot,
  after: QuotationSnapshot,
  summary?: QuotationHistoryChangeSummary,
): QuotationHistoryResult {
  // These snapshots are internal and treated as immutable. Returning them directly
  // avoids two more full-quote clones on every undo/redo.
  return {
    ok: true,
    action,
    change: {
      before: before.quotation,
      after: after.quotation,
      isLarge: isLargeHistoryChange(before, after),
      summary,
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

function isLargeHistoryChange(before: QuotationSnapshot, after: QuotationSnapshot) {
  return Math.max(before.serialized.length, after.serialized.length) > LARGE_HISTORY_CHANGE_SERIALIZED_LENGTH
}

function normalizeMaxChanges(maxChanges = DEFAULT_MAX_CHANGES) {
  if (!Number.isInteger(maxChanges) || maxChanges <= 0) {
    return DEFAULT_MAX_CHANGES
  }

  return maxChanges
}
