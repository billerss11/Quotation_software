// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createAppI18n } from '@/shared/i18n/createAppI18n'

import type { QuotationDraft, QuotationItem } from '../../types'
import {
  calculateMajorItemSummary,
  calculateQuotationTotals,
} from '../../utils/quotationCalculations'
import { createInitialQuotation } from '../../utils/quotationDraft'
import { createQuotationItem, isQuotationItem } from '../../utils/quotationItems'
import QuotationItemsTable from './QuotationItemsTable.vue'

describe('QuotationItemsTable document semantics', () => {
  afterEach(() => {
    document.body.replaceChildren()
    vi.unstubAllGlobals()
  })

  it('renders nested hierarchy visually and exposes ancestor data without changing S19 totals', () => {
    const quotation = createNestedMixedTaxQuotation('en-US')
    const wrapper = mountTable(quotation, { hideTopLevelGroupDetail: true })

    try {
      const table = wrapper.get('table')
      const rootRow = wrapper.get('[data-row-key="system-major"]')
      const moduleRow = wrapper.get('[data-row-key="module-sub"]')
      const pumpRow = wrapper.get('[data-row-key="pump-sub"]')

      expect(table.classes()).not.toContain('table-price-breakdown')
      expect(rootRow.text()).toContain('System supply scope')
      expect(rootRow.text()).toContain('$2,700.00')
      expect(rootRow.text()).toContain('$3,030.00')
      expect(rootRow.classes()).toContain('row-level-1')
      expect(moduleRow.get('.item-description').classes()).toContain('item-description-level-2')
      expect(pumpRow.get('.item-description').classes()).toContain('item-description-level-3')
      expect(rootRow.get('.col-description').text()).toBe('SystemSystem supply scope')
      expect(moduleRow.get('.col-description').text()).toBe('Module')
      expect(pumpRow.get('.col-description').text()).toBe('Pumps')
      expect(pumpRow.attributes('data-parent-number')).toBe('1.1')
      expect(pumpRow.attributes('data-parent-path')).toBe('1 System › 1.1 Module')
    } finally {
      wrapper.unmount()
    }
  })

  it('labels a group rate as mixed and effective in Chinese', () => {
    const quotation = createNestedMixedTaxQuotation('zh-CN')
    const wrapper = mountTable(quotation)

    try {
      expect(wrapper.get('[data-row-key="system-major"] .tax-value').text()).toBe('混合（综合 12.22%）')
    } finally {
      wrapper.unmount()
    }
  })

  it('marks level-one output as a summary while retaining the group description', () => {
    const quotation = createNestedMixedTaxQuotation('en-US')
    quotation.outputSettings = { itemDetailLevel: 1 }
    const wrapper = mountTable(quotation, { hideTopLevelGroupDetail: true })

    try {
      expect(wrapper.get('.detail-level-notice').text()).toContain('child items are hidden')
      const rootRow = wrapper.get('[data-row-key="system-major"]')
      expect(rootRow.get('.item-detail').text()).toBe('System supply scope')
      expect(rootRow.get('.col-description').text()).toBe('SystemSystem supply scope')
      expect(wrapper.find('[data-row-key="module-sub"]').exists()).toBe(false)
    } finally {
      wrapper.unmount()
    }
  })
})

function createNestedMixedTaxQuotation(locale: 'en-US' | 'zh-CN') {
  vi.stubGlobal('crypto', { randomUUID: () => 'unused-test-id' })

  const quotation = createInitialQuotation([], locale)
  const pump = createQuotationItem('USD', {
    id: 'pump',
    name: 'Pumps',
    quantity: 4,
    quantityUnit: 'EA',
    pricingMethod: 'manual_price',
    manualUnitPrice: 100,
    taxClassId: 'standard',
  })
  const sensor = createQuotationItem('USD', {
    id: 'sensor',
    name: 'Sensors',
    quantity: 2,
    quantityUnit: 'EA',
    pricingMethod: 'manual_price',
    manualUnitPrice: 25,
    taxClassId: 'reduced',
  })
  const module = createQuotationItem('USD', {
    id: 'module',
    name: 'Module',
    quantity: 3,
    quantityUnit: 'MODULE',
    children: [pump, sensor],
  })
  const system = createQuotationItem('USD', {
    id: 'system',
    name: 'System',
    description: 'System supply scope',
    quantity: 2,
    quantityUnit: 'SYSTEM',
    children: [module],
  })

  quotation.header.currency = 'USD'
  quotation.majorItems = [system]
  quotation.outputSettings = { itemDetailLevel: 3 }
  quotation.totalsConfig = {
    globalMarkupRate: 0,
    taxMode: 'mixed',
    taxClasses: [
      { id: 'standard', label: 'Standard', rate: 13 },
      { id: 'reduced', label: 'Reduced', rate: 6 },
    ],
    defaultTaxClassId: 'standard',
    mixedTaxColumns: [
      'taxRate',
      'unitPrice',
      'unitTax',
      'unitPriceWithTax',
      'taxAmount',
      'netAmount',
      'grossAmount',
    ],
  }

  return quotation
}

function mountTable(
  quotation: QuotationDraft,
  extraProps: { hideTopLevelGroupDetail?: boolean } = {},
) {
  const quotationItems = quotation.majorItems.filter(isQuotationItem) as QuotationItem[]
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
      ...extraProps,
    },
    global: { plugins: [createAppI18n(localeForQuotation(quotation))] },
  })
}

function localeForQuotation(quotation: QuotationDraft) {
  return quotation.header.documentLocale
}
