import { cloneSerializable } from '@/shared/utils/clone'

import type { QuotationDraft, QuotationItem } from '../types'
import { calculateExtraChargesTotal, calculateQuotationTotals } from './quotationCalculations'
import { roundMoney } from './moneyMath'
import { findQuotationItem, findQuotationItemPath, getQuotationTreeMoveError, moveQuotationTreeRow } from './quotationItems'
import { createCalculationTotalsConfig } from './quotationTaxes'

export interface QuotationTreeMoveImpact {
  beforeTotal: number
  afterTotal: number
  requiresConfirmation: boolean
  hiddenPriceItemName: string | null
  reactivatedPriceItemName: string | null
}

export function previewQuotationTreeMove(
  quotation: QuotationDraft,
  itemId: string,
  targetParentId: string | null,
  targetIndex: number,
): QuotationTreeMoveImpact | null {
  if (getQuotationTreeMoveError(quotation.majorItems, itemId, targetParentId, targetIndex)) {
    return null
  }

  const sourcePath = findQuotationItemPath(quotation.majorItems, itemId)
  const sourceParent = sourcePath?.at(-2)
  const changesParent = (sourceParent?.id ?? null) !== targetParentId
  const targetParent = targetParentId !== null
    ? findQuotationItem(quotation.majorItems, targetParentId)
    : undefined
  const hidesPrice = changesParent && targetParent?.children.length === 0 && hasRetainedPrice(targetParent)
  const reactivatesPrice = changesParent && sourceParent?.children.length === 1 && hasRetainedPrice(sourceParent)

  const nextItems = cloneSerializable(quotation.majorItems)
  moveQuotationTreeRow(nextItems, itemId, targetParentId, targetIndex, 'inside')
  const config = createCalculationTotalsConfig(quotation.totalsConfig)
  const extraChargesTotal = calculateExtraChargesTotal(quotation.totalsConfig.extraCharges)
  const beforeTotal = roundMoney(
    calculateQuotationTotals(quotation.majorItems, config, quotation.exchangeRates).grandTotal + extraChargesTotal,
  )
  const afterTotal = roundMoney(
    calculateQuotationTotals(nextItems, config, quotation.exchangeRates).grandTotal + extraChargesTotal,
  )

  return {
    beforeTotal,
    afterTotal,
    requiresConfirmation: changesParent && (hidesPrice || reactivatesPrice || beforeTotal !== afterTotal),
    hiddenPriceItemName: hidesPrice ? targetParent.name : null,
    reactivatedPriceItemName: reactivatesPrice ? sourceParent.name : null,
  }
}

function hasRetainedPrice(item: QuotationItem) {
  return (Number.isFinite(item.unitCost) && item.unitCost > 0)
    || (item.pricingMethod === 'manual_price'
      && Number.isFinite(item.manualUnitPrice)
      && (item.manualUnitPrice ?? 0) > 0)
}
