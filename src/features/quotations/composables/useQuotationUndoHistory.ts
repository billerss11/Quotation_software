import { computed, getCurrentScope, onScopeDispose, shallowRef } from 'vue'
import type { Ref } from 'vue'

import type { QuotationDraft } from '../types'
import type { QuotationHistoryChangeSummary } from '../utils/quotationHistoryChangeSummary'
import {
  applyQuotationHistoryMutations,
  isQuotationHistoryMutationNoop,
  type QuotationHistoryMutation,
} from '../utils/quotationHistoryCommands'

const DEFAULT_MAX_CHANGES = 50
const PENDING_ENTRY_DELAY_MS = 0

interface UseQuotationUndoHistoryOptions {
  quotation: Ref<QuotationDraft>
  maxChanges?: number
  onCommitted?: (event: QuotationHistoryCommittedEvent) => void
}

interface QuotationHistoryEntry {
  mutations: QuotationHistoryMutation[]
  summary: QuotationHistoryChangeSummary
}

export type QuotationHistoryAction = 'undo' | 'redo'

export interface QuotationHistoryCommittedEvent {
  action: 'change' | QuotationHistoryAction
  summary: QuotationHistoryChangeSummary
}

export interface QuotationHistoryCommandOptions {
  skipPendingCheck?: boolean
}

export type QuotationHistoryResult =
  | {
    ok: true
    action: QuotationHistoryAction
    change: {
      summary: QuotationHistoryChangeSummary
    }
  }
  | {
    ok: false
    action: QuotationHistoryAction
  }

export function useQuotationUndoHistory(options: UseQuotationUndoHistoryOptions) {
  const maxChanges = normalizeMaxChanges(options.maxChanges)
  const undoStack = shallowRef<QuotationHistoryEntry[]>([])
  const redoStack = shallowRef<QuotationHistoryEntry[]>([])
  const hasPendingEntry = shallowRef(false)
  let pendingEntry: QuotationHistoryEntry | null = null
  let pendingEntryTimer: ReturnType<typeof setTimeout> | null = null
  let isReplaying = false

  const canUndo = computed(() => undoStack.value.length > 0 || hasPendingEntry.value)
  const canRedo = computed(() => redoStack.value.length > 0 && !hasPendingEntry.value)

  if (getCurrentScope()) {
    onScopeDispose(cancelPendingEntryFlush)
  }

  function execute(
    mutations: readonly QuotationHistoryMutation[],
    summary: QuotationHistoryChangeSummary = { kind: 'fallback' },
  ) {
    if (isReplaying) {
      return false
    }

    const effectiveMutations = mutations.filter((mutation) => !isQuotationHistoryMutationNoop(mutation))
    if (effectiveMutations.length === 0) {
      return false
    }

    applyQuotationHistoryMutations(options.quotation, effectiveMutations, 'forward')
    redoStack.value = []

    if (pendingEntry) {
      pendingEntry.mutations.push(...effectiveMutations)
      pendingEntry.summary = choosePendingSummary(pendingEntry.summary, summary)
    } else {
      pendingEntry = {
        mutations: [...effectiveMutations],
        summary,
      }
    }

    hasPendingEntry.value = true
    queuePendingEntryFlush()
    return true
  }

  function undo(_commandOptions: QuotationHistoryCommandOptions = {}): QuotationHistoryResult {
    flushPendingEntry()
    const entry = undoStack.value.at(-1)
    if (!entry) {
      return createNoChangeResult('undo')
    }

    undoStack.value = undoStack.value.slice(0, -1)
    replayEntry(entry, 'inverse')
    redoStack.value = pushBoundedEntry(redoStack.value, entry, maxChanges)
    const summary = reverseSummary(entry.summary)
    notifyCommitted('undo', summary)
    return createChangeResult('undo', summary)
  }

  function redo(_commandOptions: QuotationHistoryCommandOptions = {}): QuotationHistoryResult {
    flushPendingEntry()
    const entry = redoStack.value.at(-1)
    if (!entry) {
      return createNoChangeResult('redo')
    }

    redoStack.value = redoStack.value.slice(0, -1)
    replayEntry(entry, 'forward')
    undoStack.value = pushBoundedEntry(undoStack.value, entry, maxChanges)
    notifyCommitted('redo', entry.summary)
    return createChangeResult('redo', entry.summary)
  }

  function reset() {
    cancelPendingEntryFlush()
    pendingEntry = null
    hasPendingEntry.value = false
    undoStack.value = []
    redoStack.value = []
  }

  function replayEntry(entry: QuotationHistoryEntry, direction: 'forward' | 'inverse') {
    isReplaying = true
    try {
      applyQuotationHistoryMutations(options.quotation, entry.mutations, direction)
    } finally {
      isReplaying = false
    }
  }

  function queuePendingEntryFlush() {
    if (pendingEntryTimer !== null) {
      return
    }

    pendingEntryTimer = setTimeout(() => {
      pendingEntryTimer = null
      flushPendingEntry()
    }, PENDING_ENTRY_DELAY_MS)
  }

  function flushPendingEntry() {
    cancelPendingEntryFlush()
    if (!pendingEntry) {
      hasPendingEntry.value = false
      return
    }

    const entry = pendingEntry
    undoStack.value = pushBoundedEntry(undoStack.value, entry, maxChanges)
    pendingEntry = null
    hasPendingEntry.value = false
    notifyCommitted('change', entry.summary)
  }

  function cancelPendingEntryFlush() {
    if (pendingEntryTimer === null) {
      return
    }

    clearTimeout(pendingEntryTimer)
    pendingEntryTimer = null
  }

  function notifyCommitted(
    action: QuotationHistoryCommittedEvent['action'],
    summary: QuotationHistoryChangeSummary,
  ) {
    try {
      options.onCommitted?.({ action, summary })
    } catch (error) {
      console.warn('Activity history callback failed.', error)
    }
  }

  return {
    canUndo,
    canRedo,
    execute,
    undo,
    redo,
    reset,
    flush: flushPendingEntry,
  }
}

function pushBoundedEntry(
  entries: QuotationHistoryEntry[],
  entry: QuotationHistoryEntry,
  maxChanges: number,
) {
  return [...entries, entry].slice(-maxChanges)
}

function choosePendingSummary(
  current: QuotationHistoryChangeSummary,
  next: QuotationHistoryChangeSummary,
) {
  return current.kind === 'fallback' ? next : current
}

function reverseSummary(summary: QuotationHistoryChangeSummary): QuotationHistoryChangeSummary {
  if (summary.kind === 'fieldChanged' || summary.kind === 'itemFieldChanged') {
    return {
      ...summary,
      previousValue: summary.nextValue,
      nextValue: summary.previousValue,
    }
  }

  if (summary.kind === 'itemAdded') {
    return { ...summary, kind: 'itemRemoved' }
  }

  if (summary.kind === 'itemRemoved') {
    return { ...summary, kind: 'itemAdded' }
  }

  return summary
}

function createChangeResult(
  action: QuotationHistoryAction,
  summary: QuotationHistoryChangeSummary,
): QuotationHistoryResult {
  return {
    ok: true,
    action,
    change: { summary },
  }
}

function createNoChangeResult(action: QuotationHistoryAction): QuotationHistoryResult {
  return {
    ok: false,
    action,
  }
}

function normalizeMaxChanges(maxChanges = DEFAULT_MAX_CHANGES) {
  if (!Number.isInteger(maxChanges) || maxChanges <= 0) {
    return DEFAULT_MAX_CHANGES
  }

  return maxChanges
}
