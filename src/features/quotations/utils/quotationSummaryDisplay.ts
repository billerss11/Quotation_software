import type {
  MajorItemSummary,
  QuotationDraft,
  QuotationInformationalTotal,
  QuotationItem,
  QuotationOutputSettings,
  QuotationRootItem,
} from '../types'
import { roundMoney, scaleRoundedAmounts } from './moneyMath'
import { calculateQuotationItemSellingAmount, getEffectiveMarkupRate } from './quotationCalculations'
import { getQuotationRootItems, isQuotationSectionHeader } from './quotationItems'

export interface QuotationSummarySection {
  id: string
  title: string
  itemCount: number
  subtotal: number
}

export interface ResolvedQuotationInformationalTotal extends QuotationInformationalTotal {
  amount: number | null
  missingSectionIds: string[]
  missingItemIds: string[]
  isVisible: boolean
}

export interface QuotationSummaryItem {
  id: string
  name: string
  description: string
  itemNumber: string
  depth: number
  ancestorIds: string[]
  subtotal: number
}

interface ItemContribution {
  row: QuotationSummaryItem
  children: ItemContribution[]
}

export function getQuotationSections(
  majorItems: QuotationRootItem[],
  summaries: MajorItemSummary[],
): QuotationSummarySection[] {
  const summaryById = new Map(summaries.map((summary) => [summary.itemId, summary]))
  const sections: QuotationSummarySection[] = []
  let currentSection: QuotationSummarySection | undefined

  for (const item of majorItems) {
    if (isQuotationSectionHeader(item)) {
      currentSection = { id: item.id, title: item.title, itemCount: 0, subtotal: 0 }
      sections.push(currentSection)
    } else if (currentSection) {
      currentSection.itemCount += 1
      currentSection.subtotal += summaryById.get(item.id)?.subtotal ?? 0
    }
  }

  return sections.map((section) => ({ ...section, subtotal: roundMoney(section.subtotal) }))
}

export function resolveQuotationInformationalTotals(
  settings: QuotationOutputSettings | undefined,
  sections: QuotationSummarySection[],
  items: QuotationSummaryItem[] = [],
): ResolvedQuotationInformationalTotal[] {
  const sectionById = new Map(sections.map((section) => [section.id, section]))
  const itemById = new Map(items.map((item) => [item.id, item]))

  return (settings?.informationalTotals ?? []).map((row) => {
    const sectionIds = [...new Set(row.sectionIds)]
    const itemIds = [...new Set(row.itemIds ?? [])]
    const usesItems = row.source === 'items'
    const missingSectionIds = usesItems ? [] : sectionIds.filter((id) => !sectionById.has(id))
    const missingItemIds = usesItems ? itemIds.filter((id) => !itemById.has(id)) : []
    const selectedSections = sectionIds.flatMap((id) => {
      const section = sectionById.get(id)
      return section ? [section] : []
    })
    const selectedItemIds = new Set(itemIds)
    const selectedItems = itemIds.flatMap((id) => {
      const item = itemById.get(id)
      return item && !item.ancestorIds.some((ancestorId) => selectedItemIds.has(ancestorId)) ? [item] : []
    })
    const selection = usesItems ? selectedItems : selectedSections
    const selectedIds = usesItems ? itemIds : sectionIds

    return {
      ...row,
      sectionIds,
      ...(row.itemIds === undefined ? {} : { itemIds }),
      label: row.label.trim() || (usesItems
        ? selectedItems.map((item) => item.name)
        : selectedSections.map((section) => section.title)).join(' + '),
      amount: selectedIds.length === 0 || missingSectionIds.length > 0 || missingItemIds.length > 0
        ? null
        : roundMoney(selection.reduce((sum, entry) => sum + entry.subtotal, 0)),
      missingSectionIds,
      missingItemIds,
      isVisible: settings?.showInformationalTotals === true && row.visible,
    }
  })
}

export function getQuotationSummaryItems(
  quotation: Pick<QuotationDraft, 'majorItems' | 'totalsConfig' | 'exchangeRates'>,
  summaries: MajorItemSummary[],
): QuotationSummaryItem[] {
  const summaryById = new Map(summaries.map((summary) => [summary.itemId, summary]))
  const contributions = getQuotationRootItems(quotation.majorItems).map((item, index) =>
    createContribution(item, String(index + 1), [], undefined, summaryById.get(item.id)?.subtotal),
  )

  return contributions.flatMap(flattenContribution)

  function createContribution(
    item: QuotationItem,
    itemNumber: string,
    ancestorIds: string[],
    inheritedMarkupRate: number | undefined,
    canonicalSubtotal?: number,
  ): ItemContribution {
    const nextMarkupRate = typeof item.markupRate === 'number' && Number.isFinite(item.markupRate)
      ? getEffectiveMarkupRate(item.markupRate, quotation.totalsConfig.globalMarkupRate)
      : inheritedMarkupRate
    const children = item.children.map((child, index) => createContribution(
      child, `${itemNumber}.${index + 1}`, [...ancestorIds, item.id], nextMarkupRate,
    ))
    const subtotal = canonicalSubtotal ?? calculateQuotationItemSellingAmount(
      item, quotation.totalsConfig.globalMarkupRate, quotation.exchangeRates, inheritedMarkupRate,
    )
    const contribution: ItemContribution = {
      row: { id: item.id, name: item.name, description: item.description, itemNumber, depth: ancestorIds.length + 1, ancestorIds, subtotal },
      children,
    }

    scaleChildren(contribution, item.quantity)
    return contribution
  }
}

function scaleChildren(contribution: ItemContribution, quantity: number) {
  if (contribution.children.length === 0) return
  const sourceAmounts = contribution.children.map((child) => child.row.subtotal)
  const scaledAmounts = scaleRoundedAmounts(sourceAmounts, quantity)
  let adjustment = roundMoney(contribution.row.subtotal - scaledAmounts.reduce((sum, amount) => sum + amount, 0))

  // Preserve the parent's assigned rounding cent at every level of its subtree.
  for (let index = scaledAmounts.length - 1; index >= 0 && adjustment !== 0; index -= 1) {
    if (sourceAmounts[index]! <= 0) continue
    const change = adjustment > 0 ? adjustment : -Math.min(scaledAmounts[index]!, -adjustment)
    scaledAmounts[index] = roundMoney(scaledAmounts[index]! + change)
    adjustment = roundMoney(adjustment - change)
  }

  contribution.children.forEach((child, index) => {
    child.row.subtotal = scaledAmounts[index]!
    scaleChildren(child, quantity)
  })
}

function flattenContribution(contribution: ItemContribution): QuotationSummaryItem[] {
  return [contribution.row, ...contribution.children.flatMap(flattenContribution)]
}

export function getQuotationSubtotalLabel(
  settings: QuotationOutputSettings | undefined,
  fallbackLabel: string,
): string {
  return settings?.subtotalLabel?.trim() || fallbackLabel
}
