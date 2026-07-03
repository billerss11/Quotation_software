// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { createAppI18n } from '@/shared/i18n/createAppI18n'

import QuotationAnalysisView from './QuotationAnalysisView.vue'
import type { QuotationAnalysisDataset } from '../utils/quotationAnalysis'

describe('QuotationAnalysisView', () => {
  it('renders an empty state when the quotation does not have meaningful pricing data yet', () => {
    const wrapper = mount(QuotationAnalysisView, {
      props: {
        analysis: createAnalysisDataset({
          hasMeaningfulData: false,
        }),
        currency: 'USD',
      },
      global: {
        plugins: [createAppI18n('en-US')],
        stubs: {
          QuotationAnalysisChart: {
            template: '<div class="chart-stub" />',
          },
        },
      },
    })

    expect(wrapper.text()).toContain('Add priced items to unlock cost, markup, and currency insights.')
  })

  it('emits the selected major item when the user drills in from the item review table', async () => {
    const wrapper = mount(QuotationAnalysisView, {
      props: {
        analysis: createAnalysisDataset(),
        currency: 'USD',
      },
      global: {
        plugins: [createAppI18n('en-US')],
        stubs: {
          QuotationAnalysisChart: {
            template: '<div class="chart-stub" />',
          },
        },
      },
    })

    await wrapper.get('.margin-row-link[data-item-id="major-1"]').trigger('click')

    expect(wrapper.emitted('selectItem')).toEqual([[{ itemId: 'major-1' }]])
  })

  it('shows profit confidence when some quoted revenue has no cost basis yet', () => {
    const wrapper = mount(QuotationAnalysisView, {
      props: {
        analysis: createAnalysisDataset({
          kpis: {
            ...createAnalysisDataset().kpis,
            costCoverageRate: 42.5,
          },
          profitConfidence: {
            ...createAnalysisDataset().profitConfidence,
            costVisibilityRate: 42.5,
            finalPriceRevenueWithoutCost: 320,
            finalPriceItemCountWithoutCost: 2,
          },
        }),
        currency: 'USD',
      },
      global: {
        plugins: [createAppI18n('en-US')],
        stubs: {
          QuotationAnalysisChart: {
            template: '<div class="chart-stub" />',
          },
        },
      },
    })

    expect(wrapper.text()).toContain('Profit confidence')
    expect(wrapper.text()).toContain('42.50%')
    expect(wrapper.text()).toContain('$320.00')
  })

  it('emits the selected major item when the user opens an advisory item link', async () => {
    const wrapper = mount(QuotationAnalysisView, {
      props: {
        analysis: createAnalysisDataset({
          advisories: [
            {
              id: 'currency-major-1',
              type: 'currency_mix',
              severity: 'review',
              itemId: 'major-1',
              itemName: 'Equipment',
              currencies: ['CNY', 'USD'],
            },
          ],
        }),
        currency: 'USD',
      },
      global: {
        plugins: [createAppI18n('en-US')],
        stubs: {
          QuotationAnalysisChart: {
            template: '<div class="chart-stub" />',
          },
        },
      },
    })

    await wrapper.get('.advisory-card[data-advisory-type="currency_mix"]').trigger('click')
    expect(wrapper.emitted('selectItem')).toBeUndefined()

    await wrapper.get('.advisory-item-button[data-item-id="major-1"]').trigger('click')

    expect(wrapper.emitted('selectItem')).toEqual([[{ itemId: 'major-1' }]])
  })

  it('groups repeated advisories by type instead of rendering duplicate cards', () => {
    const wrapper = mount(QuotationAnalysisView, {
      props: {
        analysis: createAnalysisDataset({
          advisories: [
            {
              id: 'currency-major-1',
              type: 'currency_mix',
              severity: 'review',
              itemId: 'major-1',
              itemName: 'Equipment',
              currencies: ['CNY', 'USD'],
            },
            {
              id: 'currency-major-2',
              type: 'currency_mix',
              severity: 'review',
              itemId: 'major-2',
              itemName: 'Services',
              currencies: ['EUR', 'USD'],
            },
            {
              id: 'low-markup-major-3',
              type: 'low_markup',
              severity: 'review',
              itemId: 'major-3',
              itemName: 'Low markup package',
              markupRate: 5,
              threshold: 10,
            },
          ],
        }),
        currency: 'USD',
      },
      global: {
        plugins: [createAppI18n('en-US')],
        stubs: {
          QuotationAnalysisChart: {
            template: '<div class="chart-stub" />',
          },
        },
      },
    })

    expect(wrapper.findAll('.advisory-card')).toHaveLength(2)
    expect(wrapper.findAll('.advisory-item-button')).toHaveLength(3)
    expect(wrapper.text()).toContain('2 major items have positive cost in multiple source currencies.')
    expect(wrapper.text()).toContain('3 currencies')
    expect(wrapper.text()).toContain('CNY / USD')
    expect(wrapper.text()).toContain('Equipment')
    expect(wrapper.text()).toContain('Services')
    expect(wrapper.text()).toContain('Low markup package is at 5.00%')
  })

  it('lets the user reveal every affected item when an advisory group has more than five rows', async () => {
    const advisories = Array.from({ length: 7 }, (_, index) => ({
      id: `currency-major-${index + 1}`,
      type: 'currency_mix' as const,
      severity: 'review' as const,
      itemId: `major-${index + 1}`,
      itemName: `Package ${index + 1}`,
      currencies: ['CNY', 'USD'],
    }))
    const wrapper = mount(QuotationAnalysisView, {
      props: {
        analysis: createAnalysisDataset({ advisories }),
        currency: 'USD',
      },
      global: {
        plugins: [createAppI18n('en-US')],
        stubs: {
          QuotationAnalysisChart: {
            template: '<div class="chart-stub" />',
          },
        },
      },
    })

    expect(wrapper.findAll('.advisory-item-button')).toHaveLength(5)
    expect(wrapper.text()).toContain('Show all 2 more')
    expect(wrapper.text()).not.toContain('Package 7')

    await wrapper.get('.advisory-more-button').trigger('click')

    expect(wrapper.findAll('.advisory-item-button')).toHaveLength(7)
    expect(wrapper.text()).toContain('Package 7')
    expect(wrapper.text()).toContain('Show fewer')
  })
})

