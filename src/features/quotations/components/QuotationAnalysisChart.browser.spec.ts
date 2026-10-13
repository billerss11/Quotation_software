import { mount } from '@vue/test-utils'
import { getInstanceByDom, type EChartsCoreOption } from 'echarts/core'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createAppI18n } from '@/shared/i18n/createAppI18n'

import QuotationAnalysisChart from './QuotationAnalysisChart.vue'
import QuotationAnalysisView from './QuotationAnalysisView.vue'
import { calculateMajorItemSummary, calculateQuotationTotals } from '../utils/quotationCalculations'
import { createQuotationAnalysisDataset } from '../utils/quotationAnalysis'
import { createInitialQuotation } from '../utils/quotationDraft'
import { createQuotationItem } from '../utils/quotationItems'

type DataZoomOption = { startValue?: number; endValue?: number }

const option: EChartsCoreOption = {
  xAxis: { type: 'category', data: Array.from({ length: 20 }, (_, index) => `Item ${index + 1}`) },
  yAxis: { type: 'value' },
  dataZoom: [
    { type: 'slider', xAxisIndex: 0, startValue: 0, endValue: 11 },
    { type: 'inside', xAxisIndex: 0 },
  ],
  series: [{ type: 'bar', data: Array.from({ length: 20 }, (_, index) => index + 1) }],
}

describe('QuotationAnalysisChart', () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  it('applies slider and inside data zoom actions to the real ECharts instance', async () => {
    const host = document.createElement('div')
    host.style.width = '720px'
    document.body.appendChild(host)
    const wrapper = mount(QuotationAnalysisChart, {
      attachTo: host,
      props: {
        option,
        chartLabel: 'Analysis chart',
      },
    })

    try {
      const chart = await getChart(wrapper.element as HTMLElement)

      chart.dispatchAction({ type: 'dataZoom', startValue: 5, endValue: 16 })
      await vi.waitFor(() => {
        const dataZoom = chart.getOption().dataZoom as DataZoomOption[] | undefined
        expect(dataZoom?.[0]?.startValue).toBe(5)
        expect(dataZoom?.[0]?.endValue).toBe(16)
      })
    } finally {
      wrapper.unmount()
      host.remove()
    }
  })

  it('stacks negative known-cost profit into the revenue endpoint', async () => {
    const host = document.createElement('div')
    host.style.width = '720px'
    document.body.appendChild(host)
    const wrapper = mount(QuotationAnalysisView, {
      attachTo: host,
      props: {
        analysis: createNegativeProfitAnalysisDataset(),
        currency: 'USD',
      },
      global: {
        plugins: [createAppI18n('en-US')],
      },
    })

    try {
      const chartElement = wrapper.get('[aria-label="Revenue and profit chart"]').element as HTMLElement
      const chart = await getChart(chartElement)

      await vi.waitFor(() => {
        expect(getStackedResult(chart, 2)).toBe(1080)
        const profitBar = getBarRendering(chart, 1)
        const salesBar = getBarRendering(chart, 2)
        expect(profitBar.bounds.width).toBeGreaterThan(0)
        expect(profitBar.bounds.height).toBeGreaterThan(0)
        expect(salesBar.drawIndex).toBeGreaterThanOrEqual(0)
        expect(profitBar.drawIndex).toBeGreaterThan(salesBar.drawIndex)
      })
    } finally {
      wrapper.unmount()
      host.remove()
    }
  })
})

async function getChart(element: HTMLElement) {
  await vi.waitFor(() => {
    expect(getInstanceByDom(element)).toBeDefined()
  })

  return getInstanceByDom(element)!
}

function getStackedResult(chart: ReturnType<typeof getInstanceByDom>, seriesIndex: number) {
  const data = getSeriesData(chart, seriesIndex)
  const stackResultDimension = data.getCalculationInfo('stackResultDimension')

  if (typeof stackResultDimension !== 'string') {
    throw new Error('Expected ECharts to calculate a stack result dimension.')
  }

  return data.get(stackResultDimension, 0)
}

function getBarRendering(chart: NonNullable<ReturnType<typeof getInstanceByDom>>, seriesIndex: number) {
  const graphic = getSeriesData(chart, seriesIndex).getItemGraphicEl(0)
  return {
    bounds: graphic.getBoundingRect(),
    drawIndex: chart.getZr().storage.getDisplayList().findIndex((element) => element === graphic),
  }
}

function getSeriesData(chart: ReturnType<typeof getInstanceByDom>, seriesIndex: number) {
  const model = (chart as unknown as {
    getModel(): {
      getSeriesByIndex(index: number): {
        getData(): {
          getCalculationInfo(key: string): unknown
          get(dimension: string, dataIndex: number): unknown
          getItemGraphicEl(dataIndex: number): {
            getBoundingRect(): { x: number; y: number; width: number; height: number }
          }
        }
      }
    }
  }).getModel()
  return model.getSeriesByIndex(seriesIndex).getData()
}

function createNegativeProfitAnalysisDataset() {
  const quotation = createInitialQuotation([], 'en-US')
  const item = createQuotationItem('USD', {
    id: 'major-1',
    name: 'Equipment',
    children: [
      createQuotationItem('USD', {
        id: 'known-sale',
        pricingMethod: 'manual_price',
        manualUnitPrice: 80,
        unitCost: 100,
      }),
      createQuotationItem('USD', {
        id: 'unknown-sale',
        pricingMethod: 'manual_price',
        manualUnitPrice: 1000,
      }),
    ],
  })
  quotation.majorItems = [item]

  const summaries = [calculateMajorItemSummary(item, quotation.totalsConfig, quotation.exchangeRates)]
  const totals = calculateQuotationTotals(quotation.majorItems, quotation.totalsConfig, quotation.exchangeRates)

  return createQuotationAnalysisDataset(quotation, summaries, totals)
}
