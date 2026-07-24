import { computed, type ComputedRef } from 'vue'

import type { ExchangeRateTable, QuotationItem, QuotationTaxBucket, TotalsConfig } from '../types'
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
  allocatedTaxBuckets?: () => QuotationTaxBucket[] | undefined
}

type PricingTarget = {
  item: QuotationItem
  inheritedMarkupContext: InheritedMarkupContext | null
  inheritedTaxClassId: string | undefined
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
      { taxBuckets: options.allocatedTaxBuckets?.() },
    ),
  )

  const pricingTargetByItemId = computed(() => {
    const targets = new Map<string, PricingTarget>()
    if (!options.expanded()) {
      return targets
    }

    collectPricingTargets(
      targets,
      options.item(),
      options.rootItemNumber(),
      null,
      undefined,
    )
    return targets
  })
  const pricingByItemId = new Map<string, ComputedRef<QuotationItemPricingDisplay | undefined>>()

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

    if (!options.expanded()) {
      return undefined
    }

    let pricing = pricingByItemId.get(itemId)
    if (!pricing) {
      pricing = computed(() => {
        if (!options.expanded()) {
          return undefined
        }

        const target = pricingTargetByItemId.value.get(itemId)
        if (!target) {
          return undefined
        }

        return getQuotationItemPricingDisplay(
          target.item,
          options.globalMarkupRate(),
          options.exchangeRates(),
          options.totalsConfig(),
          target.inheritedMarkupContext,
          target.inheritedTaxClassId,
        )
      })
      pricingByItemId.set(itemId, pricing)
    }

    return pricing.value
  }

  return {
    rootPricingDisplay,
    amountMismatchByItemId,
    getPricing,
  }
}

function collectPricingTargets(
  targets: Map<string, PricingTarget>,
  item: QuotationItem,
  itemNumber: string,
  inheritedMarkupContext: InheritedMarkupContext | null,
  inheritedTaxClassId: string | undefined,
) {
  targets.set(item.id, {
    item,
    inheritedMarkupContext,
    inheritedTaxClassId,
  })

  const nextInheritedMarkupContext = createInheritedMarkupContext(item, itemNumber, inheritedMarkupContext)
  const nextInheritedTaxClassId = item.taxClassId ?? inheritedTaxClassId

  item.children.forEach((child, index) => {
    collectPricingTargets(
      targets,
      child,
      `${itemNumber}.${index + 1}`,
      nextInheritedMarkupContext,
      nextInheritedTaxClassId,
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
