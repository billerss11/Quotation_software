// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { createAppI18n } from '@/shared/i18n/createAppI18n'
import type { CompanyProfile } from '@/shared/contracts/reusableLibrary'

import QuotationPreview from './QuotationPreview.vue'
import type { ExchangeRateTable, QuotationDraft, QuotationItem, TotalsConfig } from '../types'
import { calculateMajorItemSummary, calculateQuotationTotals } from '../utils/quotationCalculations'

describe('QuotationPreview', () => {
  it('renders the legacy template by default', () => {
    const { props } = createPreviewProps('single')

    const wrapper = mount(QuotationPreview, {
      props,
      global: {
        plugins: [createAppI18n('en-US')],
      },
    })

    expect(wrapper.find('.quotation-template-legacy').exists()).toBe(true)
    expect(wrapper.find('.quotation-template-technical-bid').exists()).toBe(false)
  })

  it('renders the technical bid template when selected on the quotation', () => {
    const { props } = createPreviewProps('single')
    props.quotation.templateId = 'technical-bid'

    const wrapper = mount(QuotationPreview, {
      props,
      global: {
        plugins: [createAppI18n('en-US')],
      },
    })

    expect(wrapper.find('.quotation-template-technical-bid').exists()).toBe(true)
    expect(wrapper.find('.quotation-template-legacy').exists()).toBe(false)
  })

  it('renders the executive summary template when selected on the quotation', () => {
    const { props } = createPreviewProps('single')
    props.quotation.templateId = 'executive-summary'

    const wrapper = mount(QuotationPreview, {
      props,
      global: {
        plugins: [createAppI18n('en-US')],
      },
    })

    expect(wrapper.find('.quotation-template-executive-summary').exists()).toBe(true)
    expect(wrapper.find('.quotation-template-legacy').exists()).toBe(false)
    expect(wrapper.find('.quotation-table-executive-summary').exists()).toBe(true)
  })

  it('renders the luminous template when selected on the quotation', () => {
    const { props } = createPreviewProps('single')
    props.quotation.templateId = 'luminous'

    const wrapper = mount(QuotationPreview, {
      props,
      global: {
        plugins: [createAppI18n('en-US')],
      },
    })

    expect(wrapper.find('.quotation-template-luminous').exists()).toBe(true)
    expect(wrapper.find('.quotation-template-legacy').exists()).toBe(false)
    expect(wrapper.find('.quotation-table-luminous').exists()).toBe(true)
  })

  it('renders the signal template when selected on the quotation', () => {
    const { props } = createPreviewProps('single')
    props.quotation.templateId = 'signal'

    const wrapper = mount(QuotationPreview, {
      props,
      global: {
        plugins: [createAppI18n('en-US')],
      },
    })

    expect(wrapper.find('.quotation-template-signal').exists()).toBe(true)
    expect(wrapper.find('.quotation-template-legacy').exists()).toBe(false)
    expect(wrapper.find('.quotation-table-signal').exists()).toBe(true)
  })

  it('renders visual section headers as full-width preview bands', () => {
    const { props } = createPreviewProps('single')
    props.quotation.majorItems = [
      {
        id: 'section-1',
        kind: 'section_header',
        title: 'Valve',
      } as never,
      ...props.quotation.majorItems,
    ]

    const wrapper = mount(QuotationPreview, {
      props,
      global: {
        plugins: [createAppI18n('en-US')],
      },
    })

    const sectionRow = wrapper.get('.row-section')
    expect(sectionRow.text()).toContain('Valve')
    expect(sectionRow.find('td')?.attributes('colspan')).toBe('6')
  })

  it('shows unit price, unit tax, unit price incl tax, total tax, amount, and amount incl tax in mixed-tax mode', () => {
    const { props } = createPreviewProps('mixed')
    const wrapper = mount(QuotationPreview, {
      props,
      global: {
        plugins: [createAppI18n('en-US')],
      },
    })

    expect(wrapper.findAll('thead th')).toHaveLength(11)
    const headers = wrapper.findAll('thead th')
    expect(headers.map((cell) => cell.text())).toEqual([
      'No',
      'Description',
      'Qty',
      'Unit',
      'Tax %',
      'Unit Priceexcl. tax',
      'Unit Tax',
      'Unit Priceincl. tax',
      'Taxtotal',
      'Amountexcl. tax',
      'Amountincl. tax',
    ])
    expect(headers.at(5)?.find('.column-heading-note').text()).toBe('excl. tax')
    expect(headers.at(6)?.find('.column-heading-note-spacer').exists()).toBe(true)
    expect(headers.at(7)?.find('.column-heading-note').text()).toBe('incl. tax')
    expect(headers.at(8)?.find('.column-heading-note').text()).toBe('total')
    expect(headers.at(9)?.find('.column-heading-note').text()).toBe('excl. tax')
    expect(headers.at(10)?.find('.column-heading-note').text()).toBe('incl. tax')
    expect(headers.at(2)?.classes()).toContain('col-qty')
    expect(headers.at(3)?.classes()).toContain('col-unit')
    expect(headers.at(4)?.classes()).toContain('col-tax')
    expect(headers.at(5)?.classes()).toContain('col-money')
    expect(headers.every((cell) => cell.find('.column-heading').exists())).toBe(true)
    expect(wrapper.find('.stacked-heading').exists()).toBe(false)
    expect(wrapper.find('.money-stack').exists()).toBe(false)
    const firstRowCells = wrapper.findAll('tbody tr').at(0)?.findAll('td') ?? []
    expect(firstRowCells.at(2)?.classes()).toContain('col-qty')
    expect(firstRowCells.at(3)?.classes()).toContain('col-unit')
    expect(firstRowCells.at(4)?.classes()).toContain('col-tax')
    expect(firstRowCells.at(5)?.classes()).toContain('col-money')
    expect(wrapper.findAll('tbody tr').at(0)?.findAll('.col-money').at(2)?.text()).toBe('$43,270.77')
    expect(wrapper.findAll('tbody tr').at(0)?.findAll('.col-money').at(3)?.text()).toBe('$4,913.45')
    expect(wrapper.findAll('tbody tr').at(2)?.findAll('.col-money').at(1)?.text()).toBe('$82.13')
    expect(wrapper.findAll('tbody tr').at(2)?.findAll('.col-money').at(2)?.text()).toBe('$994.63')
    expect(wrapper.findAll('tbody tr').at(2)?.findAll('.col-money').at(3)?.text()).toBe('$164.25')
    expect(wrapper.find('.company-name').text()).toContain('Engineering')
  })

  it('renders only selected mixed-tax document columns', () => {
    const { props } = createPreviewProps('mixed')
    props.quotation.totalsConfig.mixedTaxColumns = ['taxRate', 'grossAmount']

    const wrapper = mount(QuotationPreview, {
      props,
      global: {
        plugins: [createAppI18n('en-US')],
      },
    })

    expect(wrapper.findAll('thead th').map((cell) => cell.text())).toEqual([
      'No',
      'Description',
      'Qty',
      'Unit',
      'Tax %',
      'Amountincl. tax',
    ])
    expect(wrapper.findAll('tbody tr').at(0)?.findAll('td')).toHaveLength(6)
    expect(wrapper.findAll('tbody tr').at(0)?.text()).not.toContain('$4,913.45')
    expect(wrapper.findAll('tbody tr').at(0)?.text()).not.toContain('$82.13')
    const tableStyle = wrapper.get('.quotation-table').attributes('style')
    expect(tableStyle).toContain('--mixed-tax-column-width: 58px')
    expect(tableStyle).toContain('--mixed-money-column-width: 124px')
  })

  it('shows calculated prices for child and grandchild preview rows', () => {
    const { props } = createPreviewProps('single')
    props.quotation.majorItems = [
      {
        id: 'major-1',
        name: 'Assembly package',
        description: '',
        quantity: 1,
        quantityUnit: 'LOT',
        unitCost: 0,
        costCurrency: 'USD',
        children: [
          {
            id: 'sub-1',
            name: 'Valve subassembly',
            description: '',
            quantity: 2,
            quantityUnit: 'EA',
            unitCost: 0,
            costCurrency: 'USD',
            children: [
              {
                id: 'detail-1',
                name: 'Valve body',
                description: '',
                quantity: 3,
                quantityUnit: 'EA',
                unitCost: 100,
                costCurrency: 'USD',
                markupRate: 20,
                children: [],
              },
            ],
          },
        ],
      },
    ]
    props.quotation.totalsConfig.globalMarkupRate = 0
    props.summaries = props.quotation.majorItems.map((item) =>
      calculateMajorItemSummary(item as QuotationItem, props.quotation.totalsConfig, props.quotation.exchangeRates),
    )
    props.totals = calculateQuotationTotals(
      props.quotation.majorItems,
      props.quotation.totalsConfig,
      props.quotation.exchangeRates,
    )
    const wrapper = mount(QuotationPreview, {
      props,
      global: {
        plugins: [createAppI18n('en-US')],
      },
    })

    const rows = wrapper.findAll('tbody tr')

    expect(rows.at(0)?.findAll('.col-money').map((cell) => cell.text())).toEqual(['$720.00', '$720.00'])
    expect(rows.at(1)?.findAll('.col-money').map((cell) => cell.text())).toEqual(['$360.00', '$720.00'])
    expect(rows.at(2)?.findAll('.col-money').map((cell) => cell.text())).toEqual(['$120.00', '$360.00'])
  })

  it('uses summary-only table styling when output shows level one items only', () => {
    const { props } = createPreviewProps('single')
    props.quotation.outputSettings = {
      itemDetailLevel: 1,
    }

    const wrapper = mount(QuotationPreview, {
      props,
      global: {
        plugins: [createAppI18n('en-US')],
      },
    })

    const table = wrapper.get('.quotation-table')
    expect(table.classes()).toContain('table-summary-only')
    expect(wrapper.findAll('tbody tr')).toHaveLength(1)
    expect(wrapper.get('tbody tr').classes()).toContain('row-level-1')
  })

  it('uses summary-only table styling when imported rows are already all top-level', () => {
    const { props } = createPreviewProps('single')
    props.quotation.outputSettings = {
      itemDetailLevel: 3,
    }
    props.quotation.majorItems = [
      {
        id: 'major-1',
        name: 'Imported pump',
        description: '',
        quantity: 1,
        quantityUnit: 'EA',
        unitCost: 120,
        costCurrency: 'USD',
        children: [],
      },
      {
        id: 'major-2',
        name: 'Imported service',
        description: '',
        quantity: 2,
        quantityUnit: 'DAY',
        unitCost: 80,
        costCurrency: 'USD',
        children: [],
      },
    ]
    props.summaries = props.quotation.majorItems.map((item) =>
      calculateMajorItemSummary(item as QuotationItem, props.quotation.totalsConfig, props.quotation.exchangeRates),
    )
    props.totals = calculateQuotationTotals(
      props.quotation.majorItems,
      props.quotation.totalsConfig,
      props.quotation.exchangeRates,
    )

    const wrapper = mount(QuotationPreview, {
      props,
      global: {
        plugins: [createAppI18n('en-US')],
      },
    })

    const table = wrapper.get('.quotation-table')
    expect(table.classes()).toContain('table-summary-only')
    expect(wrapper.findAll('tbody tr')).toHaveLength(2)
    expect(wrapper.findAll('tbody tr').every((row) => row.classes().includes('row-level-1'))).toBe(true)
  })

  it('shows mixed-tax row tax for grouped quotation items', () => {
    const { props } = createPreviewProps('mixed')
    props.quotation.majorItems = [
      {
        id: 'major-1',
        name: 'Legacy package',
        description: '',
        quantity: 1,
        quantityUnit: 'EA',
        unitCost: 0,
        costCurrency: 'USD',
        taxClassId: 'vat-13',
        children: [
          {
            id: 'sub-1',
            name: 'Taxed line',
            description: '',
            quantity: 1,
            quantityUnit: 'EA',
            unitCost: 100,
            costCurrency: 'USD',
            taxClassId: 'vat-13',
            children: [],
          },
        ],
      },
    ]
    props.quotation.totalsConfig.globalMarkupRate = 0
    props.summaries = props.quotation.majorItems.map((item) =>
      calculateMajorItemSummary(item as QuotationItem, props.quotation.totalsConfig, props.quotation.exchangeRates),
    )
    props.totals = calculateQuotationTotals(
      props.quotation.majorItems,
      props.quotation.totalsConfig,
      props.quotation.exchangeRates,
    )

    const wrapper = mount(QuotationPreview, {
      props,
      global: {
        plugins: [createAppI18n('en-US')],
      },
    })

    expect(props.totals.taxAmount).toBe(13)
    expect(wrapper.findAll('tbody tr').at(0)?.findAll('.col-money').at(3)?.text()).toBe('$13.00')
  })

  it('renders extra charges after tax in the totals block', () => {
    const { props } = createPreviewProps('single')
    props.quotation.totalsConfig.extraCharges = [
      { id: 'shipping', label: 'Shipping', amount: 150 },
      { id: 'misc', label: 'Misc', amount: 25 },
    ]
    props.totals = calculateQuotationTotals(
      props.quotation.majorItems,
      props.quotation.totalsConfig,
      props.quotation.exchangeRates,
    )
    const wrapper = mount(QuotationPreview, {
      props,
      global: {
        plugins: [createAppI18n('en-US')],
      },
    })

    const totalsText = wrapper.find('.totals-box').text()
    expect(totalsText).toContain('Shipping')
    expect(totalsText).toContain('$150.00')
    expect(totalsText).toContain('Misc')
    expect(totalsText).toContain('$25.00')
    expect(totalsText).toContain('$43,445.77')
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
    taxMode,
    taxClasses,
    defaultTaxClassId: 'vat-13',
  }
  const quotation: QuotationDraft = {
    id: 'quotation-1',
    templateId: 'legacy',
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
