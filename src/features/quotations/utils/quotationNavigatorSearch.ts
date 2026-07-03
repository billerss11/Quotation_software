import type { QuotationItem, QuotationRootItem } from '../types'
import { isQuotationItem, isQuotationSectionHeader } from './quotationItems'

export const QUOTATION_NAVIGATOR_SEARCH_MIN_LENGTH = 2

export interface QuotationNavigatorSearchState {
  isActive: boolean
  query: string
  matchCount: number
  firstMatchId: string | null
  visibleIds: Set<string>
  matchIds: Set<string>
  nameMatchIds: Set<string>
  descriptionMatchIds: Set<string>
  sectionTitleMatchIds: Set<string>
  expandedIds: Set<string>
}

export interface SearchHighlightPart {
  text: string
  matched: boolean
}

export function createQuotationNavigatorSearchState(
  items: QuotationRootItem[],
  rawQuery: string,
): QuotationNavigatorSearchState {
  const query = normalizeNavigatorSearchQuery(rawQuery)
  const state = createEmptySearchState(query)

  if (query.length < QUOTATION_NAVIGATOR_SEARCH_MIN_LENGTH) {
    return state
  }

  state.isActive = true

  for (const item of items) {
    visitRootItem(item, query, state)
  }

  return state
}

export function normalizeNavigatorSearchQuery(query: string) {
  return query.trim().toLocaleLowerCase()
}

export function createSearchHighlightParts(text: string, rawQuery: string): SearchHighlightPart[] {
  const query = normalizeNavigatorSearchQuery(rawQuery)

  if (query.length < QUOTATION_NAVIGATOR_SEARCH_MIN_LENGTH || text.length === 0) {
    return [{ text, matched: false }]
  }

  const normalizedText = text.toLocaleLowerCase()
  const parts: SearchHighlightPart[] = []
  let cursor = 0

  while (cursor < text.length) {
    const matchIndex = normalizedText.indexOf(query, cursor)

    if (matchIndex === -1) {
      parts.push({ text: text.slice(cursor), matched: false })
      break
    }

    if (matchIndex > cursor) {
      parts.push({ text: text.slice(cursor, matchIndex), matched: false })
    }

    parts.push({
      text: text.slice(matchIndex, matchIndex + query.length),
      matched: true,
    })
    cursor = matchIndex + query.length
  }

  return parts.length > 0 ? parts : [{ text, matched: false }]
}

export function createSearchMatchSnippet(text: string, rawQuery: string, maxLength = 90) {
  const query = normalizeNavigatorSearchQuery(rawQuery)

  if (query.length < QUOTATION_NAVIGATOR_SEARCH_MIN_LENGTH || text.length <= maxLength) {
    return text
  }

  const matchIndex = text.toLocaleLowerCase().indexOf(query)

  if (matchIndex === -1) {
    return text.slice(0, maxLength)
  }

  const contextLength = Math.max(0, Math.floor((maxLength - query.length) / 2))
  const start = Math.max(0, matchIndex - contextLength)
  const end = Math.min(text.length, start + maxLength)
  const prefix = start > 0 ? '...' : ''
  const suffix = end < text.length ? '...' : ''

  return `${prefix}${text.slice(start, end)}${suffix}`
}

function createEmptySearchState(query: string): QuotationNavigatorSearchState {
  return {
    isActive: false,
    query,
    matchCount: 0,
    firstMatchId: null,
    visibleIds: new Set(),
    matchIds: new Set(),
    nameMatchIds: new Set(),
    descriptionMatchIds: new Set(),
    sectionTitleMatchIds: new Set(),
    expandedIds: new Set(),
  }
}

function visitRootItem(
  item: QuotationRootItem,
  query: string,
  state: QuotationNavigatorSearchState,
): boolean {
  if (isQuotationSectionHeader(item)) {
    const matchesTitle = containsSearchQuery(item.title, query)

    if (matchesTitle) {
      markMatch(item.id, state)
      state.sectionTitleMatchIds.add(item.id)
      state.visibleIds.add(item.id)
    }

    return matchesTitle
  }

  return visitQuotationItem(item, query, state)
}

function visitQuotationItem(
  item: QuotationItem,
  query: string,
  state: QuotationNavigatorSearchState,
): boolean {
  const matchesName = containsSearchQuery(item.name, query)
  const matchesDescription = containsSearchQuery(item.description, query)
  const selfMatches = matchesName || matchesDescription
  let childMatches = false

  if (selfMatches) {
    markMatch(item.id, state)
  }

  if (matchesName) {
    state.nameMatchIds.add(item.id)
  }

  if (matchesDescription) {
    state.descriptionMatchIds.add(item.id)
  }

  if (selfMatches && item.children.length > 0) {
    state.expandedIds.add(item.id)
  }

  for (const child of item.children) {
    childMatches = visitQuotationItem(child, query, state) || childMatches
  }

  if (selfMatches || childMatches) {
    state.visibleIds.add(item.id)
  }

  if (selfMatches) {
    markDescendantsVisible(item.children, state)
  }

  if (childMatches) {
    state.expandedIds.add(item.id)
  }

  return selfMatches || childMatches
}

function markDescendantsVisible(items: QuotationItem[], state: QuotationNavigatorSearchState) {
  for (const item of items) {
    state.visibleIds.add(item.id)

    if (item.children.length > 0) {
      state.expandedIds.add(item.id)
      markDescendantsVisible(item.children, state)
    }
  }
}

function markMatch(itemId: string, state: QuotationNavigatorSearchState) {
  if (!state.matchIds.has(itemId)) {
    state.matchCount += 1
    state.matchIds.add(itemId)
  }

  if (!state.firstMatchId) {
    state.firstMatchId = itemId
  }
}

function containsSearchQuery(value: string, query: string) {
  return value.toLocaleLowerCase().includes(query)
}
