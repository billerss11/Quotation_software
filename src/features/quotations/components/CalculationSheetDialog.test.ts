// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createAppI18n } from '@/shared/i18n/createAppI18n'

import CalculationSheetDialog from './CalculationSheetDialog.vue'
import type { QuotationItem, TotalsConfig } from '../types'

const runtimeMock = vi.hoisted(() => ({
  saveLineItemsCsvFile: vi.fn(),
}))

vi.mock('@/shared/runtime/quotationRuntime', () => ({
  getQuotationRuntime: () => runtimeMock,
}))

describe('CalculationSheetDialog', () => {
  beforeEach(() => {
    runtimeMock.saveLineItemsCsvFile.mockReset()
    runtimeMock.saveLineItemsCsvFile.mockResolvedValue({
      canceled: false,
      filePath: 'calculation-sheet.csv',
      mode: 'download',
    })
  })

  it('shows unit and total calculation columns in one sheet', () => {
    const wrapper = mount(CalculationSheetDialog, {
      props: createProps(),
      global: createMountOptions(),
    })

    expect(wrapper.text()).toContain('Calculation Sheet - Item 1 Pump package')
    expect(wrapper.text()).toContain('Unit cost')
    expect(wrapper.text()).toContain('Total cost')
    expect(wrapper.text()).toContain('Unit markup')
    expect(wrapper.text()).toContain('Total markup')
    expect(wrapper.text()).toContain('Unit tax')
    expect(wrapper.text()).toContain('Total tax')
    expect(wrapper.text()).toContain('$120.00')
    expect(wrapper.text()).toContain('$240.00')
  })

  it('groups calculation columns into inputs, unit, and total sections', () => {
    const wrapper = mount(CalculationSheetDialog, {
      props: createProps(),
      global: createMountOptions(),
    })
    const groups = wrapper.findAll('.sheet-group-row th')
    const columns = wrapper.findAll('.sheet-column-row th').map((header) => header.text())

    expect(groups.map((group) => group.text())).toEqual(['Item', 'Inputs', 'Unit', 'Total'])
    expect(groups.map((group) => group.attributes('colspan'))).toEqual(['2', '7', '5', '5'])
    expect(columns).toEqual([
      '#',
      'Name',
      'Qty',
      'Unit',
      'Cost currency',
      'Markup rate',
      'Cost/Sales %',
      'Tax class',
      'Tax rate',
      'Unit cost',
      'Unit markup',
      'Unit price',
      'Unit tax',
      'Unit total',
      'Total cost',
      'Total markup',
      'Subtotal excl. tax',
      'Total tax',
      'Total total',
    ])
  })

  it('hides the tax class column in single tax mode', () => {
    const wrapper = mount(CalculationSheetDialog, {
      props: createProps({
        totalsConfig: {
          ...createMixedTaxConfig(),
          taxMode: 'single',
        },
      }),
      global: createMountOptions(),
    })

    expect(wrapper.text()).not.toContain('Tax class')
    expect(wrapper.text()).toContain('Tax rate')
  })

  it('shows tax class details in mixed tax mode', () => {
    const wrapper = mount(CalculationSheetDialog, {
      props: createProps(),
      global: createMountOptions(),
    })

    expect(wrapper.text()).toContain('Tax class')
    expect(wrapper.text()).toContain('Service')
    expect(wrapper.text()).toContain('Parts')
  })

  it('shows only the cost currency in the FX column', () => {
    const wrapper = mount(CalculationSheetDialog, {
      props: createProps(),
      global: createMountOptions(),
    })

    expect(wrapper.text()).toContain('USD')
    expect(wrapper.text()).not.toContain('USD rate 1')
  })

  it('shows Mix for group rows with mixed descendant cost currencies', () => {
    const wrapper = mount(CalculationSheetDialog, {
      props: createProps({
        item: createParentItem({
          children: [
            createLeafItem({ id: 'usd-child', name: 'USD child', costCurrency: 'USD' }),
            createLeafItem({ id: 'cny-child', name: 'CNY child', costCurrency: 'CNY' }),
          ],
        }),
        exchangeRates: { USD: 1, CNY: 0.14 },
      }),
      global: createMountOptions(),
    })

    const rootCells = wrapper.findAll('tbody tr')[0]?.findAll('td').map((cell) => cell.text()) ?? []

    expect(rootCells).toContain('Mix')
  })

  it('labels group markup as an effective rate', () => {
    const wrapper = mount(CalculationSheetDialog, {
      props: createProps(),
      global: createMountOptions(),
    })
    const rootCells = wrapper.findAll('tbody tr')[0]?.findAll('td').map((cell) => cell.text()) ?? []
    const normalizedRootText = rootCells.join(' ').replace(/\s+/g, ' ')

    expect(normalizedRootText).toMatch(/Effective\s*10%/)
    expect(normalizedRootText).not.toContain('Global 10%')
  })

  it('exports the visible calculation sheet as flattened CSV', async () => {
    const wrapper = mount(CalculationSheetDialog, {
      props: createProps(),
      global: createMountOptions(),
    })

    await wrapper.find('[data-calculation-sheet-export-csv]').trigger('click')

    expect(runtimeMock.saveLineItemsCsvFile).toHaveBeenCalledTimes(1)
    const payload = runtimeMock.saveLineItemsCsvFile.mock.calls[0]?.[0]

    expect(payload.defaultPath).toBe('calculation-sheet-item-1.csv')
    expect(payload.content).toContain('Item - #,Item - Name,Inputs - Qty')
    expect(payload.content).toContain('Unit - Cost (USD)')
    expect(payload.content).toContain('Total - Total (USD)')
  })

  it('can show all root items in a quotation-level sheet', () => {
    const wrapper = mount(CalculationSheetDialog, {
      props: createProps({
        item: undefined,
        itemNumber: undefined,
        items: [createParentItem(), createParentItem({ id: 'item-2', name: 'Valve package' })],
        title: 'Calculation Sheet - Quotation Q-1001',
      }),
      global: createMountOptions(),
    })

    expect(wrapper.text()).toContain('Calculation Sheet - Quotation Q-1001')
    expect(wrapper.findAll('.sheet-number').map((cell) => cell.text())).toContain('1')
    expect(wrapper.findAll('.sheet-number').map((cell) => cell.text())).toContain('2')
    expect(wrapper.text()).toContain('Pump package')
    expect(wrapper.text()).toContain('Valve package')
  })

  it('shows quotation-level extra charges and quote total', () => {
    const wrapper = mount(CalculationSheetDialog, {
      props: createProps({
        item: undefined,
        itemNumber: undefined,
        items: [createLeafItem({ id: 'root-1', name: 'Root one', unitCost: 100 })],
        title: 'Calculation Sheet - Quotation Q-1001',
        totalsConfig: {
          ...createMixedTaxConfig(),
          extraCharges: [{ id: 'shipping', label: 'Shipping', amount: 25 }],
        },
      }),
      global: createMountOptions(),
    })

    expect(wrapper.text()).toContain('Line items total')
    expect(wrapper.text()).toContain('Extra charges')
    expect(wrapper.text()).toContain('Quote total')
    expect(wrapper.text()).toContain('$124.30')
    expect(wrapper.text()).toContain('$25.00')
    expect(wrapper.text()).toContain('$149.30')
  })

  it('does not show quote-only totals for an individual item sheet', () => {
    const wrapper = mount(CalculationSheetDialog, {
      props: createProps({
        totalsConfig: {
          ...createMixedTaxConfig(),
          extraCharges: [{ id: 'shipping', label: 'Shipping', amount: 25 }],
        },
      }),
      global: createMountOptions(),
    })

    expect(wrapper.text()).not.toContain('Line items total')
    expect(wrapper.text()).not.toContain('Extra charges')
    expect(wrapper.text()).not.toContain('Quote total')
  })

  it('styles every depth-one item as a root row in quotation-level sheets', () => {
    const wrapper = mount(CalculationSheetDialog, {
      props: createProps({
        item: undefined,
        itemNumber: undefined,
        items: [
          createLeafItem({ id: 'root-1', name: 'Root one' }),
          createParentItem({ id: 'root-2', name: 'Root two' }),
        ],
        title: 'Calculation Sheet - Quotation Q-1001',
      }),
      global: createMountOptions(),
    })

    const rows = wrapper.findAll('tbody tr')

    expect(rows[0]?.classes()).toContain('sheet-row-root')
    expect(rows[1]?.classes()).toContain('sheet-row-root')
    expect(rows[1]?.classes()).not.toContain('sheet-row-group')
    expect(rows[2]?.classes()).not.toContain('sheet-row-root')
  })

})

