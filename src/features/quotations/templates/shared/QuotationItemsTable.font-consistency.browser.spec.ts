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
    document.body.removeAttribute('style')
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

  it('contains long money, SKU, description, quantity, and unit text inside the A4 ledger', () => {
    document.body.style.width = '1063px'
    const quotation = createQuotation('mixed', [
      'taxRate',
      'unitPrice',
      'unitTax',
      'unitPriceWithTax',
      'taxAmount',
      'netAmount',
      'grossAmount',
    ])
    const stressedItem = quotation.majorItems[2]
    if (!isQuotationItem(stressedItem)) throw new Error('Expected a quotation item')
    stressedItem.name = `SKU-${'X'.repeat(96)}`
    stressedItem.description = `https://example.com/spec/${'y'.repeat(120)}`
    stressedItem.quantity = 123456789012345
    stressedItem.quantityUnit = 'kilowattHourEach'
    const wrapper = mountTable(quotation)

    try {
      expect(wrapper.get('table').classes()).toContain('table-price-breakdown')
      wrapper.findAll<HTMLElement>('.money-value').forEach((value) => {
        expectTextToStayInside(value.element, value.element.closest('.price-breakdown-entry'))
      })
      const stressedRow = wrapper.get<HTMLElement>(`[data-row-key="${stressedItem.id}-major"]`)
      expectTextToStayInside(
        stressedRow.get('.item-title').element,
        stressedRow.get('.col-description').element,
      )
      expectTextToStayInside(
        stressedRow.get('.item-detail').element,
        stressedRow.get('.col-description').element,
      )
      expectTextToStayInside(
        stressedRow.get('.col-qty').element,
        stressedRow.get('.col-qty').element,
      )
      expectTextToStayInside(
        stressedRow.get('.col-unit').element,
        stressedRow.get('.col-unit').element,
      )
    } finally {
      wrapper.unmount()
    }
  })

  it('keeps ordinary full mixed-tax output in separate readable columns', () => {
    document.body.style.width = '1063px'
    const quotation = createQuotation('mixed', [
      'taxRate',
      'unitPrice',
      'unitTax',
      'unitPriceWithTax',
      'taxAmount',
      'netAmount',
      'grossAmount',
    ])
    quotation.majorItems.forEach((item) => {
      if (!isQuotationItem(item)) return
      item.manualUnitPrice = 39_140.94
    })
    const wrapper = mountTable(quotation)

    try {
      expect(wrapper.get('table').classes()).not.toContain('table-price-breakdown')
      expect(wrapper.findAll('thead th')).toHaveLength(11)
      wrapper.findAll<HTMLElement>('td .money-value').forEach((value) => {
        expectTextToStayInside(value.element, value.element.closest('td'))
      })
      wrapper.findAll<HTMLElement>('th').forEach((heading) => {
        expect(Number.parseFloat(getComputedStyle(heading.element).fontSize)).toBeGreaterThanOrEqual(10.67)
        expectTextToStayInside(heading.element, heading.element)
      })
    } finally {
      wrapper.unmount()
    }
  })

  it('renders hierarchy indentation and emphasis in descending order', () => {
    document.body.style.width = '734px'
    const quotation = createHierarchyQuotation()
    const wrapper = mountTable(quotation)

    try {
      const titles = [1, 2, 3].map((level) =>
        wrapper.get<HTMLElement>(`.item-description-level-${level} .item-title`).element,
      )
      const leftEdges = titles.map((title) => title.getBoundingClientRect().left)
      const fontSizes = titles.map((title) => Number.parseFloat(getComputedStyle(title).fontSize))
      const fontWeights = titles.map((title) => Number.parseInt(getComputedStyle(title).fontWeight, 10))

      expect(leftEdges[0]).toBeLessThan(leftEdges[1])
      expect(leftEdges[1]).toBeLessThan(leftEdges[2])
      expect(fontSizes[0]).toBeGreaterThanOrEqual(fontSizes[1])
      expect(fontSizes[1]).toBeGreaterThanOrEqual(fontSizes[2])
      expect(fontWeights[0]).toBeGreaterThan(fontWeights[1])
      expect(fontWeights[1]).toBeGreaterThan(fontWeights[2])
    } finally {
      wrapper.unmount()
    }
  })

  it('keeps common unit labels whole in a portrait table', () => {
    document.body.style.width = '734px'
    const quotation = createQuotation('single', undefined)
    const units = ['PACKAGE', 'SESSION']
    quotation.majorItems.slice(0, 2).forEach((item, index) => {
      if (!isQuotationItem(item)) return
      item.quantityUnit = units[index]
    })
    const wrapper = mountTable(quotation)

    try {
      wrapper.findAll<HTMLElement>('tbody .col-unit').slice(0, 2).forEach((unitCell) => {
        const range = document.createRange()
        range.selectNodeContents(unitCell.element)
        expect(range.getClientRects()).toHaveLength(1)
        expectTextToStayInside(unitCell.element, unitCell.element)
      })
    } finally {
      wrapper.unmount()
    }
  })

  it('contains wide unit glyphs even when the unit has ten or fewer characters', () => {
    document.body.style.width = '734px'
    const quotation = createQuotation('single', undefined)
    const item = quotation.majorItems.find(isQuotationItem)!
    item.quantityUnit = 'MMMMMMMMMM'
    const wrapper = mountTable(quotation)
    try {
      const cell = wrapper.get<HTMLElement>('tbody .col-unit')
      expect(cell.text()).toBe(item.quantityUnit)
      expectTextToStayInside(cell.element, cell.element)
    } finally {
      wrapper.unmount()
    }
  })
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

function createHierarchyQuotation() {
  let nextId = 1
  vi.stubGlobal('crypto', { randomUUID: () => `hierarchy-${nextId++}` })

  const quotation = createInitialQuotation([], 'en-US')
  quotation.majorItems = [
    createQuotationItem('USD', {
      id: 'major',
      name: 'System',
      children: [
        createQuotationItem('USD', {
          id: 'subgroup',
          name: 'Module',
          children: [
            createQuotationItem('USD', {
              id: 'detail',
              name: 'Pump',
              pricingMethod: 'manual_price',
              manualUnitPrice: 100,
            }),
          ],
        }),
      ],
    }),
  ]
  quotation.outputSettings = { itemDetailLevel: 3 }
  return quotation
}

function expectTextToStayInside(textElement: Element, containerElement: Element | null) {
  if (!(containerElement instanceof Element)) throw new Error('Expected a containing element')

  const range = document.createRange()
  range.selectNodeContents(textElement)
  const textRect = range.getBoundingClientRect()
  const containerRect = containerElement.getBoundingClientRect()
  const tolerance = 0.75

  expect(textRect.left).toBeGreaterThanOrEqual(containerRect.left - tolerance)
  expect(textRect.right).toBeLessThanOrEqual(containerRect.right + tolerance)
  expect(textRect.top).toBeGreaterThanOrEqual(containerRect.top - tolerance)
  expect(textRect.bottom).toBeLessThanOrEqual(containerRect.bottom + tolerance)
}
