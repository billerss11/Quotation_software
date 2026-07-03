import { computed } from 'vue'

import type { ExchangeRateTable, QuotationItem, TotalsConfig } from '../types'
import {
  createInheritedMarkupContext,
  getQuotationItemPricingDisplay,
  type InheritedMarkupContext,
  type QuotationItemPricingDisplay,
} from '../utils/quotationItemPricing'
import { getQuotationItemAmountMismatch } from '../utils/quotationItemValidation'

interface UseLineItemCardPricingOptions {
  item: () => QuotationItem
  expanded: () => boolean
  rootItemNumber: () => string
  globalMarkupRate: () => number
  exchangeRates: () => ExchangeRateTable
  totalsConfig: () => TotalsConfig
}

export function useLineItemCardPricing(options: UseLineItemCardPricingOptions) {
  const rootPricingDisplay = computed(() =>
    getQuotationItemPricingDisplay(
      options.item(),
      options.globalMarkupRate(),
      options.exchangeRates(),
      options.totalsConfig(),
      null,
      undefined,
    ),
  )

  const pricingDisplayByItemId = computed(() => {
    const pricingByItemId = new Map<string, QuotationItemPricingDisplay>()
    if (!options.expanded()) {
      return pricingByItemId
    }

    collectPricingDisplay(
      pricingByItemId,
      options.item(),
      options.rootItemNumber(),
      null,
      undefined,
      options.globalMarkupRate(),
      options.exchangeRates(),
      options.totalsConfig(),
    )
    return pricingByItemId
  })

  const amountMismatchByItemId = computed(() => {
    const mismatches = new Map<string, ReturnType<typeof getQuotationItemAmountMismatch>>()
    collectAmountMismatch(
      mismatches,
      options.item(),
      options.rootItemNumber(),
      null,
      options.globalMarkupRate(),
      options.exchangeRates(),
      options.expanded(),
    )
    return mismatches
  })

  function getPricing(itemId: string) {
    if (itemId === options.item().id) {
      return rootPricingDisplay.value
    }

    return pricingDisplayByItemId.value.get(itemId)
  }

  return {
    rootPricingDisplay,
    pricingDisplayByItemId,
    amountMismatchByItemId,
    getPricing,
  }
}

function collectPricingDisplay(
  pricingByItemId: Map<string, QuotationItemPricingDisplay>,
  item: QuotationItem,
  itemNumber: string,
  inheritedMarkupContext: InheritedMarkupContext | null,
  inheritedTaxClassId: string | undefined,
  globalMarkupRate: number,
  exchangeRates: ExchangeRateTable,
  totalsConfig: TotalsConfig,
) {
  pricingByItemId.set(
    item.id,
    getQuotationItemPricingDisplay(
      item,
      globalMarkupRate,
      exchangeRates,
      totalsConfig,
      inheritedMarkupContext,
      inheritedTaxClassId,
    ),
  )

  const nextInheritedMarkupContext = createInheritedMarkupContext(item, itemNumber, inheritedMarkupContext)
  const nextInheritedTaxClassId = item.taxClassId ?? inheritedTaxClassId

  item.children.forEach((child, index) => {
    collectPricingDisplay(
      pricingByItemId,
      child,
      `${itemNumber}.${index + 1}`,
      nextInheritedMarkupContext,
      nextInheritedTaxClassId,
      globalMarkupRate,
      exchangeRates,
      totalsConfig,
    )
  })
}

function collectAmountMismatch(
  mismatches: Map<string, ReturnType<typeof getQuotationItemAmountMismatch>>,
  item: QuotationItem,
  itemNumber: string,
  inheritedMarkupContext: InheritedMarkupContext | null,
  globalMarkupRate: number,
  exchangeRates: ExchangeRateTable,
  includeDescendants = true,
) {
  mismatches.set(
    item.id,
    getQuotationItemAmountMismatch(
      item,
      globalMarkupRate,
      exchangeRates,
      inheritedMarkupContext?.rate,
    ),
  )

  if (!includeDescendants) {
    return
  }

  const nextInheritedMarkupContext = createInheritedMarkupContext(item, itemNumber, inheritedMarkupContext)

  item.children.forEach((child, index) => {
    collectAmountMismatch(
      mismatches,
      child,
      `${itemNumber}.${index + 1}`,
      nextInheritedMarkupContext,
      globalMarkupRate,
      exchangeRates,
    )
  })
}
