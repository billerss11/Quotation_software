import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAppI18n } from '@/shared/i18n/createAppI18n'
import { createInitialQuotation } from '../utils/quotationDraft'
import { createQuotationItem, isQuotationItem } from '../utils/quotationItems'
import { calculateMajorItemSummary, calculateQuotationTotals } from '../utils/quotationCalculations'
import type { QuotationDraft } from '../types'
import QuotationPaginatedDocument from './QuotationPaginatedDocument.vue'
import { QUOTATION_TEMPLATE_IDS } from '../templates/templateIds'
import shortSummarySource from '../templates/shared/__fixtures__/s11.json?raw'
import longMoneySource from '../templates/shared/__fixtures__/s06.json?raw'
import '@/assets/main.css'

const mounted: Array<ReturnType<typeof mount>> = []
afterEach(() => { mounted.forEach(wrapper => wrapper.unmount()); mounted.length = 0 })

async function render(quotation: QuotationDraft) {
  const config = quotation.totalsConfig
  const props = {
    quotation,
    summaries: quotation.majorItems.filter(isQuotationItem).map(item => calculateMajorItemSummary(item, config, quotation.exchangeRates)),
    totals: calculateQuotationTotals(quotation.majorItems, config, quotation.exchangeRates),
    globalMarkupRate: config.globalMarkupRate,
    exchangeRates: quotation.exchangeRates,
    companyProfile: quotation.companyProfileSnapshot,
  }
  const wrapper = mount(QuotationPaginatedDocument, { attachTo: document.body, props, global: { plugins: [createAppI18n('en-US')] } })
  mounted.push(wrapper)
  await vi.waitFor(() => {
    expect(wrapper.emitted('error')).toBeUndefined()
    expect(wrapper.attributes('data-pagination-ready')).toBe('true')
  }, { timeout: 10000 })
  return wrapper
}

function quote() {
  const quotation = createInitialQuotation([], 'en-US')
  quotation.header.quotationNumber = 'PAGINATION-REGRESSION'
  quotation.header.customerCompany = 'Test customer'
  quotation.header.projectName = 'Pagination coverage'
  quotation.header.notes = 'Notes remain part of the quotation.'
  quotation.companyProfileSnapshot = { companyName: 'Test supplier', email: '', phone: '' }
  quotation.majorItems = []
  return quotation
}
function assertContained(wrapper: ReturnType<typeof mount>) {
  const pages = wrapper.findAll<HTMLElement>('.quotation-pages .quotation-page')
  for (const [index, page] of pages.entries()) {
    const footer = page.get('.quotation-page-footer').element.getBoundingClientRect()
    const content = page.get('.quotation-document').element.getBoundingClientRect()
    expect(content.bottom).toBeLessThanOrEqual(footer.top - 4)
    expect(page.get('.quotation-page-number').text()).toBe(`Page ${index + 1} of ${pages.length}`)
  }
  return pages
}

