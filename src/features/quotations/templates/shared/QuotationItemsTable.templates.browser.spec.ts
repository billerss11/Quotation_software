import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'

import '@/assets/main.css'
import { createAppI18n } from '@/shared/i18n/createAppI18n'

import QuotationPreview from '../../components/QuotationPreview.vue'
import type { QuotationDraft, QuotationItem } from '../../types'
import {
  calculateMajorItemSummary,
  calculateQuotationTotals,
} from '../../utils/quotationCalculations'
import { isQuotationItem } from '../../utils/quotationItems'
import { QUOTATION_TEMPLATE_IDS, type QuotationTemplateId } from '../templateIds'
import s06Source from './__fixtures__/s06.json?raw'
import s09Source from './__fixtures__/s09.json?raw'
import s21Source from './__fixtures__/s21.json?raw'
import s22Source from './__fixtures__/s22.json?raw'
import s23Source from './__fixtures__/s23.json?raw'

interface AuditFixture {
  quotation: QuotationDraft
}

const scenarios = {
  s06: parseFixture(s06Source),
  s09: parseFixture(s09Source),
  s21: parseFixture(s21Source),
  s22: parseFixture(s22Source),
  s23: parseFixture(s23Source),
}

describe('QuotationItemsTable in all quotation templates', () => {
  afterEach(() => {
    document.body.replaceChildren()
    document.body.removeAttribute('style')
  })

  it.each(QUOTATION_TEMPLATE_IDS)(
    'keeps every selected S06 price field readable in the %s template',
    async (templateId) => {
      const { wrapper, quotation } = await mountFixture(scenarios.s06, templateId)

      try {
        const table = wrapper.get<HTMLElement>('.quotation-table')
        const expectedColumnIds = quotation.totalsConfig.mixedTaxColumns ?? []

        expect(table.classes()).toContain('table-price-breakdown')
        expectElementInside(table.element, wrapper.get('.quotation-document').element)

        quotation.majorItems.filter(isQuotationItem).forEach((item) => {
          const row = getItemRow(wrapper, item)
          const entries = row.findAll<HTMLElement>('.price-breakdown-entry')

          expect(entries.map((entry) => entry.attributes('data-column-id'))).toEqual(expectedColumnIds)
          expectExactItemText(row, item)
          expectReadableAndContained(row.get<HTMLElement>('.col-unit-long'), row.get('.col-unit'))

          entries.forEach((entry) => {
            expectReadableAndContained(entry.get<HTMLElement>('.price-breakdown-label'), entry)
            const value = entry.find<HTMLElement>('.money-value, .tax-value')
            if (value.exists()) expectReadableAndContained(value, entry)
          })
        })
      } finally {
        wrapper.unmount()
      }
    },
  )

  it.each(QUOTATION_TEMPLATE_IDS)(
    'preserves every S09 unbroken item, description, and unit character in the %s template',
    async (templateId) => {
      const { wrapper, quotation } = await mountFixture(scenarios.s09, templateId)

      try {
        quotation.majorItems.filter(isQuotationItem).forEach((item) => {
          const row = getItemRow(wrapper, item)
          expectExactItemText(row, item)
          expectReadableAndContained(row.get<HTMLElement>('.item-title'), row.get('.col-description'))
          expectReadableAndContained(row.get<HTMLElement>('.item-detail'), row.get('.col-description'))
          expectReadableAndContained(row.get<HTMLElement>('.col-unit'), row.get('.col-unit'))
        })
      } finally {
        wrapper.unmount()
      }
    },
  )

  it.each(QUOTATION_TEMPLATE_IDS)(
    'preserves the targeted S21 SKU and URL in the %s template',
    async (templateId) => {
      const { wrapper, quotation } = await mountFixture(scenarios.s21, templateId)

      try {
        const item = quotation.majorItems.find(isQuotationItem)
        if (!item) throw new Error('S21 fixture must contain a quotation item')
        const row = getItemRow(wrapper, item)

        expectExactItemText(row, item)
        expectReadableAndContained(row.get<HTMLElement>('.item-title'), row.get('.col-description'))
        expectReadableAndContained(row.get<HTMLElement>('.item-detail'), row.get('.col-description'))
      } finally {
        wrapper.unmount()
      }
    },
  )

  it.each(QUOTATION_TEMPLATE_IDS)(
    'keeps S22 descriptions and all seven ordinary columns readable in the %s template',
    async (templateId) => {
      const { wrapper, quotation } = await mountFixture(scenarios.s22, templateId)

      try {
        const table = wrapper.get<HTMLElement>('.quotation-table')
        expect(table.classes()).not.toContain('table-price-breakdown')
        expect(wrapper.findAll('thead th')).toHaveLength(11)
        expectElementInside(table.element, wrapper.get('.quotation-document').element)
        expectDescriptionGeometry(wrapper, quotation)
        expectReadableColumnHeadings(wrapper)
        expectRenderedValuesContained(wrapper)
      } finally {
        wrapper.unmount()
      }
    },
  )

  it.each(QUOTATION_TEMPLATE_IDS)(
    'keeps S23 portrait descriptions and selected columns readable in the %s template',
    async (templateId) => {
      const { wrapper, quotation } = await mountFixture(scenarios.s23, templateId)

      try {
        const table = wrapper.get<HTMLElement>('.quotation-table')
        expect(table.classes()).not.toContain('table-price-breakdown')
        expect(wrapper.findAll('thead th')).toHaveLength(6)
        expectElementInside(table.element, wrapper.get('.quotation-document').element)
        expectDescriptionGeometry(wrapper, quotation)
        expectReadableColumnHeadings(wrapper)
        expectRenderedValuesContained(wrapper)
      } finally {
        wrapper.unmount()
      }
    },
  )
})

