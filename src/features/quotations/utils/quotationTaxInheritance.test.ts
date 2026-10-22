import { shallowRef } from 'vue'
import { describe, expect, it } from 'vitest'

import { useLineItemCardPricing } from '../composables/useLineItemCardPricing'
import { createCalculationSheetRows } from './quotationCalculationSheetRows'
import { createInitialQuotation } from './quotationDraft'
import { buildQuotationExcelModel } from './quotationExcelModel'
import { createQuotationItem } from './quotationItems'
import { createQuotationPreviewRowPricingMap, getQuotationPreviewRowPricing } from './quotationPreviewPricing'

function createFixture(taxAllocationVersion: 1 | 2) {
  const quotation = createInitialQuotation([], 'en-US')
  quotation.totalsConfig = {
    globalMarkupRate: 0,
    taxAllocationVersion,
    taxMode: 'mixed',
    defaultTaxClassId: 'zero',
    taxClasses: [{ id: 'zero', label: 'Zero', rate: 0 }, { id: 'goods', label: 'Goods', rate: 13 }],
  }
  const root = createQuotationItem('USD', {
    id: 'root', taxClassId: 'goods', children: [createQuotationItem('USD', {
      id: 'group', taxClassId: 'deleted', children: [createQuotationItem('USD', {
        id: 'leaf', pricingMethod: 'manual_price', manualUnitPrice: 100,
      })],
    })],
  })
  quotation.majorItems = [root]
  return { quotation, root }
}

describe.each([1, 2] as const)('valid ancestor tax across outputs, policy %s', (policy) => {
  it('keeps preview, calculation-sheet, and Excel descendant values aligned with the parent', () => {
    const { quotation, root } = createFixture(policy)
    const preview = createQuotationPreviewRowPricingMap([root], 0, quotation.exchangeRates, quotation.totalsConfig)
    for (const key of ['root-major', 'group-sub', 'leaf-sub']) {
      expect(preview.get(key)).toMatchObject({ taxClassId: 'goods', taxRate: 13, amountWithTax: 113 })
    }
    expect(getQuotationPreviewRowPricing([root], 'leaf-subtotal', 0, quotation.exchangeRates, quotation.totalsConfig))
      .toMatchObject({ taxClassId: 'goods', amountWithTax: 113 })

    const sheetRows = createCalculationSheetRows({
      item: root, itemNumber: '1', globalMarkupRate: 0,
      exchangeRates: quotation.exchangeRates, totalsConfig: quotation.totalsConfig,
    })
    expect(sheetRows).toHaveLength(3)
    for (const row of sheetRows) expect(row).toMatchObject({ taxRate: 13, totalTaxAmount: 13, totalWithTax: 113 })

    const workbook = buildQuotationExcelModel(quotation, 'internal')
    expect(workbook.totals.grandTotal).toBe(113)
    for (const node of workbook.nodes) {
      expect(workbook.cells.get(`E${node.row}`)?.value).toBe(0.13)
      expect(workbook.cells.get(`I${node.row}`)?.value).toBe(13)
      expect(workbook.cells.get(`K${node.row}`)?.value).toBe(113)
    }
  })

  it('updates cached child-card tax inheritance when a class disappears', () => {
    const { quotation, root } = createFixture(policy)
    const config = shallowRef({
      ...quotation.totalsConfig,
      taxClasses: [...quotation.totalsConfig.taxClasses!, { id: 'deleted', label: 'Former', rate: 20 }],
    })
    const pricing = useLineItemCardPricing({
      item: () => root, expanded: () => true, rootItemNumber: () => '1',
      globalMarkupRate: () => 0, exchangeRates: () => quotation.exchangeRates, totalsConfig: () => config.value,
    })
    expect(pricing.getPricing('leaf')?.totalWithTax).toBe(120)
    config.value = { ...config.value, taxClasses: config.value.taxClasses.filter((taxClass) => taxClass.id !== 'deleted') }
    for (const id of ['root', 'group', 'leaf']) {
      expect(pricing.getPricing(id)).toMatchObject({ taxClassId: 'goods', taxRate: 13, taxAmount: 13, totalWithTax: 113 })
    }
  })
})
