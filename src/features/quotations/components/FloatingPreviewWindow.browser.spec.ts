import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick, reactive } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import '@/assets/main.css'
import { createAppI18n } from '@/shared/i18n/createAppI18n'

import type { MixedTaxDocumentColumn, QuotationDraft } from '../types'
import {
  calculateMajorItemSummary,
  calculateQuotationTotals,
} from '../utils/quotationCalculations'
import { createInitialQuotation } from '../utils/quotationDraft'
import { MIXED_TAX_DOCUMENT_COLUMNS } from '../utils/quotationDocumentColumns'
import { createQuotationItem, isQuotationItem } from '../utils/quotationItems'
import FloatingPreviewWindow from './FloatingPreviewWindow.vue'
import QuotationPreview from './QuotationPreview.vue'

vi.mock('primevue/button', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    default: defineComponent({
      name: 'Button',
      inheritAttrs: false,
      setup(_props, { attrs, slots }) {
        return () => h('button', attrs, slots.default?.())
      },
    }),
  }
})

vi.mock('primevue/select', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    default: defineComponent({
      name: 'Select',
      inheritAttrs: false,
      props: {
        modelValue: { type: String, default: '' },
        inputId: { type: String, default: '' },
        options: { type: Array, default: () => [] },
        optionLabel: { type: String, default: '' },
        optionValue: { type: String, default: '' },
      },
      setup(props, { attrs }) {
        return () => h('select', { ...attrs, id: props.inputId, value: props.modelValue })
      },
    }),
  }
})

const INITIAL_COLUMNS: MixedTaxDocumentColumn[] = [
  'taxRate',
  'unitPrice',
  'netAmount',
  'grossAmount',
]
const LARGE_QUOTATION_ROW_COUNT = 1_215

describe('FloatingPreviewWindow continuous preview', () => {
  afterEach(() => {
    document.body.replaceChildren()
    document.body.removeAttribute('style')
  })

  it('keeps one width-fitted live document reactive for a quotation with over 1,000 rows', async () => {
    const { quotation: draft, targetItemId, lastItemId } = createLargeQuotation()
    const quotation = reactive(draft)
    const rootItems = quotation.majorItems.filter(isQuotationItem)
    const summaries = rootItems.map((item) =>
      calculateMajorItemSummary(item, quotation.totalsConfig, quotation.exchangeRates),
    )
    const wrapper = mount(FloatingPreviewWindow, {
      attachTo: document.body,
      props: {
        supportsDirectPdfExport: true,
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
      global: { plugins: [createAppI18n('en-US')] },
    })

    try {
      await settleLayout()

      expectSingleContinuousDocument(wrapper)
      expect(wrapper.get('.quotation-table').attributes('aria-rowcount')).toBe('1216')
      expect(wrapper.findAll('.quotation-table tbody tr[data-row-key]').length).toBeLessThan(100)
      expect(wrapper.get('.quotation-table').classes()).toContain('table-mixed-tax-columns-4')
      expect(
        wrapper
          .get(`tr[data-row-key="${targetItemId}-sub"]`)
          .findAll('[data-column-id]'),
      ).toHaveLength(INITIAL_COLUMNS.length)
      expectWidthFitted(wrapper)

      quotation.totalsConfig.mixedTaxColumns = [...MIXED_TAX_DOCUMENT_COLUMNS]
      await settleLayout()

      expectSingleContinuousDocument(wrapper)
      expect(wrapper.get('.quotation-table').classes()).toContain('table-mixed-tax-columns-7')
      const columnLabels = wrapper
        .findAll('.column-heading-label, .price-breakdown-label')
        .map((label) => label.text())
      expect(columnLabels).toContain('Unit Tax')
      expect(columnLabels).toContain('Tax')
      expect(
        wrapper
          .get(`tr[data-row-key="${targetItemId}-sub"]`)
          .findAll('[data-column-id]'),
      ).toHaveLength(MIXED_TAX_DOCUMENT_COLUMNS.length)
      expectWidthFitted(wrapper)

      const previewBody = wrapper.get<HTMLElement>('.floating-preview-body').element
      await scrollPreview(previewBody, previewBody.scrollHeight / 2)
      const middleIndexes = getRenderedRowIndexes(wrapper)
      expect(Math.min(...middleIndexes)).toBeGreaterThan(300)
      expect(Math.max(...middleIndexes)).toBeLessThan(1_000)

      const zoomButtons = wrapper.findAll('button[aria-pressed]')
      await zoomButtons[1]!.trigger('click')
      await settleLayout()
      expect(getRenderedRowIndexes(wrapper).length).toBeGreaterThan(0)
      await zoomButtons[0]!.trigger('click')
      await settleLayout()
      expect(getRenderedRowIndexes(wrapper).length).toBeGreaterThan(0)

      await scrollPreview(previewBody, previewBody.scrollHeight)
      expect(wrapper.find(`tr[data-row-key="${lastItemId}-sub"]`).exists()).toBe(true)

      await scrollPreview(previewBody, 0)

      quotation.templateId = 'classic'
      rootItems[0]!.children[0]!.children[0]!.name = 'Updated while preview is open'
      await settleLayout()

      expectSingleContinuousDocument(wrapper)
      expect(wrapper.get('.quotation-document').classes()).toContain('quotation-template-classic')
      expect(wrapper.get(`tr[data-row-key="${targetItemId}-sub"] .item-title`).text()).toBe(
        'Updated while preview is open',
      )
      expect(wrapper.findAll('.quotation-table tbody tr[data-row-key]').length).toBeLessThan(100)
      expectWidthFitted(wrapper)
    } finally {
      wrapper.unmount()
    }
  })

  it('keeps the complete table when no continuous-preview context is provided', async () => {
    const { quotation } = createLargeQuotation()
    const rootItems = quotation.majorItems.filter(isQuotationItem)
    const summaries = rootItems.map((item) =>
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
      global: { plugins: [createAppI18n('en-US')] },
    })

    try {
      await nextTick()
      expect(wrapper.findAll('.quotation-table tbody tr[data-row-key]')).toHaveLength(
        LARGE_QUOTATION_ROW_COUNT,
      )
      expect(wrapper.find('.quotation-virtual-spacer-row').exists()).toBe(false)
    } finally {
      wrapper.unmount()
    }
  })
})

