// @vitest-environment jsdom

import { DOMWrapper, enableAutoUnmount, mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import { defineComponent, nextTick, reactive } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createAppI18n } from '@/shared/i18n/createAppI18n'

import LineItemsTable from './LineItemsTable.vue'
import type { QuotationItem, TotalsConfig } from '../types'

enableAutoUnmount(afterEach)

describe('LineItemsTable expansion state', () => {
  it('shows a non-dismissible warning while expanding more than 80 items', async () => {
    const wrapper = mount(LineItemsTable, {
      props: createProps({ items: createItems(81) }),
      global: createMountOptions(),
    })

    const expandButton = await getExpansionAction(wrapper, 'Expand all')
    await expandButton.trigger('click')

    const warning = document.body.querySelector<HTMLElement>('.expand-all-window')
    expect(warning).not.toBeNull()
    expect(warning?.getAttribute('role')).toBe('status')
    expect(warning?.getAttribute('aria-live')).toBe('polite')
    expect(warning?.querySelector('.expand-all-title')?.textContent?.trim()).toBe('Expanding all items')
    expect(warning?.querySelector('.expand-all-detail')?.textContent?.trim()).toBe('This large quotation may take a while.')
    expect(warning?.querySelector('button')).toBeNull()
    expect(wrapper.get('[data-item-tools-toggle]').attributes('disabled')).toBeDefined()
    expect(getExpandedStates(wrapper).every((expanded) => expanded === 'false')).toBe(true)

    await waitForLargeExpansion()

    expect(document.body.querySelector('.expand-all-overlay')).toBeNull()
    expect(getExpandedStates(wrapper).every((expanded) => expanded === 'true')).toBe(true)
    expect(wrapper.get('[data-item-tools-toggle]').attributes('disabled')).toBeUndefined()
  })

  it('expands exactly 80 items immediately without a warning', async () => {
    const wrapper = mount(LineItemsTable, {
      props: createProps({ items: createItems(80) }),
      global: createMountOptions(),
    })

    await (await getExpansionAction(wrapper, 'Collapse all')).trigger('click')
    expect(getExpandedStates(wrapper).every((expanded) => expanded === 'false')).toBe(true)

    await (await getExpansionAction(wrapper, 'Expand all')).trigger('click')

    expect(document.body.querySelector('.expand-all-overlay')).toBeNull()
    expect(getExpandedStates(wrapper).every((expanded) => expanded === 'true')).toBe(true)
  })

  it('keeps expanded large quote root cards expanded after deleting an item', async () => {
    const items = createItems(82)
    const wrapper = mount(LineItemsTable, {
      props: createProps({ items }),
      global: createMountOptions(),
    })

    expect(getExpandedStates(wrapper)).toHaveLength(82)
    expect(getExpandedStates(wrapper).every((expanded) => expanded === 'false')).toBe(true)

    const expandButton = await getExpansionAction(wrapper, 'Expand all')
    expect(expandButton.attributes('data-icon')).toBe('pi pi-angle-double-down')

    await expandButton.trigger('click')
    await waitForLargeExpansion()

    expect(getExpandedStates(wrapper).every((expanded) => expanded === 'true')).toBe(true)
    expect((await getExpansionAction(wrapper, 'Collapse all')).attributes('data-icon')).toBe('pi pi-angle-double-up')

    await wrapper.setProps({ items: items.slice(0, -1) })

    expect(getExpandedStates(wrapper)).toHaveLength(81)
    expect(getExpandedStates(wrapper).every((expanded) => expanded === 'true')).toBe(true)
  })

  it('keeps a root item appended in place collapsed in a large quote', async () => {
    const items = reactive(createItems(82))
    const wrapper = mount(LineItemsTable, {
      props: createProps({ items }),
      global: createMountOptions(),
    })

    items.push(createItem('item-83'))
    await nextTick()

    expect(getExpandedStates(wrapper)).toHaveLength(83)
    expect(getExpandedStates(wrapper).every((expanded) => expanded === 'false')).toBe(true)
    expect((await getExpansionAction(wrapper, 'Expand all')).attributes('data-icon')).toBe('pi pi-angle-double-down')
  })
})

function createMountOptions() {
  return {
    plugins: [createAppI18n('en-US'), PrimeVue],
    stubs: {
      Button: defineComponent({
        name: 'Button',
        props: {
          icon: String,
          label: String,
          disabled: Boolean,
        },
        emits: ['click'],
        template: '<button v-bind="$attrs" type="button" :data-icon="icon" :disabled="disabled" @click="$emit(\'click\', $event)">{{ label }}</button>',
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
          expanded: Boolean,
          bulkNestedExpansion: Object,
        },
        template: `
          <article
            data-line-item-card
            :data-item-id="item.id"
            :data-expanded="String(expanded)"
            :data-bulk-nested-expansion="bulkNestedExpansion?.mode ?? ''"
          />
        `,
      }),
      SectionHeaderRow: true,
      CalculationSheetDialog: true,
    },
  }
}

function getExpandedStates(wrapper: ReturnType<typeof mount>) {
  return wrapper.findAll('[data-line-item-card]').map((card) => card.attributes('data-expanded'))
}

async function waitForLargeExpansion() {
  await vi.waitFor(() => {
    expect(document.body.querySelector('.expand-all-overlay')).toBeNull()
  })
  await nextTick()
}

async function getExpansionAction(wrapper: ReturnType<typeof mount>, text: string) {
  if (!document.querySelector('[data-item-tool="toggle-expansion"]')) {
    await wrapper.get('[data-item-tools-toggle]').trigger('click')
  }
  const action = new DOMWrapper(document.querySelector('[data-item-tool="toggle-expansion"]')!)
  expect(action.text()).toBe(text)
  return action
}

function createProps(overrides: Partial<InstanceType<typeof LineItemsTable>['$props']> = {}) {
  return {
    items: createItems(1),
    currency: 'USD',
    grandTotal: 0,
    globalMarkupRate: 10,
    totalsConfig: createTotalsConfig(),
    exchangeRates: { USD: 1 },
    costCurrencyOptions: ['USD'],
    quotationCurrencyOptions: ['USD'],
    ...overrides,
  }
}

function createItems(count: number): QuotationItem[] {
  return Array.from({ length: count }, (_, index) => createItem(`item-${index + 1}`))
}

function createItem(id: string): QuotationItem {
  return {
    id,
    name: `Item ${id}`,
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
    taxMode: 'single',
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