describe('actual quotation page layout', () => {
  it.each(QUOTATION_TEMPLATE_IDS)('keeps the two-group audit summary complete on one page in %s', async template => {
    const quotation = JSON.parse(shortSummarySource).quotation as QuotationDraft
    quotation.templateId = template
    const wrapper = await render(quotation)
    expect(assertContained(wrapper)).toHaveLength(1)
    expect(wrapper.get('.quotation-pages').findAll('.row-group')).toHaveLength(2)
    expect(wrapper.get('.quotation-pages').text()).toContain('50,918.72')
  })

  it.each(['executive-summary', 'luminous'] as const)('keeps large %s header amounts inside their own summary panels', async template => {
    const quotation = JSON.parse(longMoneySource).quotation as QuotationDraft
    quotation.templateId = template
    const wrapper = await render(quotation)
    assertContained(wrapper)
    const panels = wrapper.findAll<HTMLElement>('.quotation-pages .total-primary, .quotation-pages .amount-primary, .quotation-pages .snapshot-item')
    expect(panels.length).toBeGreaterThan(2)
    for (const panel of panels) {
      const bounds = panel.element.getBoundingClientRect()
      const walker = document.createTreeWalker(panel.element, NodeFilter.SHOW_TEXT)
      let node: Node | null
      while ((node = walker.nextNode())) {
        if (!node.textContent?.trim()) continue
        const range = document.createRange()
        range.selectNodeContents(node)
        for (const rect of range.getClientRects()) {
          expect(rect.left).toBeGreaterThanOrEqual(bounds.left - 1)
          expect(rect.right).toBeLessThanOrEqual(bounds.right + 1)
        }
      }
    }
  })

  it('keeps a short quotation on one page and exposes the real paper dimensions', async () => {
    const quotation = quote()
    quotation.majorItems = [createQuotationItem('USD', { name: 'Pump', quantity: 2, unitCost: 100 })]
    const wrapper = await render(quotation)
    expect(assertContained(wrapper)).toHaveLength(1)
    expect(wrapper.emitted('ready')?.[0]?.[0]).toMatchObject({ pageCount: 1, pageWidth: 210 * 96 / 25.4 })
  })

  it('preserves every long description character, prints amounts once, and identifies continuation pages', async () => {
    const quotation = quote()
    const description = Array.from({ length: 180 }, (_, i) => `Paragraph-${i} Complete description with explicit line breaks.\n`).join('')
    quotation.majorItems = [createQuotationItem('USD', { name: 'Long pump specification', quantity: 1, pricingMethod: 'manual_price', manualUnitPrice: 432.1, description })]
    const wrapper = await render(quotation)
    const pages = assertContained(wrapper)
    expect(pages.length).toBeGreaterThan(2)
    const visible = wrapper.get('.quotation-pages')
    expect(visible.findAll('.item-detail').map(node => node.element.textContent).join('')).toBe(description)
    const moneyCells = visible.findAll('tbody .col-money').filter(cell => cell.text())
    expect(moneyCells).toHaveLength(2)
    expect(pages[1].get('.quotation-continuation').text()).toContain('Long pump specification')
    expect(pages[0].find('tbody tr').exists()).toBe(true)
  })

  it('preserves oversized section headings and long unit text instead of dropping or rejecting them', async () => {
    const quotation = quote()
    const title = 'Section-detail '.repeat(1200)
    const unit = 'long-unit '.repeat(400)
    quotation.majorItems = [
      { id: 'section', kind: 'section_header', title },
      createQuotationItem('USD', { name: 'Contained unit', quantityUnit: unit, quantity: 1, unitCost: 20 }),
    ]
    const wrapper = await render(quotation)
    assertContained(wrapper)
    const visible = wrapper.get('.quotation-pages')
    expect(visible.findAll('.section-band').map(node => node.element.textContent).join('')).toBe(title)
    expect(visible.findAll('td.col-unit').map(node => node.element.textContent).join('').trimEnd()).toBe(unit.trimEnd())
  })

  it('flows Signal notes independently and keeps normal total labels with their amounts', async () => {
    const quotation = quote()
    quotation.templateId = 'signal'
    quotation.header.terms = 'A complete commercial term with no omitted characters.\n'.repeat(300)
    quotation.majorItems = [createQuotationItem('USD', { name: 'Item', quantity: 1, unitCost: 100 })]
    const wrapper = await render(quotation)
    assertContained(wrapper)
    const visible = wrapper.get('.quotation-pages')
    expect(visible.findAll('.terms-text').map(node => node.element.textContent).join('')).toBe(quotation.header.terms)
    expect(visible.findAll('.totals-board .totals-row').every(row => row.find('dt').text() && row.find('dd').text())).toBe(true)
  })

  it('keeps group headings with a real first child and identifies later child continuations', async () => {
    const quotation = quote()
    quotation.majorItems = Array.from({ length: 12 }, (_, index) => createQuotationItem('USD', {
      name: `Group ${index + 1}`,
      children: [
        createQuotationItem('USD', { name: 'First child', description: 'A moderately long specification with natural word boundaries. '.repeat(5), unitCost: 10 }),
        createQuotationItem('USD', { name: 'Second child', description: 'Further details. '.repeat(8), unitCost: 20 }),
      ],
    }))
    const wrapper = await render(quotation)
    const pages = assertContained(wrapper)
    expect(pages.length).toBeGreaterThan(1)
    for (const page of pages) {
      const rows = page.findAll('tbody tr')
      if (!rows.length) continue
      expect(rows.at(-1)!.attributes('data-is-group')).toBe('false')
      if (rows[0].attributes('data-parent-number')) {
        expect(page.get('.quotation-continuation').text()).toContain('Group')
      }
    }
  })
})
