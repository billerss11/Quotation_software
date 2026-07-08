// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { defineComponent, nextTick } from 'vue'
import { describe, expect, it } from 'vitest'

import { createAppI18n } from '@/shared/i18n/createAppI18n'

import CalculationExplanationDialog from './CalculationExplanationDialog.vue'
import type { QuotationItem, TotalsConfig } from '../types'

describe('CalculationExplanationDialog', () => {
  it('emits the clicked tree item id', async () => {
    const wrapper = mount(CalculationExplanationDialog, {
      props: createProps(),
      global: createMountOptions(),
    })

    await wrapper
      .get('[data-calculation-explanation-tree-item-id="child"]')
      .trigger('click')

    expect(wrapper.emitted('selectItem')).toEqual([['child']])
  })

  it('renders the selected item when selectedItemId changes', async () => {
    const wrapper = mount(CalculationExplanationDialog, {
      props: createProps(),
      global: createMountOptions(),
    })

    await wrapper.setProps({ selectedItemId: 'child' })

    expect(wrapper.get('.explanation-header h3').text()).toBe('1.1 Pump body')
    expect(wrapper.get('[data-calculation-explanation-tree-item-id="child"]').classes()).toContain('tree-node-selected')
  })

  it('keeps the resized tree width when the selected item changes', async () => {
    const wrapper = mount(CalculationExplanationDialog, {
      props: createProps(),
      global: createMountOptions(),
    })

    await wrapper
      .get('[data-calculation-explanation-tree-resize-handle]')
      .trigger('keydown', { key: 'ArrowRight' })
    await nextTick()

    expect(wrapper.get('.explanation-tree').attributes('style')).toContain('width: 274px')

    await wrapper.setProps({ selectedItemId: 'child' })

    expect(wrapper.get('.explanation-tree').attributes('style')).toContain('width: 274px')
  })

  it('renders calculation steps with a dedicated result value', () => {
    const wrapper = mount(CalculationExplanationDialog, {
      props: createProps({ selectedItemId: 'child' }),
      global: createMountOptions(),
    })

    const firstStep = wrapper.get('.formula-step')

    expect(firstStep.get('.step-label').text()).toBe('Converted unit cost')
    expect(firstStep.get('.step-formula').text()).toContain('FX')
    expect(firstStep.get('.step-result').text()).toBe('$100.00')
  })

  it('groups calculation steps into compact unit and total flow lanes', () => {
    const wrapper = mount(CalculationExplanationDialog, {
      props: createProps({ selectedItemId: 'child' }),
      global: createMountOptions(),
    })

    const lanes = wrapper.findAll('.flow-lane')
    const unitStepLabels = lanes[0]!.findAll('.flow-step').map((step) => step.get('.step-label').text())
    const totalStepLabels = lanes[1]!.findAll('.flow-step').map((step) => step.get('.step-label').text())

    expect(lanes).toHaveLength(2)
    expect(lanes[0]!.attributes('data-flow-lane')).toBe('unit')
    expect(lanes[1]!.attributes('data-flow-lane')).toBe('total')
    expect(unitStepLabels).toContain('Unit price with tax')
    expect(totalStepLabels).toContain('Total with tax')
    expect(totalStepLabels).toContain('Cost of sales')
  })
})

function createMountOptions() {
  return {
    plugins: [createAppI18n('en-US')],
    stubs: {
      Dialog: defineComponent({
        name: 'Dialog',
        props: {
          visible: Boolean,
          header: String,
        },
        template: '<section v-if="visible"><slot /></section>',
      }),
    },
  }
}

function createProps(overrides: Partial<InstanceType<typeof CalculationExplanationDialog>['$props']> = {}) {
  return {
    visible: true,
    item: createItem({
      id: 'root',
      name: 'Pump package',
      quantity: 1,
      children: [
        createItem({
          id: 'child',
          name: 'Pump body',
          quantity: 2,
          unitCost: 100,
        }),
      ],
    }),
    itemNumber: '1',
    selectedItemId: 'root',
    currency: 'USD',
    globalMarkupRate: 10,
    totalsConfig: createTotalsConfig(),
    exchangeRates: { USD: 1 },
    ...overrides,
  }
}

function createItem(overrides: Partial<QuotationItem> = {}): QuotationItem {
  return {
    id: 'item',
    name: 'Item',
    description: '',
    quantity: 1,
    quantityUnit: 'pc',
    unitCost: 0,
    costCurrency: 'USD',
    children: [],
    ...overrides,
  }
}

function createTotalsConfig(): TotalsConfig {
  return {
    globalMarkupRate: 10,
    discountMode: 'percentage',
    discountValue: 0,
    taxMode: 'mixed',
    defaultTaxClassId: 'tax-default',
    taxClasses: [{ id: 'tax-default', label: '13%', rate: 13 }],
  }
}
