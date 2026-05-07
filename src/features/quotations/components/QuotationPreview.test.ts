// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { createAppI18n } from '@/shared/i18n/createAppI18n'
import type { CompanyProfile } from '@/shared/contracts/reusableLibrary'

import QuotationPreview from './QuotationPreview.vue'
import type { ExchangeRateTable, QuotationDraft, QuotationItem, TotalsConfig } from '../types'
import { calculateMajorItemSummary, calculateQuotationTotals } from '../utils/quotationCalculations'

describe('QuotationPreview', () => {
  it('shows unit price, tax amount, amount, and amount incl tax in mixed-tax mode', () => {
    const { props } = createPreviewProps('mixed')
    const wrapper = mount(QuotationPreview, {
      props,
      global: {
        plugins: [createAppI18n('en-US')],
      },
    })

    expect(wrapper.findAll('thead th')).toHaveLength(9)
    expect(wrapper.findAll('thead th').map((cell) => cell.text())).toEqual([
      'No',
      'Description',
      'Qty',
      'Unit',
      'Rate',
      'Price',
      'Tax',
      'Amount',
      'Amt+Tax',
    ])
    expect(wrapper.find('.stacked-heading').exists()).toBe(false)
    expect(wrapper.find('.money-stack').exists()).toBe(false)
    expect(wrapper.findAll('tbody tr').at(2)?.findAll('.col-money').at(1)?.text()).toBe('$82.13')
    expect(wrapper.find('.company-name').text()).toContain('Engineering')
  })
})

function createPreviewProps(taxMode: TotalsConfig['taxMode']) {
  const companyProfile: CompanyProfile = {
    companyName: 'Shenzhen Nanshan Haitenghui Engineering Technical Services Department',
    email: 'sales@haitenghui.example',
    phone: '+86 157 1214 1511',
  }
  const exchangeRates: ExchangeRateTable = { USD: 1 }
  const taxClasses = [
    { id: 'vat-13', label: '13%', rate: 13 },
    { id: 'vat-9', label: '9%', rate: 9 },
  ]
  const majorItems: QuotationItem[] = [
    {
      id: 'major-1',
      name: 'NPL ADPTR',
      description: 'Package rollup',
      quantity: 1,
      quantityUnit: 'EA',
      unitCost: 0,
      costCurrency: 'USD',
      taxClassId: 'vat-13',
      children: [
        {
          id: 'sub-1',
          name: 'Adapter assembly',
          description: 'F / shell stock-conversion only with extended machining detail',
          quantity: 1,
          quantityUnit: 'EA',
          unitCost: 36532.32,
          costCurrency: 'USD',
          taxClassId: 'vat-13',
          children: [],
        },
        {
          id: 'sub-2',
          name: 'Field service',
          description: 'Commissioning and validation support',
          quantity: 2,
          quantityUnit: 'DAY',
          unitCost: 912.5,
          costCurrency: 'USD',
          taxClassId: 'vat-9',
          children: [],
        },
      ],
    },
  ]
  const totalsConfig: TotalsConfig = {
    globalMarkupRate: 0,
    discountMode: 'percentage',
    discountValue: 0,
    taxMode,
    taxClasses,
    defaultTaxClassId: 'vat-13',
  }
  const quotation: QuotationDraft = {
    id: 'quotation-1',
    companyProfileId: null,
    companyProfileSnapshot: companyProfile,
    header: {
      quotationNumber: 'Q-2026-048',
      revisionNumber: 1,
      quotationDate: '2026-05-06',
      customerCompany: 'Schlumberger',
      contactPerson: 'John Doe',
      contactDetails: 'John.Doe@gmail.com',
      projectName: 'Project name',
      validityPeriod: '30 days',
      currency: 'USD',
      documentLocale: 'en-US',
      notes: '',
      terms: '',
    },
    majorItems,
    lineItemEntryMode: 'detailed',
    totalsConfig,
    exchangeRates,
    branding: {
      logoDataUrl: '',
      accentColor: '#047857',
    },
  }
  const summaries = majorItems.map((item) => calculateMajorItemSummary(item, totalsConfig, exchangeRates))
  const totals = calculateQuotationTotals(majorItems, totalsConfig, exchangeRates)

  return {
    props: {
      quotation,
      summaries,
      totals,
      globalMarkupRate: totalsConfig.globalMarkupRate,
      exchangeRates,
      companyProfile,
    },
  }
}
