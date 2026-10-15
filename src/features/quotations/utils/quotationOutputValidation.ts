import type { QuotationDraft, QuotationRootItem } from '../types.js'

type QuotationOutputErrorCode =
  | 'quotation_number_required'
  | 'informational_total_selection_required'
  | 'informational_total_sections_missing'
  | 'informational_total_items_selection_required'
  | 'informational_total_items_missing'

const outputErrorMessages: Record<QuotationOutputErrorCode, string> = {
  quotation_number_required: 'A quotation number is required before saving or exporting.',
  informational_total_selection_required: 'Select at least one section for each visible informational total before exporting.',
  informational_total_sections_missing: 'A section selected by a visible informational total no longer exists.',
  informational_total_items_selection_required: 'Select at least one item for each visible informational total before exporting.',
  informational_total_items_missing: 'An item selected by a visible informational total no longer exists.',
}

const outputErrorMessageKeys: Partial<Record<QuotationOutputErrorCode, string>> = {
  informational_total_selection_required: 'quotations.summaryDisplay.selectionRequired',
  informational_total_sections_missing: 'quotations.summaryDisplay.sectionsMissing',
  informational_total_items_selection_required: 'quotations.summaryDisplay.itemsSelectionRequired',
  informational_total_items_missing: 'quotations.summaryDisplay.itemsMissing',
}

export class QuotationOutputError extends Error {
  readonly messageKey: string | undefined

  constructor(
    public readonly code: QuotationOutputErrorCode,
    public readonly fieldPath: string = 'quotation.header.quotationNumber',
    public readonly params: Record<string, string> = {},
  ) {
    super(outputErrorMessages[code])
    this.name = 'QuotationOutputError'
    this.messageKey = outputErrorMessageKeys[code]
  }
}

export function assertQuotationInformationalTotalsReadyForOutput(
  quotation: Pick<QuotationDraft, 'majorItems' | 'outputSettings'>,
) {
  const settings = quotation.outputSettings
  if (!settings?.showInformationalTotals) return

  const sections = new Map(quotation.majorItems.flatMap((item) =>
    'kind' in item && item.kind === 'section_header' ? [[item.id, item.title] as const] : [],
  ))
  const items = new Map<string, string>()
  collectItems(quotation.majorItems)

  settings.informationalTotals?.forEach((row, index) => {
    if (!row.visible) return
    const usesItems = row.source === 'items'
    const selectedIds = [...new Set(usesItems ? row.itemIds ?? [] : row.sectionIds)]
    const available = usesItems ? items : sections
    const label = row.label.trim() || selectedIds.flatMap((id) => {
      const title = available.get(id)
      return title ? [title] : []
    }).join(' + ') || row.id
    const fieldPath = `quotation.outputSettings.informationalTotals[${index}].${usesItems ? 'itemIds' : 'sectionIds'}`

    if (selectedIds.length === 0) {
      throw new QuotationOutputError(usesItems ? 'informational_total_items_selection_required' : 'informational_total_selection_required', fieldPath, { label })
    }

    const missingIds = selectedIds.filter((id) => !available.has(id))
    if (missingIds.length > 0) {
      throw new QuotationOutputError(usesItems ? 'informational_total_items_missing' : 'informational_total_sections_missing', fieldPath, {
        label,
        [usesItems ? 'itemIds' : 'sectionIds']: missingIds.join(', '),
      })
    }
  })

  function collectItems(rows: QuotationRootItem[]) {
    rows.forEach((item) => {
      if (!('children' in item)) return
      items.set(item.id, item.name)
      collectItems(item.children)
    })
  }
}

export function assertQuotationReadyForOutput(
  quotation: Pick<QuotationDraft, 'header'>,
) {
  if (!quotation.header.quotationNumber.trim()) {
    throw new QuotationOutputError('quotation_number_required')
  }
}