function createMountOptions() {
  return {
    plugins: [createAppI18n('en-US')],
    stubs: {
      Button: defineComponent({
        name: 'Button',
        props: {
          label: String,
          disabled: Boolean,
        },
        emits: ['click'],
        template: '<button v-bind="$attrs" :disabled="disabled" @click="$emit(\'click\')">{{ label }}</button>',
      }),
      Dialog: defineComponent({
        name: 'Dialog',
        props: {
          visible: Boolean,
        },
        emits: ['update:visible'],
        template: '<section v-if="visible" class="dialog-stub"><slot name="header" /><slot /></section>',
      }),
    },
  }
}

function createProps(overrides: Partial<InstanceType<typeof CalculationSheetDialog>['$props']> = {}) {
  return {
    visible: true,
    item: createParentItem(),
    itemNumber: '1',
    currency: 'USD',
    globalMarkupRate: 10,
    exchangeRates: { USD: 1 },
    totalsConfig: createMixedTaxConfig(),
    ...overrides,
  }
}

function createParentItem(overrides: Partial<QuotationItem> = {}): QuotationItem {
  return {
    id: 'item-1',
    name: 'Pump package',
    description: '',
    quantity: 1,
    quantityUnit: 'set',
    unitCost: 0,
    costCurrency: 'USD',
    taxClassId: 'service',
    children: [
      {
        id: 'item-1-1',
        name: 'Motor',
        description: '',
        quantity: 2,
        quantityUnit: 'pc',
        unitCost: 120,
        costCurrency: 'USD',
        children: [],
        taxClassId: 'parts',
      },
      {
        id: 'item-1-2',
        name: 'Labor',
        description: '',
        quantity: 1,
        quantityUnit: 'hour',
        unitCost: 80,
        costCurrency: 'USD',
        children: [],
        taxClassId: 'service',
      },
    ],
    ...overrides,
  }
}

function createLeafItem(overrides: Partial<QuotationItem> = {}): QuotationItem {
  return {
    id: 'leaf',
    name: 'Leaf',
    description: '',
    quantity: 1,
    quantityUnit: 'EA',
    unitCost: 100,
    costCurrency: 'USD',
    children: [],
    taxClassId: 'parts',
    ...overrides,
  }
}

function createMixedTaxConfig(): TotalsConfig {
  return {
    globalMarkupRate: 10,
    taxMode: 'mixed',
    defaultTaxClassId: 'service',
    taxClasses: [
      { id: 'service', label: 'Service', rate: 6 },
      { id: 'parts', label: 'Parts', rate: 13 },
    ],
  }
}
