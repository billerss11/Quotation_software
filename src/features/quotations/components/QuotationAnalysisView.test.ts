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

  it('emits the selected major item when the user drills in from the margin ranking table', async () => {
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

    await wrapper.get('[data-item-id="major-1"]').trigger('click')

    expect(wrapper.emitted('selectItem')).toEqual([[{ itemId: 'major-1' }]])
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
    },
    compositionSummary: {
      majorItemCount: 2,
      pricedLineCount: 3,
      currencyCount: 2,
      markupOverrideCount: 1,
    },
    majorItemRows: [
      {
        itemId: 'major-1',
        itemName: 'Equipment',
        baseSubtotal: 240,
        subtotal: 254,
        profitAmount: 14,
        grossMarginRate: 5.51,
        currencyExposure: {
          CNY: 140,
          USD: 100,
        },
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
