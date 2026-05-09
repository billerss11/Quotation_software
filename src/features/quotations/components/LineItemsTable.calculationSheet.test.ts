// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'

import { createAppI18n } from '@/shared/i18n/createAppI18n'

import LineItemsTable from './LineItemsTable.vue'
import type { QuotationItem, TotalsConfig } from '../types'

describe('LineItemsTable calculation sheet action', () => {
  it('opens a quotation-level calculation sheet for all root items', async () => {
    const wrapper = mount(LineItemsTable, {
      props: createProps(),
      global: createMountOptions(),
    })

    await wrapper.find('[data-calculation-sheet-action="quotation"]').trigger('click')

    const dialog = wrapper.find('[data-dialog-visible="true"]')

    expect(dialog.exists()).toBe(true)
    expect(dialog.attributes('data-dialog-title')).toBe('Calculation Sheet - Quotation Q-1001')
    expect(dialog.attributes('data-dialog-items')).toBe('2')
    expect(dialog.attributes('data-dialog-export-file')).toBe('Q-1001-calculation-sheet.csv')
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
        },
        emits: ['click'],
        template: '<button v-bind="$attrs" @click="$emit(\'click\')">{{ label }}</button>',
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
      LineItemCard: true,
      SectionHeaderRow: true,
      CalculationSheetDialog: defineComponent({
        name: 'CalculationSheetDialog',
        props: {
          visible: Boolean,
          title: String,
          items: Array,
          exportFileName: String,
        },
        template: `
          <div
            :data-dialog-visible="String(visible)"
            :data-dialog-title="title"
            :data-dialog-items="items?.length ?? 0"
            :data-dialog-export-file="exportFileName"
          />
        `,
      }),
    },
  }
}

function createProps(overrides: Partial<InstanceType<typeof LineItemsTable>['$props']> = {}) {
  return {
    items: [createItem('item-1', 'Pump package'), createItem('item-2', 'Valve package')],
    currency: 'USD',
    grandTotal: 0,
    lineItemEntryMode: 'detailed' as const,
    globalMarkupRate: 10,
    totalsConfig: createTotalsConfig(),
    exchangeRates: { USD: 1 },
    costCurrencyOptions: ['USD'],
    quotationCurrencyOptions: ['USD'],
    quotationNumber: 'Q-1001',
    ...overrides,
  }
}

function createItem(id: string, name: string): QuotationItem {
  return {
    id,
    name,
    description: '',
    quantity: 1,
    quantityUnit: 'EA',
    unitCost: 100,
    costCurrency: 'USD',
    children: [],
    taxClassId: 'standard',
  }
}

function createTotalsConfig(): TotalsConfig {
  return {
    globalMarkupRate: 10,
    discountMode: 'percentage',
    discountValue: 0,
    taxMode: 'mixed',
    defaultTaxClassId: 'standard',
    taxClasses: [
      {
        id: 'standard',
        label: 'Standard',
        rate: 13,
      },
    ],
  }
}