function parseFixture(source: string): AuditFixture {
  return JSON.parse(source) as AuditFixture
}

async function mountFixture(fixture: AuditFixture, templateId: QuotationTemplateId) {
  const quotation = structuredClone(fixture.quotation)
  quotation.templateId = templateId
  const quotationItems = quotation.majorItems.filter(isQuotationItem)
  const summaries = quotationItems.map((item) =>
    calculateMajorItemSummary(item, quotation.totalsConfig, quotation.exchangeRates),
  )

  const wrapper = mount(QuotationPreview, {
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
      companyProfile: quotation.companyProfileSnapshot,
    },
    global: { plugins: [createAppI18n(quotation.header.documentLocale)] },
  })

  await nextTick()
  await document.fonts.ready
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  return { wrapper, quotation }
}

function getItemRow(wrapper: VueWrapper, item: QuotationItem) {
  return wrapper.get<HTMLElement>(`tr[data-row-key^="${item.id}-"]`)
}

function expectExactItemText(row: ReturnType<typeof getItemRow>, item: QuotationItem) {
  expect(row.get('.item-title').element.textContent).toBe(item.name)
  expect(row.get('.item-detail').element.textContent).toBe(item.description)
  expect(row.get('.col-unit').element.textContent).toBe(item.quantityUnit)
}

function expectDescriptionGeometry(wrapper: VueWrapper, quotation: QuotationDraft) {
  getAllItems(quotation.majorItems.filter(isQuotationItem)).forEach((item) => {
    const row = getItemRow(wrapper, item)
    expectExactItemText(row, item)
    expectReadableAndContained(row.get<HTMLElement>('.item-title'), row.get('.col-description'))
    expectReadableAndContained(row.get<HTMLElement>('.item-detail'), row.get('.col-description'))
  })
}

function expectReadableColumnHeadings(wrapper: VueWrapper) {
  wrapper.findAll<HTMLElement>('thead th').forEach((heading) => {
    expectReadableAndContained(heading, heading)
  })
}

function expectRenderedValuesContained(wrapper: VueWrapper) {
  wrapper.findAll<HTMLElement>('tbody .money-value, tbody .tax-value').forEach((value) => {
    const cell = value.element.closest('td')
    if (!cell) throw new Error('Expected a rendered document value to belong to a table cell')
    expectReadableAndContained(value, { element: cell })
  })
}

function getAllItems(items: QuotationItem[]): QuotationItem[] {
  return items.flatMap((item) => [item, ...getAllItems(item.children)])
}

function expectReadableAndContained(
  element: { element: Element },
  container: { element: Element },
) {
  expect(Number.parseFloat(getComputedStyle(element.element).fontSize)).toBeGreaterThanOrEqual(10.67)
  expectTextInside(element.element, container.element)
}

function expectElementInside(element: Element, container: Element) {
  const elementRect = element.getBoundingClientRect()
  const containerRect = container.getBoundingClientRect()
  const tolerance = 1

  expect(elementRect.left).toBeGreaterThanOrEqual(containerRect.left - tolerance)
  expect(elementRect.right).toBeLessThanOrEqual(containerRect.right + tolerance)
}

function expectTextInside(textElement: Element, container: Element) {
  const range = document.createRange()
  range.selectNodeContents(textElement)
  const containerRect = container.getBoundingClientRect()
  const tolerance = 1

  Array.from(range.getClientRects()).forEach((rect) => {
    expect(rect.left).toBeGreaterThanOrEqual(containerRect.left - tolerance)
    expect(rect.right).toBeLessThanOrEqual(containerRect.right + tolerance)
    expect(rect.top).toBeGreaterThanOrEqual(containerRect.top - tolerance)
    expect(rect.bottom).toBeLessThanOrEqual(containerRect.bottom + tolerance)
  })
}
