import { describe, expect, it } from 'vitest'

import electronMainSource from '../../../../electron/main.ts?raw'
import printDocumentSource from '../components/QuotationPrintDocumentView.vue?raw'
import quotationPreviewSource from '../components/QuotationPreview.vue?raw'
import atelierTemplateSource from './atelier/AtelierQuotationTemplate.vue?raw'
import executiveSummaryTemplateSource from './executive-summary/ExecutiveSummaryQuotationTemplate.vue?raw'
import luminousTemplateSource from './luminous/LuminousQuotationTemplate.vue?raw'
import spreadsheetTemplateSource from './spreadsheet/SpreadsheetQuotationTemplate.vue?raw'
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
      /\.col-unit\s*\{[^}]*overflow-wrap: anywhere;/s,
    )
    expect(itemsTableSource).toMatch(
      /\.col-money\s*\{[^}]*white-space: normal;[^}]*overflow-wrap: anywhere;/s,
    )
  })

  it('uses one wide layout when five or more mixed-tax columns are shown', () => {
    expect(itemsTableSource).toContain(
      'table-mixed-tax-columns-${visibleMixedTaxColumnDefinitions.value.length}',
    )
    expect(itemsTableSource).toMatch(
      /\.quotation-table\.table-mixed-tax-wide :is\(\.col-money, \.ledger-col-money\)\s*\{\s*width: 82px;/,
    )
    expect(itemsTableSource).toMatch(
      /\.quotation-table\.table-mixed-tax-wide :is\(\.col-qty, \.ledger-col-qty\)\s*\{\s*width: 38px;/,
    )
    expect(itemsTableSource).toMatch(
      /\.quotation-table\.table-mixed-tax-wide\s*\{\s*font-size: 10px;/,
    )
    expect(itemsTableSource).toContain("'table-mixed-tax-wide': isWideMixedTaxTable.value")
  })

  it('keeps compact mixed-tax level-3 descriptions clear of their hierarchy rule', () => {
    expect(itemsTableSource).toMatch(
      /\.quotation-table-classic\.table-mixed-tax \.item-description-level-3\s*\{\s*padding-left: 24px;/,
    )
    expect(itemsTableSource).toMatch(
      /\.quotation-table-legacy\.table-mixed-tax \.item-description-level-3\s*\{\s*padding-left: 20px;/,
    )
    expect(itemsTableSource).toMatch(
      /\.quotation-table-executive-summary\.table-mixed-tax \.item-description-level-3\s*\{\s*padding-left: 20px;/,
    )
    expect(itemsTableSource).toMatch(
      /\.quotation-table-luminous\.table-mixed-tax \.item-description-level-3\s*\{\s*padding-left: 20px;/,
    )
  })

  it('uses the adaptive wide money column for sparse mixed-tax layouts', () => {
    expect(itemsTableSource).toMatch(
      /\.quotation-table\.table-mixed-tax-columns-2 :is\(\.col-money, \.ledger-col-money\)\s*\{\s*width: var\(--mixed-money-column-width, 124px\);/,
    )
  })

  it('repeats the quotation table header when a PDF spans pages', () => {
    expect(itemsTableSource).toMatch(
      /\.quotation-table thead\s*\{[^}]*display: table-header-group;/s,
    )
  })

  it('wraps long quantity units at word boundaries in a compact font', () => {
    expect(itemsTableSource).toContain("'col-unit-long': displayRow.row.quantityUnit.length >= 9")
    expect(itemsTableSource).toMatch(
      /\.quotation-table td\.col-unit-long\s*\{[^}]*font-size: 9px;[^}]*overflow-wrap: normal;[^}]*word-break: normal;/s,
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

  it('keeps the Atelier closing summary together across page breaks', () => {
    expect(atelierTemplateSource).toMatch(
      /\.closing-grid\s*\{[^}]*break-inside: avoid;[^}]*page-break-inside: avoid;/s,
    )
  })

  it('keeps the spreadsheet totals and terms together across page breaks', () => {
    expect(spreadsheetTemplateSource).toMatch(
      /\.summary-grid\s*\{[^}]*break-inside: avoid;[^}]*page-break-inside: avoid;/s,
    )
  })
})
