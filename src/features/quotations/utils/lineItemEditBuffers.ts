const editBufferFlushers = new Set<() => void>()

export function registerBufferedEditFlusher(flush: () => void) {
  editBufferFlushers.add(flush)

  return () => {
    editBufferFlushers.delete(flush)
  }
}

export function flushBufferedEditFlushers() {
  Array.from(editBufferFlushers).forEach((flush) => {
    flush()
  })
}

export const registerLineItemEditBuffer = registerBufferedEditFlusher
export const flushLineItemEditBuffers = flushBufferedEditFlushers
