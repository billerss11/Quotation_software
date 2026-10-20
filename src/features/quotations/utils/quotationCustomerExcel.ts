import { createI18n } from 'vue-i18n'
import { messages } from '@/shared/i18n/messages'
import { getQuotationExcelWorkbookLabels } from '@/shared/i18n/quotationExcelWorkbook'
import { formatIsoDate } from '@/shared/utils/formatters'
import type { QuotationDraft } from '../types'
import { formatChineseCurrencyAmount } from './chineseCurrencyAmount'
import { getMixedTaxDocumentColumnDefinitions } from './quotationDocumentColumns'
import {
  EMPTY_QUOTATION_PREVIEW_ROW_PRICING,
  getMixedTaxDocumentColumnValue,
  getQuotationPreviewRowAmount,
  getQuotationPreviewRowUnitPrice,
} from './quotationDocumentColumnValues'
import { normalizeQuotationOutputSettings } from './quotationOutputSettings'
import { assertQuotationInformationalTotalsReadyForOutput } from './quotationOutputValidation'
import { createQuotationPreviewRowPricingMap } from './quotationPreviewPricing'
import { createQuotationPreviewRows } from './quotationPreviewRows'
import { createQuotationSnapshotPayload } from './quotationSnapshotPayload'
import { getQuotationSections, getQuotationSubtotalLabel, getQuotationSummaryItems, resolveQuotationInformationalTotals } from './quotationSummaryDisplay'
import { createCalculationTotalsConfig, formatTaxRatePercentage } from './quotationTaxes'
import { excelColumn, EXCEL_STYLE as style, writeQuotationExcelWorkbook, type ExcelWorksheet } from './quotationExcelWorkbook'

/** Excel caps row height at 409 points. Continue long text without losing content. */
function textParts(text: string, width: number, maximumLines = 18): string[] {
  const parts: string[] = []
  let part = ''
  let lines = 1
  let lineWidth = 0
  for (const character of text) {
    const weight = character.charCodeAt(0) > 255 ? 2 : 1
    if (character === '\n') {
      lines++
      lineWidth = 0
    } else {
      lineWidth += weight
      if (lineWidth > width) {
        lines++
        lineWidth = weight
      }
    }
    if (lines > maximumLines) {
      parts.push(part)
      part = ''
      lines = 1
    }
    part += character
  }
  if (part || !parts.length) parts.push(part)
  return parts
}

