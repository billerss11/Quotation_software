// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'

import { createAppI18n } from '@/shared/i18n/createAppI18n'

import type { QuotationItem, TotalsConfig } from '../types'
import LineItemsTable from './LineItemsTable.vue'

describe('LineItemsTable summary mode', () => {
  it('keeps the global control and every line item card synchronized', async () => {
    const wrapper = mount(LineItemsTable, {
      props: createProps(),
      global: createMountOptions(),
    })

    const globalControl = wrapper.get('[data-summary-mode-scope="global"]')
    const totalsButton = globalControl.get('[data-summary-mode="totals"]')
    const unitButton = globalControl.get('[data-summary-mode="unit"]')

    expect(globalControl.attributes('aria-label')).toBe('Switch all line item summary views')
    expect(totalsButton.attributes('aria-pressed')).toBe('true')
    expect(getCardSummaryModes(wrapper)).toEqual(['totals', 'totals'])

    await unitButton.trigger('click')

    expect(unitButton.attributes('aria-pressed')).toBe('true')
    expect(getCardSummaryModes(wrapper)).toEqual(['unit', 'unit'])

    await wrapper.findAll('[data-card-summary-mode-request="totals"]')[0]!.trigger('click')

    expect(totalsButton.attributes('aria-pressed')).toBe('true')
    expect(getCardSummaryModes(wrapper)).toEqual(['totals', 'totals'])

    await unitButton.trigger('click')
    await wrapper.setProps({ items: createItems(3) })

    expect(getCardSummaryModes(wrapper)).toEqual(['unit', 'unit', 'unit'])
  })

  it('hides the global control when there are no line item cards', () => {
    const wrapper = mount(LineItemsTable, {
      props: createProps({ items: [] }),
      global: createMountOptions(),
    })

    expect(wrapper.find('[data-summary-mode-scope="global"]').exists()).toBe(false)
  })
})

function getCardSummaryModes(wrapper: ReturnType<typeof mount>) {
  return wrapper.findAll('[data-line-item-card]').map((card) => card.attributes('data-card-summary-mode'))
}

function createMountOptions() {
  return {
    plugins: [createAppI18n('en-US')],
    stubs: {
      Button: defineComponent({
        name: 'Button',
        props: {
          label: String,
        },
        emits: ['click'],
        template: '<button v-bind="$attrs" type="button" @click="$emit(\'click\')">{{ label }}</button>',
      }),
      Select: defineComponent({
        name: 'Select',
        props: {
          modelValue: String,
          options: Array,
        },
        emits: ['update:modelValue'],
        template: '<select v-bind="$attrs" :value="modelValue"><option v-for="option in options" :key="String(option)" :value="option">{{ option }}</option></select>',
      }),
      LineItemCard: defineComponent({
        name: 'LineItemCard',
        props: {
          item: {
            type: Object,
            required: true,
          },
          summaryMode: {
            type: String,
            required: true,
          },
        },
        emits: ['setSummaryMode'],
        template: `
          <article
            data-line-item-card
            :data-item-id="item.id"
            :data-card-summary-mode="summaryMode"
          >
            <button
              data-card-summary-mode-request="totals"
              type="button"
              @click="$emit('setSummaryMode', 'totals')"
            />
            <button
              data-card-summary-mode-request="unit"
              type="button"
              @click="$emit('setSummaryMode', 'unit')"
            />
          </article>
        `,
      }),
      SectionHeaderRow: true,
      CalculationSheetDialog: true,
    },
  }
}

function createProps(overrides: Partial<InstanceType<typeof LineItemsTable>['$props']> = {}) {
  return {
    items: createItems(2),
    currency: 'USD',
    grandTotal: 0,
    lineItemEntryMode: 'detailed' as const,
    globalMarkupRate: 10,
    totalsConfig: createTotalsConfig(),
    exchangeRates: { USD: 1 },
    costCurrencyOptions: ['USD'],
    quotationCurrencyOptions: ['USD'],
    ...overrides,
  }
}

function createItems(count: number): QuotationItem[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `item-${index + 1}`,
    name: `Item ${index + 1}`,
    description: '',
    quantity: 1,
    quantityUnit: 'EA',
    unitCost: 100,
    costCurrency: 'USD',
    children: [],
  }))
}

function createTotalsConfig(): TotalsConfig {
  return {
    globalMarkupRate: 10,
    taxMode: 'single',
    defaultTaxClassId: 'tax-default',
    taxClasses: [{ id: 'tax-default', label: '13%', rate: 13 }],
  }
}
