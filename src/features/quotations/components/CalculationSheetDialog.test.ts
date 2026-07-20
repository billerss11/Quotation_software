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

  it('shows one amount group at a time and switches between total and unit values', async () => {
    const wrapper = mount(CalculationSheetDialog, {
      props: createProps(),
      global: createMountOptions(),
    })
    const totalButton = wrapper.get('[data-calculation-sheet-amount-mode="totals"]')
    const unitButton = wrapper.get('[data-calculation-sheet-amount-mode="unit"]')

    expect(wrapper.text()).toContain('Calculation Sheet - Item 1 Pump package')
    expect(wrapper.get('[role="group"][aria-label="Switch calculation amount view"]')).toBeTruthy()
    expect(totalButton.attributes('aria-pressed')).toBe('true')
    expect(unitButton.attributes('aria-pressed')).toBe('false')
    expect(getColumnHeaders(wrapper)).toEqual([
      '#', 'Name', 'Qty', 'Unit', 'Cost currency', 'Markup rate', 'Cost/Sales %', 'Tax class', 'Tax rate',
      'Total cost', 'Total markup', 'Subtotal excl. tax', 'Total tax', 'Total total',
    ])
    expect(wrapper.text()).toContain('$240.00')

    await unitButton.trigger('click')

    expect(totalButton.attributes('aria-pressed')).toBe('false')
    expect(unitButton.attributes('aria-pressed')).toBe('true')
    expect(getColumnHeaders(wrapper)).toEqual([
      '#', 'Name', 'Qty', 'Unit', 'Cost currency', 'Markup rate', 'Cost/Sales %', 'Tax class', 'Tax rate',
      'Unit cost', 'Unit markup', 'Unit price', 'Unit tax', 'Unit total',
    ])
    expect(wrapper.text()).toContain('$120.00')
  })

  it('keeps amount headers and cells mounted without constructing formatters while switching', async () => {
    const wrapper = mount(CalculationSheetDialog, {
      props: createProps(),
      global: createMountOptions(),
    })
    const originalHeaders = wrapper.findAll('.sheet-column-row th').slice(-5).map((header) => header.element)
    const originalCells = wrapper.findAll('tbody tr')[0]?.findAll('.sheet-money').map((cell) => cell.element) ?? []
    const numberFormatSpy = vi.spyOn(Intl, 'NumberFormat')

    try {
      await wrapper.get('[data-calculation-sheet-amount-mode="unit"]').trigger('click')

      const unitHeaders = wrapper.findAll('.sheet-column-row th').slice(-5).map((header) => header.element)
      const unitCells = wrapper.findAll('tbody tr')[0]?.findAll('.sheet-money').map((cell) => cell.element) ?? []

      expect(unitHeaders).toHaveLength(5)
      expect(unitCells).toHaveLength(5)
      unitHeaders.forEach((header, index) => expect(header).toBe(originalHeaders[index]))
      unitCells.forEach((cell, index) => expect(cell).toBe(originalCells[index]))

      await wrapper.get('[data-calculation-sheet-amount-mode="totals"]').trigger('click')

      const totalHeaders = wrapper.findAll('.sheet-column-row th').slice(-5).map((header) => header.element)
      const totalCells = wrapper.findAll('tbody tr')[0]?.findAll('.sheet-money').map((cell) => cell.element) ?? []

      totalHeaders.forEach((header, index) => expect(header).toBe(originalHeaders[index]))
      totalCells.forEach((cell, index) => expect(cell).toBe(originalCells[index]))
      expect(numberFormatSpy).not.toHaveBeenCalled()
    } finally {
      numberFormatSpy.mockRestore()
    }
  })

  it('keeps translated headers, values, and ARIA state correct in Simplified Chinese', async () => {
    const wrapper = mount(CalculationSheetDialog, {
      props: createProps(),
      global: createMountOptions('zh-CN'),
    })
    const totalButton = wrapper.get('[data-calculation-sheet-amount-mode="totals"]')
    const unitButton = wrapper.get('[data-calculation-sheet-amount-mode="unit"]')

    expect(totalButton.attributes('aria-pressed')).toBe('true')
    expect(wrapper.text()).toContain('240.00')

    await unitButton.trigger('click')

    expect(totalButton.attributes('aria-pressed')).toBe('false')
    expect(unitButton.attributes('aria-pressed')).toBe('true')
    expect(getColumnHeaders(wrapper)).toEqual([
      '#', '名称', '数量', '单位', '成本币种', '加价率', '成本/销售 %', '税率类别', '税率',
      '单位成本', '单位加价', '单价', '单位税额', '单位合计',
    ])
    expect(wrapper.text()).toContain('120.00')
  })

  it('batches repeated column hover events and measures geometry once per frame', () => {
    let scheduledFrame: FrameRequestCallback | undefined
    const requestFrameSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      scheduledFrame = callback
      return 41
    })
    const cancelFrameSpy = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined)
    const wrapper = mount(CalculationSheetDialog, {
      props: createProps(),
      global: createMountOptions(),
    })

    try {
      const table = wrapper.get('[data-calculation-sheet-table="root"]').element as HTMLTableElement
      const target = wrapper.get('.sheet-column-row [data-sheet-column-index="2"]').element as HTMLElement
      const highlight = wrapper.get('.sheet-column-hover-indicator').element as HTMLDivElement
      const tableRectSpy = vi.spyOn(table, 'getBoundingClientRect').mockReturnValue(createDomRect({ left: 10 }))
      const targetRectSpy = vi.spyOn(target, 'getBoundingClientRect').mockReturnValue(createDomRect({ left: 90, width: 120 }))
      const scrollHeightSpy = vi.fn(() => 640)
      Object.defineProperty(table, 'scrollHeight', { configurable: true, get: scrollHeightSpy })

      target.dispatchEvent(new Event('pointerover', { bubbles: true }))
      target.dispatchEvent(new Event('pointerover', { bubbles: true }))
      target.dispatchEvent(new Event('pointerover', { bubbles: true }))

      expect(requestFrameSpy).toHaveBeenCalledTimes(1)
      expect(tableRectSpy).not.toHaveBeenCalled()
      expect(targetRectSpy).not.toHaveBeenCalled()

      scheduledFrame?.(16)

      expect(tableRectSpy).toHaveBeenCalledTimes(1)
      expect(targetRectSpy).toHaveBeenCalledTimes(1)
      expect(scrollHeightSpy).toHaveBeenCalledTimes(1)
      expect(highlight.hidden).toBe(false)
      expect(highlight.style.transform).toBe('translateX(80px)')
      expect(highlight.style.width).toBe('120px')
      expect(highlight.style.height).toBe('640px')

      target.dispatchEvent(new Event('pointerover', { bubbles: true }))

      expect(requestFrameSpy).toHaveBeenCalledTimes(1)
      expect(tableRectSpy).toHaveBeenCalledTimes(1)
      expect(targetRectSpy).toHaveBeenCalledTimes(1)
    } finally {
      wrapper.unmount()
      requestFrameSpy.mockRestore()
      cancelFrameSpy.mockRestore()
    }
  })

  it('cancels pending column hover work when hidden and unmounted', async () => {
    let nextFrameId = 50
    const requestFrameSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => nextFrameId++)
    const cancelFrameSpy = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined)
    const hiddenWrapper = mount(CalculationSheetDialog, {
      props: createProps(),
      global: createMountOptions(),
    })

    try {
      hiddenWrapper.get('.sheet-column-row [data-sheet-column-index="2"]').element
        .dispatchEvent(new Event('pointerover', { bubbles: true }))
      await hiddenWrapper.setProps({ visible: false })

      expect(cancelFrameSpy).toHaveBeenCalledWith(50)

      const unmountedWrapper = mount(CalculationSheetDialog, {
        props: createProps(),
        global: createMountOptions(),
      })
      unmountedWrapper.get('.sheet-column-row [data-sheet-column-index="2"]').element
        .dispatchEvent(new Event('pointerover', { bubbles: true }))
      unmountedWrapper.unmount()

      expect(cancelFrameSpy).toHaveBeenCalledWith(51)
    } finally {
      hiddenWrapper.unmount()
      requestFrameSpy.mockRestore()
      cancelFrameSpy.mockRestore()
    }
  })

  it('renders every small-sheet row without virtualization', () => {
    const wrapper = mount(CalculationSheetDialog, {
      props: createProps(),
      global: createMountOptions(),
    })

    expect(wrapper.get('[data-calculation-sheet-table="root"]').attributes('aria-rowcount')).toBe('5')
    expect(wrapper.findAll('tbody tr.sheet-row')).toHaveLength(3)
    expect(wrapper.find('.sheet-virtual-spacer-row').exists()).toBe(false)
    expect(wrapper.findAll('tbody tr.sheet-row').map((row) => row.attributes('aria-rowindex'))).toEqual([
      '3', '4', '5',
    ])
  })

  it('virtualizes large sheets, updates the rendered range, and preserves scroll while switching', async () => {
    const wrapper = mount(CalculationSheetDialog, {
      props: createProps({ item: createLargeParentItem(250) }),
      global: createMountOptions(),
    })
    const table = wrapper.get('[data-calculation-sheet-table="root"]')
    const scrollContainer = wrapper.get('.sheet-table-wrap')
    const initialRows = wrapper.findAll('tbody tr.sheet-row')
    const initialFirstIndex = Number(initialRows[0]?.attributes('data-index'))

    expect(table.attributes('aria-rowcount')).toBe('252')
    expect(initialRows.length).toBeLessThan(250)
    expect(initialRows.map((row) => row.text()).join(' ')).not.toContain('CSV row 250')
    expect(wrapper.findAll('.sheet-virtual-spacer-row').length).toBeGreaterThan(0)

    const scrollElement = scrollContainer.element as HTMLDivElement
    scrollElement.scrollTop = 4000
    await scrollContainer.trigger('scroll')
    await new Promise((resolve) => window.setTimeout(resolve, 0))
    await wrapper.vm.$nextTick()

    const scrolledRows = wrapper.findAll('tbody tr.sheet-row')
    const scrolledFirstIndex = Number(scrolledRows[0]?.attributes('data-index'))

    expect(scrolledFirstIndex).toBeGreaterThan(initialFirstIndex)
    expect(scrolledRows.some((row) => Number(row.attributes('aria-rowindex')) > 80)).toBe(true)

    await wrapper.get('[data-calculation-sheet-amount-mode="unit"]').trigger('click')

    expect(scrollElement.scrollTop).toBe(4000)
  })

  it('exports every row when only part of a large sheet is mounted', async () => {
    const wrapper = mount(CalculationSheetDialog, {
      props: createProps({ item: createLargeParentItem(250) }),
      global: createMountOptions(),
    })

    expect(wrapper.findAll('tbody tr.sheet-row').length).toBeLessThan(250)

    await wrapper.find('[data-calculation-sheet-export-csv]').trigger('click')

    const payload = runtimeMock.saveLineItemsCsvFile.mock.calls[0]?.[0]
    expect(payload.content).toContain('CSV row 250')
    expect(payload.content.split('\n')).toHaveLength(251)
  })

  it('groups calculation columns into item, inputs, and the active amount section', () => {
    const wrapper = mount(CalculationSheetDialog, {
      props: createProps(),
      global: createMountOptions(),
    })
    const groups = wrapper.findAll('.sheet-group-row th')
    const columns = wrapper.findAll('.sheet-column-row th').map((header) => header.text())

    expect(groups.map((group) => group.text())).toEqual(['Item', 'Inputs', 'Total'])
    expect(groups.map((group) => group.attributes('colspan'))).toEqual(['2', '7', '5'])
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

function getColumnHeaders(wrapper: ReturnType<typeof mount>) {
  return wrapper.findAll('.sheet-column-row th').map((header) => header.text())
}

function createMountOptions(locale: 'en-US' | 'zh-CN' = 'en-US') {
  return {
    plugins: [createAppI18n(locale)],
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

function createDomRect(overrides: Partial<DOMRect> = {}): DOMRect {
  return {
    bottom: 0,
    height: 0,
    left: 0,
    right: 0,
    top: 0,
    width: 0,
    x: 0,
    y: 0,
    toJSON: () => ({}),
    ...overrides,
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

function createLargeParentItem(rowCount: number): QuotationItem {
  return createParentItem({
    id: 'large-root',
    name: 'CSV row 1',
    children: Array.from({ length: rowCount - 1 }, (_, index) => createLeafItem({
      id: `large-child-${index + 2}`,
      name: `CSV row ${index + 2}`,
    })),
  })
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
