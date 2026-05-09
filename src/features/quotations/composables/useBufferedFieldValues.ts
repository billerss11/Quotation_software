import { getCurrentScope, onScopeDispose, shallowReactive } from 'vue'

import { registerBufferedEditFlusher } from '../utils/lineItemEditBuffers'

const BUFFER_COMMIT_DELAY_MS = 160

type BufferedFieldCommit = (key: string, value: unknown) => void

export function useBufferedFieldValues(
  onCommit: BufferedFieldCommit,
  commitDelayMs = BUFFER_COMMIT_DELAY_MS,
) {
  const pendingValues = shallowReactive<Record<string, unknown>>({})
  const pendingTimers = new Map<string, ReturnType<typeof window.setTimeout>>()
  const unregisterBufferedEditFlusher = registerBufferedEditFlusher(flushBufferedValues)

  if (getCurrentScope()) {
    onScopeDispose(dispose)
  }

  function hasBufferedValue(key: string) {
    return Object.prototype.hasOwnProperty.call(pendingValues, key)
  }

  function getBufferedValue<T>(key: string, fallback: T) {
    return hasBufferedValue(key) ? pendingValues[key] as T : fallback
  }

  function queueBufferedValue(key: string, value: unknown) {
    pendingValues[key] = value

    const existingTimer = pendingTimers.get(key)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    pendingTimers.set(key, setTimeout(() => {
      flushBufferedValue(key)
    }, commitDelayMs))
  }

  function flushBufferedValue(key: string) {
    if (!hasBufferedValue(key)) {
      return
    }

    const existingTimer = pendingTimers.get(key)

    if (existingTimer) {
      clearTimeout(existingTimer)
      pendingTimers.delete(key)
    }

    const nextValue = pendingValues[key]
    delete pendingValues[key]
    onCommit(key, nextValue)
  }

  function flushBufferedValues() {
    Object.keys(pendingValues).forEach((key) => {
      flushBufferedValue(key)
    })
  }

  function dispose() {
    flushBufferedValues()
    unregisterBufferedEditFlusher()
  }

  return {
    getBufferedValue,
    queueBufferedValue,
    flushBufferedValue,
    flushBufferedValues,
    dispose,
  }
}
