import type { QuotationSupportPanelValue } from './quotationSupportPanels'

const HISTORY_TARGET_ATTRIBUTE = 'data-history-target'
const CUSTOMER_HEADER_TARGETS = new Set([
  'header:customerCompany',
  'header:contactPerson',
  'header:contactDetails',
])

export function findQuotationHistoryTargetElement(root: ParentNode, target: string) {
  return queryHistoryTarget(root, target) ?? queryHistoryTarget(root, getFallbackItemTarget(target))
}

export function getQuotationHistoryTargetPanel(target: string): QuotationSupportPanelValue | null {
  if (CUSTOMER_HEADER_TARGETS.has(target)) {
    return 'customer'
  }

  if (target.startsWith('header:')) {
    return 'quoteInfo'
  }

  if (target.startsWith('totals:')) {
    return 'pricing'
  }

  if (target.startsWith('exchangeRate:')) {
    return 'rates'
  }

  return null
}

export function getQuotationHistoryTargetItemId(target: string) {
  return /^item:([^:]+)/.exec(target)?.[1] ?? null
}

function queryHistoryTarget(root: ParentNode, target: string | null) {
  if (!target) {
    return null
  }

  return root.querySelector<HTMLElement>(`[${HISTORY_TARGET_ATTRIBUTE}="${escapeAttributeValue(target)}"]`)
}

function getFallbackItemTarget(target: string) {
  const match = /^item:([^:]+):.+$/.exec(target)
  return match ? `item:${match[1]}` : null
}

function escapeAttributeValue(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}
