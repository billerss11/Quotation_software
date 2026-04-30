const editBufferFlushers = new Set<() => void>()

export function registerLineItemEditBuffer(flush: () => void) {
  editBufferFlushers.add(flush)

  return () => {
    editBufferFlushers.delete(flush)
  }
}

export function flushLineItemEditBuffers() {
  Array.from(editBufferFlushers).forEach((flush) => {
    flush()
  })
}