function createAnalysisDataset(
  overrides: Partial<QuotationAnalysisDataset> = {},
): QuotationAnalysisDataset {
  return {
    hasMeaningfulData: true,
    kpis: {
      baseSubtotal: 560,
      markupAmount: 46,
      discountAmount: 50,
      taxAmount: 27.8,
      grandTotal: 583.8,
      grossMarginAmount: 46,
      grossMarginRate: 7.59,
      costCoverageRate: 100,
    },
    compositionSummary: {
      majorItemCount: 2,
      pricedLineCount: 3,
      currencyCount: 2,
      markupOverrideCount: 1,
    },
    advisories: [],
    profitConfidence: {
      knownCostRevenue: 606,
      finalPriceRevenueWithoutCost: 0,
      finalPriceItemCountWithoutCost: 0,
      costVisibilityRate: 100,
    },
    majorItemRows: [
      {
        itemId: 'major-1',
        itemName: 'Equipment',
        baseSubtotal: 240,
        subtotal: 254,
        profitAmount: 14,
        effectiveMarkupRate: 5.83,
        grossMarginRate: 5.51,
        currencyExposure: {
          CNY: 140,
          USD: 100,
        },
        taxClassLabels: ['5%'],
      },
    ],
    currencyExposure: {
      currencies: ['CNY', 'USD'],
      rows: [
        {
          itemId: 'major-1',
          itemName: 'Equipment',
          values: {
            CNY: 140,
            USD: 100,
          },
        },
      ],
    },
    bridge: [
      {
        key: 'baseSubtotal',
        amount: 560,
        cumulativeStart: 0,
        cumulativeEnd: 560,
      },
      {
        key: 'markupAmount',
        amount: 46,
        cumulativeStart: 560,
        cumulativeEnd: 606,
      },
      {
        key: 'discountAmount',
        amount: -50,
        cumulativeStart: 556,
        cumulativeEnd: 606,
      },
      {
        key: 'taxAmount',
        amount: 27.8,
        cumulativeStart: 556,
        cumulativeEnd: 583.8,
      },
      {
        key: 'grandTotal',
        amount: 583.8,
        cumulativeStart: 0,
        cumulativeEnd: 583.8,
      },
    ],
    ...overrides,
  }
}