function createLargeQuotation(): {
  quotation: QuotationDraft
  targetItemId: string
  lastItemId: string
} {
  const quotation = createInitialQuotation([], 'en-US')
  const targetItemId = 'group-0-nested-0-leaf-0'
  const lastItemId = 'group-5-child-176'

  quotation.templateId = 'spreadsheet'
  quotation.header.quotationNumber = 'CONTINUOUS-PREVIEW-REGRESSION'
  quotation.header.customerCompany = 'Large quotation customer'
  quotation.header.projectName = 'Large continuous preview'
  quotation.totalsConfig.taxMode = 'mixed'
  quotation.totalsConfig.mixedTaxColumns = [...INITIAL_COLUMNS]
  quotation.majorItems = Array.from({ length: 6 }, (_, groupIndex) => {
    const descendantCount = groupIndex < 3 ? 202 : 201
    const nestedGroups = Array.from({ length: 8 }, (_, nestedIndex) =>
      createQuotationItem('USD', {
        id: `group-${groupIndex}-nested-${nestedIndex}`,
        name: `Nested group ${groupIndex + 1}.${nestedIndex + 1}`,
        description: `Nested specification ${'with variable detail '.repeat((nestedIndex % 3) + 1)}`,
        children: Array.from({ length: 2 }, (_, leafIndex) =>
          createQuotationItem('USD', {
            id: `group-${groupIndex}-nested-${nestedIndex}-leaf-${leafIndex}`,
            name: `Nested line ${groupIndex + 1}.${nestedIndex + 1}.${leafIndex + 1}`,
            description: `Third-level specification ${'and extended requirements '.repeat(((nestedIndex + leafIndex) % 4) + 1)}`,
            quantity: leafIndex + 1,
            unitCost: 15 + nestedIndex + leafIndex,
          }),
        ),
      }),
    )
    const directChildCount = descendantCount - nestedGroups.length * 3
    const directChildren = Array.from({ length: directChildCount }, (_, childIndex) =>
      createQuotationItem('USD', {
        id: `group-${groupIndex}-child-${childIndex}`,
        name: `Line ${groupIndex + 1}.${childIndex + 1}`,
        description: `Specification for line ${groupIndex + 1}.${childIndex + 1} ${'with additional technical detail '.repeat((childIndex % 6) + 1)}`,
        quantity: childIndex + 1,
        unitCost: 10 + childIndex,
      }),
    )

    return createQuotationItem('USD', {
      id: `group-${groupIndex}`,
      name: `Group ${groupIndex + 1}`,
      description: `Root group ${groupIndex + 1} with a variable-height quotation hierarchy`,
      children: [...nestedGroups, ...directChildren],
    })
  })

  return { quotation, targetItemId, lastItemId }
}

async function settleLayout() {
  await nextTick()
  await document.fonts.ready
  await animationFrame()
  await nextTick()
  await animationFrame()
}

function animationFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
}

async function scrollPreview(element: HTMLElement, top: number) {
  element.scrollTop = top
  element.dispatchEvent(new Event('scroll'))
  await settleLayout()
}

function getRenderedRowIndexes(wrapper: VueWrapper) {
  return wrapper
    .findAll('.quotation-table tbody tr[data-index]')
    .map((row) => Number(row.attributes('data-index')))
}

function expectSingleContinuousDocument(wrapper: VueWrapper) {
  expect(wrapper.findAll('.quotation-document')).toHaveLength(1)
  expect(wrapper.find('.quotation-measurement').exists()).toBe(false)
  expect(wrapper.find('.quotation-pagination-draft').exists()).toBe(false)
  expect(wrapper.find('.quotation-page').exists()).toBe(false)
}

function expectWidthFitted(wrapper: VueWrapper) {
  const body = wrapper.get<HTMLElement>('.floating-preview-body').element
  const document = wrapper.get<HTMLElement>('.quotation-document').element
  const availableWidth = Math.max(0, body.clientWidth - 32)
  const renderedWidth = document.getBoundingClientRect().width

  expect(renderedWidth).toBeGreaterThan(0)
  expect(renderedWidth).toBeLessThanOrEqual(availableWidth + 2)
}
