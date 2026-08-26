import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createAppI18n } from '@/shared/i18n/createAppI18n'

import type { QuotationDraft, TaxMode } from '../../types'
import {
  calculateMajorItemSummary,
  calculateQuotationTotals,
} from '../../utils/quotationCalculations'
import { createInitialQuotation } from '../../utils/quotationDraft'
import { createQuotationItem, isQuotationItem } from '../../utils/quotationItems'
import QuotationItemsTable from './QuotationItemsTable.vue'

describe('QuotationItemsTable money font consistency', () => {
  afterEach(() => {
    document.body.replaceChildren()
    vi.unstubAllGlobals()
  })

  it.each([
    ['single', undefined],
    ['mixed', ['taxRate', 'unitPrice', 'unitTax', 'unitPriceWithTax', 'taxAmount', 'netAmount', 'grossAmount']],
  ] as const)(
    'renders short and long %s-tax line-item money values at one font size',
    (taxMode, mixedTaxColumns) => {
      const quotation = createQuotation(taxMode, mixedTaxColumns)
      const wrapper = mountTable(quotation)

      try {
        const renderedMoneyValues = wrapper.findAll<HTMLElement>('.money-value').map((value) => ({
          text: value.text().trim(),
          fontSize: getComputedStyle(value.element).fontSize,
        }))
        const uniqueFontSizes = [...new Set(renderedMoneyValues.map((value) => value.fontSize))]

        expect(renderedMoneyValues.some((value) => value.text.length < 10)).toBe(true)
        expect(renderedMoneyValues.some((value) => value.text.length >= 18)).toBe(true)
        expect(
          uniqueFontSizes,
          `Line-item money values must use one font size: ${JSON.stringify(renderedMoneyValues)}`,
        ).toHaveLength(1)
      } finally {
        wrapper.unmount()
      }
    },
  )
})

function createQuotation(
  taxMode: TaxMode,
  mixedTaxColumns: Readonly<NonNullable<QuotationDraft['totalsConfig']['mixedTaxColumns']>> | undefined,
) {
  let nextId = 1
  vi.stubGlobal('crypto', { randomUUID: () => `font-consistency-${nextId++}` })

  const quotation = createInitialQuotation([], 'en-US')
  const taxClassId = 'tax-standard'
  quotation.majorItems = [
    createQuotationItem('USD', {
      name: 'Short value',
      pricingMethod: 'manual_price',
      manualUnitPrice: 12.34,
      taxClassId,
    }),
    createQuotationItem('USD', {
      name: 'Long value',
      pricingMethod: 'manual_price',
      manualUnitPrice: 12_345_678.9,
      taxClassId,
    }),
    createQuotationItem('USD', {
      name: 'Extra-long value',
      pricingMethod: 'manual_price',
      manualUnitPrice: 12_345_678_901.23,
      taxClassId,
    }),
  ]
  quotation.totalsConfig = {
    globalMarkupRate: 0,
    taxMode,
    taxClasses: [{ id: taxClassId, label: 'Standard', rate: 13 }],
    defaultTaxClassId: taxClassId,
    mixedTaxColumns: mixedTaxColumns ? [...mixedTaxColumns] : undefined,
  }

  return quotation
}

function mountTable(quotation: QuotationDraft) {
  const quotationItems = quotation.majorItems.filter(isQuotationItem)
  const summaries = quotationItems.map((item) =>
    calculateMajorItemSummary(item, quotation.totalsConfig, quotation.exchangeRates),
  )

  return mount(QuotationItemsTable, {
    attachTo: document.body,
    props: {
      quotation,
      summaries,
      totals: calculateQuotationTotals(
        quotation.majorItems,
        quotation.totalsConfig,
        quotation.exchangeRates,
      ),
      globalMarkupRate: quotation.totalsConfig.globalMarkupRate,
      exchangeRates: quotation.exchangeRates,
      variant: 'classic',
    },
    global: { plugins: [createAppI18n('en-US')] },
  })
}