/** Public, values-only projection of the same rows and figures used by the PDF. */
export function createCustomerQuotationExcelWorkbook(source: QuotationDraft, locale: string = source.header.documentLocale): Uint8Array {
  assertQuotationInformationalTotalsReadyForOutput(source)
  const { quotation, summaries, totals, companyProfile } = createQuotationSnapshotPayload(source)
  const documentLocale = locale === 'zh-CN' ? 'zh-CN' : 'en-US'
  const { t } = createI18n({ legacy: false, locale: documentLocale, fallbackLocale: 'en-US', messages }).global
  const labels = getQuotationExcelWorkbookLabels(documentLocale)
  const settings = normalizeQuotationOutputSettings(quotation.outputSettings)
  const mixed = quotation.totalsConfig.taxMode === 'mixed'
  const columns = mixed ? getMixedTaxDocumentColumnDefinitions(quotation.totalsConfig.mixedTaxColumns) : []
  const rows = createQuotationPreviewRows(quotation.majorItems, summaries, settings)
  const prices = createQuotationPreviewRowPricingMap(
    quotation.majorItems, quotation.totalsConfig.globalMarkupRate, quotation.exchangeRates,
    createCalculationTotalsConfig(quotation.totalsConfig), settings,
  )
  const widths = [8, 54, 10, 11, ...(mixed ? columns.map(column => column.valueKind === 'text' ? 21 : 16) : [17, 19])]
  const lastColumn = excelColumn(widths.length)
  const sheet: ExcelWorksheet = {
    sheetName: labels.customerSheet, cells: new Map(), widths,
    lastRow: 1, printLastRow: 1, printColumnCount: widths.length,
    merges: [], freezeColumns: 2, protected: false,
    paperSize: widths.length > 8 ? 8 : 9,
  }
  const moneyFormat = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const set = (address: string, value: string | number | null, cellStyle: number = style.text, columnSpan = 1) => {
    sheet.cells.set(address, { value: value ?? '', style: cellStyle })
    if (typeof value === 'number' && Number.isFinite(value) && (cellStyle === style.money || cellStyle === style.total)) {
      const column = [...address.replace(/\d/g, '')].reduce((index, letter) => index * 26 + letter.charCodeAt(0) - 64, 0) - 1
      const text = value < 0 ? `(${moneyFormat.format(-value)})` : moneyFormat.format(value)
      // Excel widths use the normal font; the bold 12-point total needs more room.
      const required = Math.ceil(text.length * (cellStyle === style.total ? 1.3 : 1) + 2)
      const available = widths.slice(column, column + columnSpan).reduce((sum, width) => sum + width, 0)
      const last = column + columnSpan - 1
      widths[last] = Math.min(255, widths[last]! + Math.max(0, required - available))
    }
  }
  let row = 1
  function fullRow(text: string, cellStyle: number = style.text) {
    const width = widths.reduce((sum, value) => sum + value, 0) - 2
    const heading = cellStyle === style.title || cellStyle === style.section
    for (const part of textParts(text, heading ? width * 0.8 : width, heading ? 1 : 18)) {
      sheet.merges!.push(`A${row}:${lastColumn}${row}`)
      set(`A${row}`, part, cellStyle)
      row++
    }
  }
  fullRow(`${t('quotations.document.title')}  ${quotation.header.quotationNumber}`, style.title)
  fullRow(companyProfile.companyName, style.title)
  if (companyProfile.email || companyProfile.phone) fullRow([companyProfile.email, companyProfile.phone].filter(Boolean).join('   '), style.note)
  fullRow([
    `${t('quotations.document.date')}: ${formatIsoDate(quotation.header.quotationDate, documentLocale)}`,
    `${t('quotations.document.revision')}: ${quotation.header.revisionNumber ?? 1}`,
    `${t('quotations.document.currency')}: ${quotation.header.currency}`,
  ].join('   '))
  fullRow([
    `${t('quotations.document.preparedFor')}: ${quotation.header.customerCompany || quotation.header.contactPerson || t('quotations.document.customerFallback')}`,
    quotation.header.contactPerson, quotation.header.contactDetails,
  ].filter(Boolean).join('\n'))
  fullRow(`${t('quotations.document.project')}: ${quotation.header.projectName || t('quotations.document.projectFallback')}`)
  if (quotation.header.validityPeriod) fullRow(`${t('quotations.document.valid')}: ${quotation.header.validityPeriod}`)
  row++
  sheet.headerRow = row
  sheet.freezeRows = row
  const headers = [
    t('quotations.document.table.no'), t('quotations.document.table.description'),
    t('quotations.document.table.qty'), t('quotations.document.table.unit'),
    ...(mixed ? columns.map(column => [
      t(column.headerLabelKey),
      documentLocale === 'en-US' && column.headerNoteKey ? t(column.headerNoteKey) : '',
    ].filter(Boolean).join('\n')) : [t('quotations.document.table.unitPrice'), t('quotations.document.table.amount')]),
  ]
  headers.forEach((label, index) => set(`${excelColumn(index + 1)}${row}`, label, style.header))
  row++
  const taxLabels = {
    mixed: t('quotations.document.mixedTax'),
    mixedEffective: (rate: string) => t('quotations.document.mixedTaxEffective', { rate }),
  }
  for (const item of rows) {
    if (item.type === 'section') {
      fullRow(item.description, style.section)
      continue
    }
    const pricing = prices.get(item.key) ?? EMPTY_QUOTATION_PREVIEW_ROW_PRICING
    const parts = textParts([item.description, item.detail].filter(Boolean).join('\n'), widths[1]! - 4)
    set(`A${row}`, item.itemNumber, style.centered)
    set(`C${row}`, item.quantity, style.centered)
    set(`D${row}`, item.quantityUnit, style.centered)
    if (mixed) {
      columns.forEach((column, index) => {
        const value = getMixedTaxDocumentColumnValue(column.id, item, pricing, taxLabels)
        set(`${excelColumn(index + 5)}${row}`, value.value, value.kind === 'money' ? style.money : style.centered)
      })
    } else {
      set(`E${row}`, getQuotationPreviewRowUnitPrice(item, pricing), style.money)
      set(`F${row}`, getQuotationPreviewRowAmount(item, pricing), style.money)
    }
    // Continuations contain description only; amounts are never duplicated.
    for (const part of parts) {
      set(`B${row}`, `${'  '.repeat(item.level - 1)}${part}`)
      row++
    }
  }
  row++
  const amountColumnIndex = widths.length > 4 ? widths.length : widths.length - 1
  const amountColumn = excelColumn(amountColumnIndex)
  const labelEnd = excelColumn(amountColumnIndex - 1)
  function summary(label: string, amount: number | null, total = false) {
    const width = widths.slice(0, amountColumnIndex - 1).reduce((sum, value) => sum + value, 0) - 2
    textParts(label, total ? width * 0.8 : width, total ? 1 : 18).forEach((part, index) => {
      sheet.merges!.push(`A${row}:${labelEnd}${row}`)
      if (amountColumn !== lastColumn) sheet.merges!.push(`${amountColumn}${row}:${lastColumn}${row}`)
      set(`A${row}`, part, total ? style.section : style.text)
      if (index === 0) set(`${amountColumn}${row}`, amount ?? t('common.emptyValue'), total ? style.total : style.money, widths.length - amountColumnIndex + 1)
      row++
    })
  }
  const subtotalLabel = getQuotationSubtotalLabel(settings, t('quotations.document.subtotal'))
  const needsItemTotals = settings.showInformationalTotals && settings.informationalTotals?.some(item => item.visible && item.source === 'items')
  const informationals = resolveQuotationInformationalTotals(
    settings, getQuotationSections(quotation.majorItems, summaries),
    needsItemTotals ? getQuotationSummaryItems(quotation, summaries) : [],
  ).filter(item => item.isVisible)
  if (informationals.length) {
    fullRow(t('quotations.summaryDisplay.documentTitle'), style.section)
    const note = settings.informationalTotalsNote ?? t('quotations.summaryDisplay.documentNote', { subtotalLabel })
    if (note.trim()) fullRow(note, style.note)
    informationals.forEach(item => summary(item.label || t('quotations.summaryDisplay.untitled'), item.amount))
    row++
  }
  summary(subtotalLabel, totals.subtotalAfterMarkup)
  if (mixed) {
    totals.taxBuckets.filter(bucket => bucket.taxableSubtotal > 0)
      .forEach(bucket => summary(t('quotations.document.taxBucket', { label: bucket.label }), bucket.taxAmount))
  } else if (totals.taxAmount > 0) {
    const tax = quotation.totalsConfig.taxClasses?.find(item => item.id === quotation.totalsConfig.defaultTaxClassId) ?? quotation.totalsConfig.taxClasses?.[0]
    summary(t('quotations.document.taxWithRate', { rate: tax ? formatTaxRatePercentage(tax.rate) : '' }), totals.taxAmount)
  }
  for (const charge of quotation.totalsConfig.extraCharges ?? []) {
    if (Number.isFinite(charge.amount) && charge.amount > 0) summary(charge.label || t('quotations.document.extraChargeFallback'), charge.amount)
  }
  summary(t('quotations.document.total'), totals.grandTotal, true)
  if (documentLocale === 'zh-CN') {
    fullRow(t('quotations.document.amountInWords', { amount: formatChineseCurrencyAmount(totals.grandTotal, quotation.header.currency) }), style.note)
  }
  row++
  fullRow(t('quotations.document.notesTerms'), style.section)
  if (quotation.header.notes || !quotation.header.terms) fullRow(quotation.header.notes || t('quotations.document.defaultTerms'))
  if (quotation.header.terms) fullRow(quotation.header.terms)
  sheet.lastRow = sheet.printLastRow = row - 1
  return writeQuotationExcelWorkbook({ sheets: [sheet], mixedLabel: labels.mixed, centerMoney: true })
}
