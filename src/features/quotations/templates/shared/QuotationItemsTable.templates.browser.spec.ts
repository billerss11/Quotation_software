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
import { createInitialQuotation } from '../../utils/quotationDraft'
import { getQuotationDocumentOrientation } from '../../utils/quotationDocumentPage'
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
    'aligns single-tax column headings with their values in %s',
    async (templateId) => {
      for (const locale of ['en-US', 'zh-CN'] as const) {
        const quotation = createInitialQuotation([], locale)
        const item = quotation.majorItems.find(isQuotationItem)!
        Object.assign(item, { name: 'Equipment', quantity: 3, quantityUnit: 'EA', unitCost: 1234.56 })
        const { wrapper } = await mountFixture({ quotation }, templateId)

        try {
          for (const [column, alignment] of [
            ['col-qty', 'center'],
            ['col-unit', 'center'],
            ['col-money', 'right'],
          ] as const) {
            const headings = wrapper.findAll<HTMLElement>(`thead th.${column}`)
            const values = wrapper.findAll<HTMLElement>(`tbody td.${column}`)
            expect(headings.length).toBeGreaterThan(0)
            expect(values).toHaveLength(headings.length)
            headings.forEach((heading, index) => {
              const value = values[index]!
              expect(getComputedStyle(heading.element).textAlign).toBe(alignment)
              expect(getComputedStyle(value.element).textAlign).toBe(alignment)
              const textBounds = [heading.element, value.element].map((element) => {
                const range = document.createRange()
                range.selectNodeContents(element)
                return range.getBoundingClientRect()
              })
              const positions = textBounds.map((bounds) =>
                alignment === 'center' ? (bounds.left + bounds.right) / 2 : bounds.right,
              )
              expect(Math.abs(positions[0]! - positions[1]!)).toBeLessThanOrEqual(0.5)
            })
          }
          expect(getComputedStyle(wrapper.get('thead .col-description').element).textAlign).toBe('left')
          expect(getComputedStyle(wrapper.get('tbody .col-description').element).textAlign).toBe('left')
        } finally {
          wrapper.unmount()
        }
      }
    },
  )

  it.each(QUOTATION_TEMPLATE_IDS)(
    'leaves flat quotation item rows white without a hidden-item notice in %s',
    async (templateId) => {
      const fixture = structuredClone(scenarios.s23)
      fixture.quotation.majorItems.filter(isQuotationItem).forEach((item) => {
        item.children = []
      })

      for (const itemDetailLevel of [1, 3] as const) {
        fixture.quotation.outputSettings = { itemDetailLevel }
        const { wrapper } = await mountFixture(fixture, templateId)
        try {
          expect(wrapper.find('caption').exists()).toBe(false)
          const cells = wrapper.findAll('.row-level-1 td')
          expect(cells.length).toBeGreaterThan(0)
          cells.forEach((cell) => {
            expect(getComputedStyle(cell.element).backgroundColor).toBe('rgb(255, 255, 255)')
          })
        } finally {
          wrapper.unmount()
        }
      }
    },
  )

  it.each(QUOTATION_TEMPLATE_IDS)(
    'shades root rows only when child rows are displayed in %s',
    async (templateId) => {
      const fixture = structuredClone(scenarios.s23)
      for (const itemDetailLevel of [1, 2, 3] as const) {
        fixture.quotation.outputSettings = { itemDetailLevel }
        const { wrapper } = await mountFixture(fixture, templateId)
        try {
          expect(wrapper.find('caption').exists()).toBe(false)
          const rootCell = wrapper.get('.row-level-1 td').element
          const rootBackground = getComputedStyle(rootCell).backgroundColor
          if (itemDetailLevel === 1) {
            expect(rootBackground).toBe('rgb(255, 255, 255)')
          } else {
            expect(rootBackground).not.toBe('rgb(255, 255, 255)')
            expect(rootBackground).not.toBe('rgba(0, 0, 0, 0)')
            expect(getComputedStyle(wrapper.get('.row-level-2 td').element).backgroundColor)
              .toBe('rgb(255, 255, 255)')
          }
        } finally {
          wrapper.unmount()
        }
      }
    },
  )

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

describe('quotation header text wrapping', () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  it.each(QUOTATION_TEMPLATE_IDS)('aligns wrapped header lines on the left in %s', async (templateId) => {
    for (const documentLocale of ['en-US', 'zh-CN'] as const) {
      for (const scenario of [scenarios.s23, scenarios.s22]) {
        const fixture = structuredClone(scenario)
        const projectName = documentLocale === 'en-US'
          ? 'Tangguh UCC Project - Onshore EPCI | TEG Dehydration Package '.repeat(3) + '\nPhase 2'
          : '唐古液化天然气项目陆上工程总承包与三甘醇脱水装置配套设备'.repeat(3) + '\n第二阶段'
        Object.assign(fixture.quotation.header, {
          documentLocale,
          projectName,
          quotationNumber: 'QUOTATION-REFERENCE-FOR-OFFSHORE-PROJECT\nREV-02',
          validityPeriod: '90 days from the quotation date\nSubject to confirmation',
          customerCompany: 'Customer Engineering and Procurement Company\nRegional office',
          contactPerson: 'Procurement department\nProject team',
          contactDetails: 'procurement@example.com\n+86 123 4567 8901',
        })
        Object.assign(fixture.quotation.companyProfileSnapshot, {
          companyName: 'Engineering and Energy Services Company\nRegional office',
          email: 'sales@example.com\nprojects@example.com',
          phone: '+86 123 4567 8901\n+852 1234 5678',
        })
        const { wrapper } = await mountFixture(fixture, templateId)

        try {
          const orientation = getQuotationDocumentOrientation(fixture.quotation)
          wrapper.get<HTMLElement>('.quotation-document').element.dataset.documentOrientation = orientation
          const identityValues = wrapper.findAll<HTMLElement>('.quotation-identity-value')
          const project = identityValues.find((value) => value.text() === projectName)
          expect(project, 'the complete project name is rendered').toBeDefined()
          const misaligned = identityValues.flatMap((value) => {
            const range = document.createRange()
            range.selectNodeContents(value.element)
            const lineStarts = new Map<number, number>()
            for (const rect of range.getClientRects()) {
              if (rect.width > 0) {
                lineStarts.set(rect.top, Math.min(lineStarts.get(rect.top) ?? Infinity, rect.left))
              }
            }
            const starts = [...lineStarts.values()]
            if (value === project) {
              expect(starts.length).toBeGreaterThan(2)
            }
            return starts.some((left) => Math.abs(left - starts[0]!) > 1)
              ? [value.text()]
              : []
          })
          expect(misaligned, `${documentLocale}, ${orientation}`)
            .toEqual([])
        } finally {
          wrapper.unmount()
        }
      }
    }
  })
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
