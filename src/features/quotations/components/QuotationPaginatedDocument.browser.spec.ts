import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAppI18n } from '@/shared/i18n/createAppI18n'
import type { SupportedLocale } from '@/shared/i18n/locale'
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

function summaryQuote() {
  const quotation = quote()
  quotation.totalsConfig = {
    globalMarkupRate: 25,
    taxMode: 'single',
    taxClasses: [{ id: 'materials', label: 'Materials', rate: 10 }],
    defaultTaxClassId: 'materials',
    extraCharges: [{ id: 'installation', label: 'Installation', amount: 70 }],
  }
  quotation.majorItems = [
    { id: 'equipment', kind: 'section_header', title: 'Equipment' },
    createQuotationItem('USD', { name: 'Pump', quantity: 2, unitCost: 100 }),
    { id: 'piping', kind: 'section_header', title: 'Piping' },
    createQuotationItem('USD', { name: 'Pipe', quantity: 3, unitCost: 10 }),
  ]
  quotation.outputSettings = {
    itemDetailLevel: 3,
    subtotalLabel: '  Materials selling total  ',
    showInformationalTotals: true,
    informationalTotals: [
      { id: 'equipment-total', label: 'Equipment selling total', sectionIds: ['equipment'], visible: true },
      { id: 'piping-total', label: '', sectionIds: ['piping'], visible: true },
      { id: 'materials-total', label: 'All materials', sectionIds: ['equipment', 'piping'], visible: true },
      { id: 'hidden-total', label: 'Hidden breakdown', sectionIds: ['removed'], visible: false },
    ],
  }
  return quotation
}

function assertContained(wrapper: ReturnType<typeof mount>, locale: SupportedLocale = 'en-US') {
  const pages = wrapper.findAll<HTMLElement>('.quotation-pages .quotation-page')
  const documentT = createAppI18n(locale).global.t
  for (const [index, page] of pages.entries()) {
    const footer = page.get('.quotation-page-footer').element.getBoundingClientRect()
    const content = page.get('.quotation-document').element.getBoundingClientRect()
    expect(content.bottom).toBeLessThanOrEqual(footer.top - 4)
    expect(page.get('.quotation-page-number').text()).toBe(documentT('quotations.pagination.page', { page: index + 1, total: pages.length }))
  }
  return pages
}

