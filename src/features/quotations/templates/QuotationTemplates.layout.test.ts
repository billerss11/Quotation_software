import { describe, expect, it } from 'vitest'

import { getQuotationDocumentTableLayout } from '../utils/quotationDocumentTableLayout'

import electronMainSource from '../../../../electron/main.ts?raw'
import printDocumentSource from '../components/QuotationPrintDocumentView.vue?raw'
import quotationPreviewSource from '../components/QuotationPreview.vue?raw'
import executiveSummaryTemplateSource from './executive-summary/ExecutiveSummaryQuotationTemplate.vue?raw'
import luminousTemplateSource from './luminous/LuminousQuotationTemplate.vue?raw'
import floatingPreviewSource from '../components/FloatingPreviewWindow.vue?raw'
import paginatedDocumentSource from '../components/QuotationPaginatedDocument.vue?raw'
import itemsTableSource from './shared/QuotationItemsTable.vue?raw'
import technicalBidTemplateSource from './technical-bid/TechnicalBidQuotationTemplate.vue?raw'

describe('quotation template print layout safeguards', () => {
  it('lets the PDF exporter choose portrait or landscape A4', () => {
    expect(electronMainSource).toContain("landscape: orientation === 'landscape'")
    expect(printDocumentSource).not.toMatch(/@page\s*\{[^}]*size:/s)
    expect(quotationPreviewSource).toContain('getQuotationDocumentOrientation(props.quotation)')
  })

  it('keeps the technical-bid ledger inside the page with long content', () => {
    expect(itemsTableSource).toMatch(
      /\.quotation-table-technical-bid\s*\{\s*table-layout: fixed;/,
    )
    expect(itemsTableSource).toMatch(
      /\.quotation-table-technical-bid \.col-description\s*\{\s*min-width: 0;\s*overflow-wrap: anywhere;/,
    )
  })

  it('fits technical-bid grand totals on one line and still wraps other large header values', () => {
    expect(technicalBidTemplateSource).toMatch(
      /\.hero-total-value\s*\{[^}]*font-size: 20px;[^}]*white-space: nowrap;/s,
    )
    expect(technicalBidTemplateSource).toMatch(
      /\.hero-total-value-long\s*\{[^}]*font-size: 16px;/s,
    )
    expect(technicalBidTemplateSource).toMatch(
      /\.snapshot-value\s*\{[^}]*overflow-wrap: anywhere;/s,
    )
    expect(technicalBidTemplateSource).toMatch(
      /\.quotation-title\s*\{[^}]*overflow-wrap: anywhere;/s,
    )
    expect(technicalBidTemplateSource).toContain(
      "'company-name-extra-long': companyProfile.companyName.length >= 60",
    )
    expect(technicalBidTemplateSource).toMatch(
      /\.company-name-extra-long\s*\{[^}]*width: 190px;[^}]*font-size: 14px;[^}]*word-break: break-word;/s,
    )
    expect(technicalBidTemplateSource).toMatch(
      /\.company-contact span\s*\{[^}]*max-width: 100%;[^}]*overflow-wrap: anywhere;[^}]*word-break: break-word;/s,
    )
    expect(technicalBidTemplateSource).toMatch(
      /\.quotation-meta-item\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\);/s,
    )
  })

  it('wraps oversized table values inside their assigned columns', () => {
    expect(itemsTableSource).toMatch(
      /\.item-title,\s*\.item-detail\s*\{[^}]*max-width: 100%;[^}]*overflow-wrap: anywhere;/s,
    )
    expect(itemsTableSource).toMatch(
      /\.quotation-table td\.col-unit-long\s*\{[^}]*white-space: normal;[^}]*overflow-wrap: anywhere;/s,
    )
  })

  it('uses a compact price breakdown only when actual mixed-tax values cannot fit', () => {
    const ordinaryColumns = [
      { kind: 'text' as const, header: 'Tax %', values: ['Mixed (effective 12.22%)'] },
      ...Array.from({ length: 6 }, () => ({
        kind: 'money' as const,
        header: 'Amount',
        values: ['$39,140.94'],
      })),
    ]
    const longValueColumns = ordinaryColumns.map((column) =>
      column.kind === 'money' ? { ...column, values: ['$12,345,678,901.23'] } : column,
    )

    expect(getQuotationDocumentTableLayout(ordinaryColumns, ['24']).compactPriceBreakdown).toBe(false)
    expect(getQuotationDocumentTableLayout(longValueColumns, ['24']).compactPriceBreakdown).toBe(true)
    expect(itemsTableSource).toContain(
      'table-mixed-tax-columns-${visibleMixedTaxColumnDefinitions.value.length}',
    )
    expect(itemsTableSource).toContain("'table-mixed-tax-wide': isWideMixedTaxTable.value")
    expect(itemsTableSource).toContain("'table-price-breakdown': usesCompactPriceBreakdown.value")
  })

  it('uses monotonically increasing indent and decreasing hierarchy emphasis', () => {
    expect(itemsTableSource).toMatch(
      /\.item-description-level-1\s*\{[^}]*padding-left: 8px;/s,
    )
    expect(itemsTableSource).toMatch(
      /\.item-description-level-2\s*\{[^}]*padding-left: 22px;/s,
    )
    expect(itemsTableSource).toMatch(
      /\.item-description-level-3\s*\{[^}]*padding-left: 36px;/s,
    )
    expect(itemsTableSource).toMatch(
      /\.item-description-level-1 \.item-title\s*\{[^}]*font-weight: 800;/s,
    )
    expect(itemsTableSource).toMatch(
      /\.item-description-level-2 \.item-title\s*\{[^}]*font-weight: 700;/s,
    )
    expect(itemsTableSource).toMatch(
      /\.item-description-level-3 \.item-title\s*\{[^}]*font-weight: 600;/s,
    )
  })

  it('uses the adaptive wide money column for sparse mixed-tax layouts', () => {
    const layout = getQuotationDocumentTableLayout([
      { kind: 'text', header: 'Tax %', values: ['13%'] },
      { kind: 'money', header: 'Amount', values: ['$994.63'] },
    ], ['2'])

    expect(layout.moneyColumnWidth).toBe(124)
    expect(layout.taxColumnWidth).toBe(58)
    expect(layout.compactPriceBreakdown).toBe(false)
  })

  it('repeats the quotation table header when a PDF spans pages', () => {
    expect(itemsTableSource).toMatch(
      /\.quotation-table thead\s*\{[^}]*display: table-header-group;/s,
    )
  })

  it('keeps ordinary units whole and contains genuinely long unit codes', () => {
    expect(itemsTableSource).toContain('return value.length > 10')
    expect(itemsTableSource).toMatch(
      /\.col-unit\s*\{\s*white-space: normal;\s*overflow-wrap: anywhere;/,
    )
    expect(itemsTableSource).toMatch(
      /\.quotation-table td\.col-unit-long\s*\{[^}]*font-size: 10\.67px;[^}]*white-space: normal;[^}]*overflow-wrap: anywhere;[^}]*word-break: normal;/s,
    )
  })

  it.each([
    ['Executive Summary', executiveSummaryTemplateSource, /\.total-panel\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\);/s],
    ['Luminous', luminousTemplateSource, /\.amount-panel\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\);/s],
  ])('gives the %s commercial snapshot a full-width total row', (_name, source, panelRule) => {
    expect(source).toMatch(panelRule)
    expect(source).toMatch(
      /\.snapshot-item dd\s*\{[^}]*overflow-wrap: anywhere;/s,
    )
  })

  it('uses the same paginated component for screen preview and PDF, with explicit print readiness', () => {
    expect(printDocumentSource).toContain('QuotationPaginatedDocument')
    expect(floatingPreviewSource).toContain('QuotationPaginatedDocument')
    expect(printDocumentSource).toContain('@ready="onReady"')
    expect(paginatedDocumentSource).toContain('paginateQuotationDocument')
    expect(electronMainSource).toContain("preferCSSPageSize: renderMode === 'quotation-print'")
  })
})
