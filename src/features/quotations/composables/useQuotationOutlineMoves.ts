import { shallowRef, type Ref } from 'vue'
import type { QuotationDraft } from '../types'
import { previewQuotationTreeMove, type QuotationTreeMoveImpact } from '../utils/quotationMoveImpact'

type DropMode = 'before' | 'inside' | 'after'
interface MoveRequest {
  itemId: string
  targetParentId: string | null
  targetIndex: number
  dropMode: DropMode
}
interface PendingMove extends MoveRequest {
  impact: QuotationTreeMoveImpact
  snapshot: string
}

export function useQuotationOutlineMoves(options: {
  quotation: Ref<QuotationDraft>
  canMove: () => boolean
  flushPendingEdits: () => void
  move: (itemId: string, parentId: string | null, index: number, mode: DropMode) => boolean
  onMoved: (itemId: string) => void
  onStale: () => void
}) {
  const pendingMove = shallowRef<PendingMove | null>(null)

  function cancelMove() {
    pendingMove.value = null
  }

  function commitMove(request: MoveRequest) {
    const moved = options.move(request.itemId, request.targetParentId, request.targetIndex, request.dropMode)
    if (moved) options.onMoved(request.itemId)
    return moved
  }

  function requestMove(itemId: string, targetParentId: string | null, targetIndex: number, dropMode: DropMode = 'before') {
    cancelMove()
    if (!options.canMove()) return false
    options.flushPendingEdits()
    const impact = previewQuotationTreeMove(options.quotation.value, itemId, targetParentId, targetIndex)
    if (!impact) return false

    const request = { itemId, targetParentId, targetIndex, dropMode }
    if (impact.requiresConfirmation) {
      pendingMove.value = { ...request, impact, snapshot: JSON.stringify(options.quotation.value) }
      return false
    }
    return commitMove(request)
  }

  function confirmMove() {
    const request = pendingMove.value
    if (!request) return false
    cancelMove()
    if (!options.canMove()) return false
    options.flushPendingEdits()
    // A background/API edit must not apply a move at a now-stale index or price.
    if (request.snapshot !== JSON.stringify(options.quotation.value)) {
      options.onStale()
      return false
    }
    return commitMove(request)
  }

  return { pendingMove, requestMove, confirmMove, cancelMove }
}