describe('actual quotation page layout', () => {
  it.each(QUOTATION_TEMPLATE_IDS)('starts the first %s page at the template edge without an extra top strip', async template => {
    const quotation = quote()
    quotation.templateId = template
    quotation.majorItems = [createQuotationItem('USD', { name: 'Equipment', quantity: 3, unitCost: 100 })]
    const wrapper = await render(quotation)
    const [page] = assertContained(wrapper)
    const paperTop = page.element.getBoundingClientRect().top
    const contentTop = page.get('.quotation-page-document').element.getBoundingClientRect().top
    expect(Math.abs(contentTop - paperTop)).toBeLessThanOrEqual(0.5)
  })

  it.each(QUOTATION_TEMPLATE_IDS)('prints editable multiline informational notes as plain text in %s', async template => {
    const quotation = summaryQuote()
    quotation.templateId = template
    const note = 'Selected equipment only.\nPrices exclude optional services.\n<b>Customer wording</b>'
    quotation.outputSettings!.informationalTotalsNote = note
    quotation.outputSettings!.subtotalLabel = 'Revised materials subtotal'
    const wrapper = await render(quotation)
    assertContained(wrapper)
    const visible = wrapper.get('.quotation-pages')
    const displayedNote = visible.get<HTMLElement>('.informational-note')
    expect(displayedNote.element.textContent).toBe(note)
    expect(getComputedStyle(displayedNote.element).whiteSpace).toBe('pre-wrap')
    expect(displayedNote.find('b').exists()).toBe(false)
    expect(quotation.outputSettings!.informationalTotalsNote).toBe(note)
    expect(visible.get('.quotation-summary .quotation-subtotal-label').text()).toBe('Revised materials subtotal')
    expect(visible.findAll('.informational-row')).toHaveLength(3)
    expect(visible.get('.grand-total dd, .grand-total-row dd').text()).toBe('$386.25')
  })

  it.each(QUOTATION_TEMPLATE_IDS)('hides explicitly blank informational notes and keeps the rows in %s', async template => {
    for (const note of ['', '  \n\t ']) {
      const quotation = summaryQuote()
      quotation.templateId = template
      quotation.outputSettings!.informationalTotalsNote = note
      const wrapper = await render(quotation)
      assertContained(wrapper)
      const visible = wrapper.get('.quotation-pages')
      expect(visible.find('.informational-note').exists()).toBe(false)
      expect(visible.get('.informational-title').text()).toBe('Informational breakdown')
      expect(visible.findAll('.informational-amount').map(amount => amount.text())).toEqual(['$250.00', '$37.50', '$287.50'])
    }
  })

  it('flows a page-tall multiline informational note and wraps long words without dropping content', async () => {
    const quotation = summaryQuote()
    const note = [
      'EquipmentIdentifier'.repeat(30),
      ...Array.from({ length: 180 }, (_, index) => `Note ${index + 1}: Complete specification and customer wording.`),
    ].join('\n')
    quotation.outputSettings!.informationalTotalsNote = note
    const wrapper = await render(quotation)
    expect(assertContained(wrapper).length).toBeGreaterThan(2)
    const visible = wrapper.get('.quotation-pages')
    const notes = visible.findAll<HTMLElement>('.informational-note')
    expect(notes.map(entry => entry.element.textContent).join('')).toBe(note)
    for (const entry of notes) {
      const bounds = entry.element.getBoundingClientRect()
      const range = document.createRange()
      range.selectNodeContents(entry.element)
      for (const rect of range.getClientRects()) {
        expect(rect.left).toBeGreaterThanOrEqual(bounds.left - 1)
        expect(rect.right).toBeLessThanOrEqual(bounds.right + 1)
      }
    }
    expect(visible.findAll('.informational-amount').map(amount => amount.text())).toEqual(['$250.00', '$37.50', '$287.50'])
    expect(visible.get('.grand-total dd').text()).toBe('$386.25')
  })

  it.each(QUOTATION_TEMPLATE_IDS)('prints selected item totals without section headers in %s', async template => {
    const quotation = summaryQuote()
    quotation.templateId = template
    const items = quotation.majorItems.filter(isQuotationItem)
    quotation.majorItems = items
    quotation.outputSettings!.informationalTotals = [
      { id: 'selected-pump', label: 'Selected equipment', source: 'items', itemIds: [items[0]!.id], sectionIds: ['removed-inactive-section'], visible: true },
      { id: 'selected-pipe', label: '', source: 'items', itemIds: [items[1]!.id], sectionIds: [], visible: true },
      { id: 'hidden-item-total', label: 'Hidden item selection', source: 'items', itemIds: ['removed-item'], sectionIds: [], visible: false },
    ]
    const wrapper = await render(quotation)
    assertContained(wrapper)
    const visible = wrapper.get('.quotation-pages')
    expect(visible.findAll('.row-section')).toHaveLength(0)
    expect(visible.findAll('.informational-label').map(label => label.text())).toEqual(['Selected equipment', 'Pipe'])
    expect(visible.findAll('.informational-amount').map(amount => amount.text())).toEqual(['$250.00', '$37.50'])
    expect(visible.text()).not.toContain('Hidden item selection')
    expect(visible.get('.quotation-summary .quotation-subtotal-label').text()).toBe('Materials selling total')
    expect(visible.get('.grand-total dd, .grand-total-row dd').text()).toBe('$386.25')
  })

  it('includes hidden descendants with ancestor quantities and counts selected groups once', async () => {
    const quotation = summaryQuote()
    const detail = createQuotationItem('USD', { name: 'Hidden fitting', quantity: 4, unitCost: 10 })
    const subgroup = createQuotationItem('USD', { name: 'Hidden pipe assembly', quantity: 3, children: [detail] })
    const sibling = createQuotationItem('USD', { name: 'Hidden valve', quantity: 1, unitCost: 20 })
    const group = createQuotationItem('USD', { name: 'Complete equipment group', quantity: 2, children: [subgroup, sibling] })
    quotation.majorItems = [group, createQuotationItem('USD', { name: 'Separate item', quantity: 1, unitCost: 40 })]
    quotation.outputSettings!.itemDetailLevel = 1
    quotation.outputSettings!.informationalTotals = [
      { id: 'detail-total', label: 'Fittings selling total', source: 'items', itemIds: [detail.id], sectionIds: [], visible: true },
      { id: 'subgroup-total', label: 'Assembly selling total', source: 'items', itemIds: [subgroup.id, detail.id], sectionIds: [], visible: true },
      { id: 'group-total', label: 'Equipment selling total', source: 'items', itemIds: [group.id, subgroup.id, detail.id, sibling.id], sectionIds: [], visible: true },
    ]
    const wrapper = await render(quotation)
    assertContained(wrapper)
    const visible = wrapper.get('.quotation-pages')
    expect(visible.findAll('tbody tr')).toHaveLength(2)
    expect(visible.text()).not.toContain('Hidden fitting')
    expect(visible.text()).not.toContain('Hidden pipe assembly')
    expect(visible.text()).not.toContain('Hidden valve')
    expect(visible.findAll('.informational-label').map(label => label.text())).toEqual([
      'Fittings selling total', 'Assembly selling total', 'Equipment selling total',
    ])
    expect(visible.findAll('.informational-amount').map(amount => amount.text())).toEqual(['$300.00', '$300.00', '$350.00'])
    expect(visible.get('.grand-total dd').text()).toBe('$510.00')
  })

  it.each(QUOTATION_TEMPLATE_IDS)('prints custom subtotal labels and informational selling totals in %s', async template => {
    const quotation = summaryQuote()
    quotation.templateId = template
    const wrapper = await render(quotation)
    assertContained(wrapper)
    const visible = wrapper.get('.quotation-pages')
    const subtotal = visible.get('.quotation-summary .quotation-subtotal-label')
    expect(subtotal.text()).toBe('Materials selling total')
    expect(subtotal.element.parentElement?.querySelector('dd')?.textContent?.trim()).toBe('$287.50')
    expect(subtotal.element.parentElement?.previousElementSibling?.classList.contains('informational-row')).toBe(true)
    expect(visible.findAll('.quotation-subtotal-label').every(label => label.text() === 'Materials selling total')).toBe(true)
    expect(visible.findAll('dt').some(label => label.text() === 'Subtotal')).toBe(false)
    expect(visible.findAll('.informational-label').map(label => label.text())).toEqual([
      'Equipment selling total', 'Piping', 'All materials',
    ])
    expect(visible.findAll('.informational-amount').map(amount => amount.text())).toEqual([
      '$250.00', '$37.50', '$287.50',
    ])
    expect(visible.get('.informational-note').text()).toBe('Already included in Materials selling total.')
    expect(visible.text()).not.toContain('Hidden breakdown')
    expect(visible.get('.grand-total dd, .grand-total-row dd').text()).toBe('$386.25')
  })

  it.each(QUOTATION_TEMPLATE_IDS)('contains long summary labels and their amounts inside the page in %s', async template => {
    const quotation = summaryQuote()
    quotation.templateId = template
    const subtotalLabel = 'MaterialsSellingTotal'.repeat(12)
    const rowLabel = 'EquipmentSellingTotal'.repeat(15)
    quotation.outputSettings!.subtotalLabel = subtotalLabel
    quotation.outputSettings!.informationalTotals![0]!.label = rowLabel
    const wrapper = await render(quotation)
    assertContained(wrapper)
    const visible = wrapper.get('.quotation-pages')
    expect(visible.get('.quotation-summary .quotation-subtotal-label').text()).toBe(subtotalLabel)
    expect(visible.get('.informational-label').text()).toBe(rowLabel)
    expect(visible.get('.informational-amount').text()).toBe('$250.00')
    for (const entry of visible.findAll<HTMLElement>('.quotation-subtotal-label, .informational-row, .informational-note')) {
      const bounds = entry.element.parentElement!.getBoundingClientRect()
      const walker = document.createTreeWalker(entry.element, NodeFilter.SHOW_TEXT)
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

  it('uses the document locale for blank subtotal labels and unavailable informational amounts', async () => {
    const quotation = summaryQuote()
    quotation.header.documentLocale = 'zh-CN'
    quotation.outputSettings!.subtotalLabel = '   '
    quotation.outputSettings!.informationalTotals = [
      { id: 'removed-total', label: 'Removed section', sectionIds: ['removed'], visible: true },
      { id: 'unselected-total', label: 'No sections', sectionIds: [], visible: true },
    ]
    const wrapper = await render(quotation)
    assertContained(wrapper, 'zh-CN')
    const visible = wrapper.get('.quotation-pages')
    const documentT = createAppI18n('zh-CN').global.t
    const subtotalLabel = documentT('quotations.document.subtotal')
    expect(visible.get('.quotation-summary .quotation-subtotal-label').text()).toBe(subtotalLabel)
    expect(visible.get('.informational-title').text()).toBe(documentT('quotations.summaryDisplay.documentTitle'))
    expect(visible.get('.informational-note').text()).toBe(documentT('quotations.summaryDisplay.documentNote', { subtotalLabel }))
    expect(visible.findAll('.informational-amount').map(amount => amount.text())).toEqual([
      documentT('common.emptyValue'), documentT('common.emptyValue'),
    ])
  })

  it('flows seventy informational rows and a page-tall label without dropping amounts', async () => {
    const quotation = summaryQuote()
    const longLabel = 'Complete equipment category description. '.repeat(500)
    quotation.outputSettings!.informationalTotals = Array.from({ length: 70 }, (_, index) => ({
      id: `category-${index + 1}`,
      label: index === 0 ? longLabel : `Materials category ${index + 1}`,
      sectionIds: ['equipment'],
      visible: true,
    }))
    const wrapper = await render(quotation)
    const pages = assertContained(wrapper)
    expect(pages.length).toBeGreaterThan(2)
    const visible = wrapper.get('.quotation-pages')
    expect(visible.findAll('[data-summary-id="category-1"] .informational-label').map(label => label.element.textContent).join('')).toBe(longLabel.trim())
    expect(visible.findAll('.informational-amount').map(amount => amount.text()).filter(Boolean)).toEqual(Array(70).fill('$250.00'))
    for (let index = 1; index < 70; index += 1) {
      const row = visible.get(`[data-summary-id="category-${index + 1}"]`)
      expect(row.get('.informational-label').text()).toBe(`Materials category ${index + 1}`)
      expect(row.get('.informational-amount').text()).toBe('$250.00')
    }
    expect(visible.get('.grand-total dd').text()).toBe('$386.25')
  })

  it('omits informational totals when the quotation display toggle is off', async () => {
    const quotation = summaryQuote()
    quotation.outputSettings!.showInformationalTotals = false
    const wrapper = await render(quotation)
    assertContained(wrapper)
    const visible = wrapper.get('.quotation-pages')
    expect(visible.find('.quotation-informational-totals').exists()).toBe(false)
    expect(visible.get('.quotation-summary .quotation-subtotal-label').text()).toBe('Materials selling total')
  })

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
      if (page !== pages[0]) {
        const paperTop = page.element.getBoundingClientRect().top
        const contentTop = page.get('.quotation-page-document').element.getBoundingClientRect().top
        expect(contentTop - paperTop).toBeGreaterThanOrEqual(24)
      }
      const rows = page.findAll('tbody tr')
      if (!rows.length) continue
      expect(rows.at(-1)!.attributes('data-is-group')).toBe('false')
      if (rows[0].attributes('data-parent-number')) {
        expect(page.get('.quotation-continuation').text()).toContain('Group')
      }
    }
  })
})
