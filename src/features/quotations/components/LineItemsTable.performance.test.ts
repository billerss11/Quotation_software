// @vitest-environment jsdom

import { defineComponent, nextTick, reactive } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import { createAppI18n } from '@/shared/i18n/createAppI18n'

import type { QuotationItem, QuotationRootItem } from '../types'

describe('LineItemsTable performance', () => {
  it('updates tax class labels without rerunning numeric row pricing', async () => {
    vi.resetModules()

    const pricingModule = await import('../utils/quotationItemPricing')
    const pricingSpy = vi.spyOn(pricingModule, 'getQuotationItemPricingDisplay')
    const { default: LineItemsTable } = await import('./LineItemsTable.vue')

    const totalsConfig = reactive({
      globalMarkupRate: 10,
      taxMode: 'mixed' as const,
      defaultTaxClassId: 'tax-goods',
      taxClasses: [
        { id: 'tax-goods', label: 'Goods 13%', rate: 13 },
        { id: 'tax-service', label: 'Service 6%', rate: 6 },
      ],
    })

    const wrapper = mount(LineItemsTable, {
      props: {
        items: [
          {
            id: 'item-1',
            name: 'Valve set',
            description: '',
            quantity: 1,
            quantityUnit: 'set',
            unitCost: 100,
            costCurrency: 'USD',
            taxClassId: 'tax-goods',
            children: [],
          },
        ],
        currency: 'USD',
        grandTotal: 124.3,
        lineItemEntryMode: 'detailed',
        globalMarkupRate: 10,
        totalsConfig,
        exchangeRates: {
          USD: 1,
        },
        costCurrencyOptions: ['USD'],
        quotationCurrencyOptions: ['USD'],
      },
      global: {
        plugins: [createAppI18n('en-US')],
        directives: {
          tooltip: {},
        },
        stubs: {
          Button: {
            template: '<button type="button"><slot /></button>',
          },
          InputText: {
            props: ['modelValue'],
            template: '<input :value="modelValue" />',
          },
          InputNumber: {
            props: ['modelValue'],
            template: '<input :value="modelValue" />',
          },
          Select: {
            props: ['modelValue', 'options', 'optionLabel', 'optionValue'],
            template: '<div>{{ Array.isArray(options) ? ((options.find((option) => (optionValue ? option[optionValue] : option) === modelValue) || {})[optionLabel || "label"] || modelValue) : modelValue }}</div>',
          },
          Textarea: {
            props: ['modelValue'],
            template: '<textarea :value="modelValue" />',
          },
        },
      },
    })

    expect(wrapper.text()).toContain('Goods 13%')

    pricingSpy.mockClear()
    totalsConfig.taxClasses[0].label = 'Updated Goods 13%'
    await nextTick()

    expect(wrapper.text()).toContain('Updated Goods 13%')
    expect(pricingSpy).not.toHaveBeenCalled()
  })

  it('does not reprice unrelated root items when editing one numeric row', async () => {
    vi.resetModules()

    const pricingModule = await import('../utils/quotationItemPricing')
    const pricingSpy = vi.spyOn(pricingModule, 'getQuotationItemPricingDisplay')
    const { default: LineItemsTable } = await import('./LineItemsTable.vue')

    const items = reactive([
      {
        id: 'item-1',
        name: 'Valve set',
        description: '',
        quantity: 1,
        quantityUnit: 'set',
        unitCost: 100,
        costCurrency: 'USD',
        children: [],
      },
      {
        id: 'item-2',
        name: 'Pump set',
        description: '',
        quantity: 1,
        quantityUnit: 'set',
        unitCost: 200,
        costCurrency: 'USD',
        children: [],
      },
    ])

    mount(LineItemsTable, {
      props: {
        items,
        currency: 'USD',
        grandTotal: 330,
        lineItemEntryMode: 'detailed',
        globalMarkupRate: 10,
        totalsConfig: {
          globalMarkupRate: 10,
          taxMode: 'single',
          defaultTaxClassId: 'tax-default',
          taxClasses: [{ id: 'tax-default', label: '13%', rate: 13 }],
        },
        exchangeRates: {
          USD: 1,
        },
        costCurrencyOptions: ['USD'],
        quotationCurrencyOptions: ['USD'],
      },
      global: {
        plugins: [createAppI18n('en-US')],
        directives: {
          tooltip: {},
        },
        stubs: {
          Button: {
            template: '<button type="button"><slot /></button>',
          },
          InputText: {
            props: ['modelValue'],
            template: '<input :value="modelValue" />',
          },
          InputNumber: {
            props: ['modelValue'],
            template: '<input :value="modelValue" />',
          },
          Select: {
            props: ['modelValue'],
            template: '<div>{{ modelValue }}</div>',
          },
          Textarea: {
            props: ['modelValue'],
            template: '<textarea :value="modelValue" />',
          },
        },
      },
    })

    pricingSpy.mockClear()
    items[0].quantity = 2
    await nextTick()

    const repricedItemIds = pricingSpy.mock.calls.map(([item]) => (item as { id: string }).id)

    expect(repricedItemIds).toContain('item-1')
    expect(repricedItemIds).not.toContain('item-2')
  })

  it('opens large quotations with root cards collapsed', async () => {
    const { default: LineItemsTable } = await import('./LineItemsTable.vue')
    const rootItem = createItem({
      id: 'large-root',
      children: Array.from({ length: 80 }, (_, index) =>
        createItem({
          id: `child-${index + 1}`,
          name: `Child ${index + 1}`,
          unitCost: 100,
        }),
      ),
    })

    const wrapper = mount(LineItemsTable, {
      props: {
        items: [rootItem],
        currency: 'USD',
        grandTotal: 8800,
        lineItemEntryMode: 'detailed',
        globalMarkupRate: 10,
        totalsConfig: {
          globalMarkupRate: 10,
          taxMode: 'single',
          defaultTaxClassId: 'tax-default',
          taxClasses: [{ id: 'tax-default', label: '13%', rate: 13 }],
        },
        exchangeRates: {
          USD: 1,
        },
        costCurrencyOptions: ['USD'],
        quotationCurrencyOptions: ['USD'],
      },
      global: {
        plugins: [createAppI18n('en-US')],
        directives: {
          tooltip: {},
        },
        stubs: {
          Button: {
            template: '<button type="button"><slot /></button>',
          },
          InputText: {
            props: ['modelValue'],
            template: '<input :value="modelValue" />',
          },
          InputNumber: {
            props: ['modelValue'],
            template: '<input :value="modelValue" />',
          },
          Select: {
            props: ['modelValue'],
            template: '<div>{{ modelValue }}</div>',
          },
          Textarea: {
            props: ['modelValue'],
            template: '<textarea :value="modelValue" />',
          },
        },
      },
    })

    expect(wrapper.find('[data-item-id="child-1"]').exists()).toBe(false)
  })

  it('reveals and scrolls a focused grandchild inside a collapsed large quotation', async () => {
    const { default: LineItemsTable } = await import('./LineItemsTable.vue')
    const scrollIntoView = vi.fn()
    const originalScrollIntoView = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = scrollIntoView

    const rootItem = createItem({
      id: 'large-root',
      children: [
        createItem({
          id: 'child-group',
          name: 'Child group',
          children: [
            createItem({
              id: 'target-grandchild',
              name: 'Target grandchild',
              unitCost: 100,
            }),
            ...Array.from({ length: 80 }, (_, index) =>
              createItem({
                id: `grandchild-${index + 1}`,
                name: `Grandchild ${index + 1}`,
                unitCost: 100,
              }),
            ),
          ],
        }),
      ],
    })

    const wrapper = mount(LineItemsTable, {
      props: {
        items: [rootItem],
        currency: 'USD',
        grandTotal: 8800,
        lineItemEntryMode: 'detailed',
        globalMarkupRate: 10,
        totalsConfig: {
          globalMarkupRate: 10,
          taxMode: 'single',
          defaultTaxClassId: 'tax-default',
          taxClasses: [{ id: 'tax-default', label: '13%', rate: 13 }],
        },
        exchangeRates: {
          USD: 1,
        },
        costCurrencyOptions: ['USD'],
        quotationCurrencyOptions: ['USD'],
      },
      global: {
        plugins: [createAppI18n('en-US')],
        directives: {
          tooltip: {},
        },
        stubs: {
          Button: {
            template: '<button type="button"><slot /></button>',
          },
          InputText: {
            props: ['modelValue'],
            template: '<input :value="modelValue" />',
          },
          InputNumber: {
            props: ['modelValue'],
            template: '<input :value="modelValue" />',
          },
          Select: {
            props: ['modelValue'],
            template: '<div>{{ modelValue }}</div>',
          },
          Textarea: {
            props: ['modelValue'],
            template: '<textarea :value="modelValue" />',
          },
        },
      },
      attachTo: document.body,
    })

    try {
      expect(wrapper.find('[data-item-id="target-grandchild"]').exists()).toBe(false)

      await wrapper.setProps({
        focusedItemId: 'target-grandchild',
        focusedItemRequestKey: 1,
      })
      await nextTick()
      await nextTick()
      await nextTick()

      expect(wrapper.find('[data-item-id="target-grandchild"]').exists()).toBe(true)
      expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center' })
    } finally {
      wrapper.unmount()
      Element.prototype.scrollIntoView = originalScrollIntoView
      document.body.innerHTML = ''
    }
  })

  it('scrolls a focused root item to its header anchor', async () => {
    const { default: LineItemsTable } = await import('./LineItemsTable.vue')
    const rootItem = createItem({
      id: 'root-1',
      children: [createItem({ id: 'child-1', unitCost: 100 })],
    })

    const wrapper = mount(LineItemsTable, {
      props: {
        items: [rootItem],
        currency: 'USD',
        grandTotal: 110,
        lineItemEntryMode: 'detailed',
        globalMarkupRate: 10,
        totalsConfig: {
          globalMarkupRate: 10,
          taxMode: 'single',
          defaultTaxClassId: 'tax-default',
          taxClasses: [{ id: 'tax-default', label: '13%', rate: 13 }],
        },
        exchangeRates: {
          USD: 1,
        },
        costCurrencyOptions: ['USD'],
        quotationCurrencyOptions: ['USD'],
      },
      global: {
        plugins: [createAppI18n('en-US')],
        directives: {
          tooltip: {},
        },
        stubs: {
          Button: {
            template: '<button type="button"><slot /></button>',
          },
          InputText: {
            props: ['modelValue'],
            template: '<input :value="modelValue" />',
          },
          InputNumber: {
            props: ['modelValue'],
            template: '<input :value="modelValue" />',
          },
          Select: {
            props: ['modelValue'],
            template: '<div>{{ modelValue }}</div>',
          },
          Textarea: {
            props: ['modelValue'],
            template: '<textarea :value="modelValue" />',
          },
        },
      },
      attachTo: document.body,
    })

    try {
      const rootScrollIntoView = vi.fn()
      const anchorScrollIntoView = vi.fn()
      Object.defineProperty(wrapper.get('[data-item-id="root-1"]').element, 'scrollIntoView', {
        configurable: true,
        value: rootScrollIntoView,
      })
      Object.defineProperty(wrapper.get('[data-item-focus-anchor="root-1"]').element, 'scrollIntoView', {
        configurable: true,
        value: anchorScrollIntoView,
      })

      await wrapper.setProps({
        focusedItemId: 'root-1',
        focusedItemRequestKey: 1,
      })
      await nextTick()
      await nextTick()

      expect(anchorScrollIntoView).toHaveBeenCalledWith({ block: 'center' })
      expect(rootScrollIntoView).not.toHaveBeenCalled()
    } finally {
      wrapper.unmount()
      document.body.innerHTML = ''
    }
  })

  it('marks large quotations for lightweight rendering', async () => {
    const { default: LineItemsTable } = await import('./LineItemsTable.vue')
    const rootItem = createItem({
      id: 'large-root',
      children: Array.from({ length: 80 }, (_, index) =>
        createItem({
          id: `child-${index + 1}`,
          name: `Child ${index + 1}`,
          unitCost: 100,
        }),
      ),
    })

    const wrapper = mount(LineItemsTable, {
      props: {
        items: [rootItem],
        currency: 'USD',
        grandTotal: 8800,
        lineItemEntryMode: 'detailed',
        globalMarkupRate: 10,
        totalsConfig: {
          globalMarkupRate: 10,
          taxMode: 'single',
          defaultTaxClassId: 'tax-default',
          taxClasses: [{ id: 'tax-default', label: '13%', rate: 13 }],
        },
        exchangeRates: {
          USD: 1,
        },
        costCurrencyOptions: ['USD'],
        quotationCurrencyOptions: ['USD'],
      },
      global: {
        plugins: [createAppI18n('en-US')],
        directives: {
          tooltip: {},
        },
        stubs: {
          Button: {
            template: '<button type="button"><slot /></button>',
          },
          InputText: {
            props: ['modelValue'],
            template: '<input :value="modelValue" />',
          },
          InputNumber: {
            props: ['modelValue'],
            template: '<input :value="modelValue" />',
          },
          Select: {
            props: ['modelValue'],
            template: '<div>{{ modelValue }}</div>',
          },
          Textarea: {
            props: ['modelValue'],
            template: '<textarea :value="modelValue" />',
          },
        },
      },
    })

    expect(wrapper.get('.workbench').classes()).toContain('workbench-large-quote')
  })

  it('expands nested groups when expanding all root cards', async () => {
    const { default: LineItemsTable } = await import('./LineItemsTable.vue')
    const rootItem = createItem({
      id: 'large-root',
      children: [
        createItem({
          id: 'child-group',
          name: 'Child group',
          children: Array.from({ length: 80 }, (_, index) =>
            createItem({
              id: `grandchild-${index + 1}`,
              name: `Grandchild ${index + 1}`,
              unitCost: 100,
            }),
          ),
        }),
      ],
    })

    const wrapper = mount(LineItemsTable, {
      props: {
        items: [rootItem],
        currency: 'USD',
        grandTotal: 8800,
        lineItemEntryMode: 'detailed',
        globalMarkupRate: 10,
        totalsConfig: {
          globalMarkupRate: 10,
          taxMode: 'single',
          defaultTaxClassId: 'tax-default',
          taxClasses: [{ id: 'tax-default', label: '13%', rate: 13 }],
        },
        exchangeRates: {
          USD: 1,
        },
        costCurrencyOptions: ['USD'],
        quotationCurrencyOptions: ['USD'],
      },
      global: {
        plugins: [createAppI18n('en-US')],
        directives: {
          tooltip: {},
        },
        stubs: {
          Button: {
            props: ['label'],
            emits: ['click'],
            template: '<button type="button" @click="$emit(\'click\')">{{ label }}</button>',
          },
          InputText: {
            props: ['modelValue'],
            template: '<input :value="modelValue" />',
          },
          InputNumber: {
            props: ['modelValue'],
            template: '<input :value="modelValue" />',
          },
          Select: {
            props: ['modelValue'],
            template: '<div>{{ modelValue }}</div>',
          },
          Textarea: {
            props: ['modelValue'],
            template: '<textarea :value="modelValue" />',
          },
        },
      },
    })

    expect(wrapper.find('[data-item-id="grandchild-1"]').exists()).toBe(false)

    await wrapper.get('.heading-buttons button').trigger('click')

    expect(wrapper.find('[data-item-id="child-group"]').exists()).toBe(true)
    expect(wrapper.find('[data-item-id="grandchild-1"]').exists()).toBe(true)
  })

  it('does not mount far-off root cards before scrolling large root lists', async () => {
    const { wrapper, cleanup } = await mountVirtualizedRootTable(createRootItems(150))

    try {
      expect(wrapper.find('[data-item-id="item-1"]').exists()).toBe(true)
      expect(wrapper.find('[data-item-id="item-150"]').exists()).toBe(false)
    } finally {
      cleanup()
    }
  })

  it('virtualizes root cards when total nested item count is large', async () => {
    const rootItems = Array.from({ length: 50 }, (_, rootIndex) =>
      createItem({
        id: `root-${rootIndex + 1}`,
        name: `Root ${rootIndex + 1}`,
        children: [
          createItem({ id: `root-${rootIndex + 1}-child-1` }),
          createItem({ id: `root-${rootIndex + 1}-child-2` }),
        ],
      }),
    )
    const { wrapper, cleanup } = await mountVirtualizedRootTable(rootItems)

    try {
      expect(wrapper.find('[data-item-id="root-1"]').exists()).toBe(true)
      expect(wrapper.find('[data-item-id="root-50"]').exists()).toBe(false)
    } finally {
      cleanup()
    }
  })

  it('keeps root action emits stable on visible virtualized rows', async () => {
    const { wrapper, cleanup } = await mountVirtualizedRootTable([
      createSectionHeader('section-1'),
      ...createRootItems(150),
    ])

    try {
      await wrapper.get('[data-item-id="item-1"] [data-test="add-child"]').trigger('click')
      await wrapper.get('[data-item-id="item-1"] [data-test="remove"]').trigger('click')
      await wrapper.get('[data-item-id="item-1"] [data-test="duplicate"]').trigger('click')
      await wrapper.get('[data-item-id="item-1"] [data-test="move-up"]').trigger('click')
      await wrapper.get('[data-item-id="item-1"] [data-test="pricing-method"]').trigger('click')
      await wrapper.get('[data-item-id="item-1"] [data-test="update-name"]').trigger('click')
      await wrapper.get('[data-item-id="item-1"] [data-test="goal-seek"]').trigger('click')
      await wrapper.get('[data-item-id="section-1"] [data-test="section-title"]').trigger('click')

      expect(wrapper.emitted('addChildItem')).toEqual([['item-1']])
      expect(wrapper.emitted('removeItem')).toEqual([['item-1']])
      expect(wrapper.emitted('duplicateRootItem')).toEqual([['item-1']])
      expect(wrapper.emitted('moveRootItem')).toEqual([['item-1', -1]])
      expect(wrapper.emitted('setItemPricingMethod')).toEqual([['item-1', 'manual']])
      expect(wrapper.emitted('updateItemField')).toEqual([['item-1', 'name', 'Updated item']])
      expect(wrapper.emitted('requestItemGoalSeek')).toEqual([['item-1']])
      expect(wrapper.emitted('updateSectionHeaderTitle')).toEqual([['section-1', 'Updated section']])
    } finally {
      cleanup()
    }
  })

  it('expands all root rows without mounting every virtualized root card', async () => {
    const { wrapper, cleanup } = await mountVirtualizedRootTable(createRootItems(150))

    try {
      expect(wrapper.find('[data-item-id="item-150"]').exists()).toBe(false)

      await wrapper.get('.heading-buttons button').trigger('click')
      await nextTick()

      expect(wrapper.get('[data-item-id="item-1"]').attributes('data-expanded')).toBe('true')
      expect(wrapper.find('[data-item-id="item-150"]').exists()).toBe(false)
    } finally {
      cleanup()
    }
  })

  it('scrolls a focused far-down root item into the virtual range', async () => {
    const { wrapper, scrollTo, cleanup } = await mountVirtualizedRootTable(createRootItems(150))

    try {
      expect(wrapper.find('[data-item-id="item-150"]').exists()).toBe(false)

      await wrapper.setProps({
        focusedItemId: 'item-150',
        focusedItemRequestKey: 1,
      })
      await flushVirtualRootScroll()

      expect(scrollTo).toHaveBeenCalled()
      expect(wrapper.find('[data-item-id="item-150"]').exists()).toBe(true)
    } finally {
      cleanup()
    }
  })

  it('scrolls a focused far-down grandchild to its root and reveals the child', async () => {
    const rootItems = createRootItems(150)
    rootItems[149] = createItem({
      id: 'item-150',
      children: [createItem({ id: 'target-grandchild', name: 'Target grandchild' })],
    })
    const { wrapper, scrollTo, cleanup } = await mountVirtualizedRootTable(rootItems)

    try {
      expect(wrapper.find('[data-item-id="target-grandchild"]').exists()).toBe(false)

      await wrapper.setProps({
        focusedItemId: 'target-grandchild',
        focusedItemRequestKey: 1,
      })
      await flushVirtualRootScroll()

      expect(scrollTo).toHaveBeenCalled()
      expect(wrapper.find('[data-item-id="item-150"]').attributes('data-expanded')).toBe('true')
      expect(wrapper.find('[data-item-id="target-grandchild"]').exists()).toBe(true)
    } finally {
      cleanup()
    }
  })
})

function createItem(overrides: Partial<QuotationItem> = {}): QuotationItem {
  return {
    id: overrides.id ?? 'item-1',
    name: overrides.name ?? 'New item',
    description: '',
    quantity: 1,
    quantityUnit: 'set',
    unitCost: overrides.unitCost ?? 0,
    costCurrency: 'USD',
    children: overrides.children ?? [],
  }
}

function createRootItems(count: number): QuotationItem[] {
  return Array.from({ length: count }, (_, index) =>
    createItem({
      id: `item-${index + 1}`,
      name: `Item ${index + 1}`,
      unitCost: 100,
    }),
  )
}

function createSectionHeader(id: string) {
  return {
    id,
    kind: 'section_header' as const,
    title: 'Section',
  }
}

async function mountVirtualizedRootTable(items: QuotationRootItem[]) {
  const { default: LineItemsTable } = await import('./LineItemsTable.vue')
  const { scrollContainer, scrollTo } = createScrollContainer()
  const wrapper = mount(LineItemsTable, {
    props: {
      items,
      scrollContainer,
      currency: 'USD',
      grandTotal: items.length * 100,
      lineItemEntryMode: 'detailed',
      globalMarkupRate: 10,
      totalsConfig: {
        globalMarkupRate: 10,
        taxMode: 'single',
        defaultTaxClassId: 'tax-default',
        taxClasses: [{ id: 'tax-default', label: '13%', rate: 13 }],
      },
      exchangeRates: {
        USD: 1,
      },
      costCurrencyOptions: ['USD'],
      quotationCurrencyOptions: ['USD'],
    },
    global: {
      plugins: [createAppI18n('en-US')],
      directives: {
        tooltip: {},
      },
      stubs: createRootVirtualizationStubs(),
    },
    attachTo: scrollContainer,
  })

  await nextTick()

  return {
    wrapper,
    scrollContainer,
    scrollTo,
    cleanup: () => {
      wrapper.unmount()
      scrollContainer.remove()
    },
  }
}

function createScrollContainer() {
  const scrollContainer = document.createElement('div')
  let scrollTop = 0

  Object.defineProperty(scrollContainer, 'clientHeight', {
    configurable: true,
    value: 720,
  })
  Object.defineProperty(scrollContainer, 'clientWidth', {
    configurable: true,
    value: 1024,
  })
  Object.defineProperty(scrollContainer, 'scrollHeight', {
    configurable: true,
    value: 24000,
  })
  Object.defineProperty(scrollContainer, 'scrollTop', {
    configurable: true,
    get: () => scrollTop,
    set: (value) => {
      scrollTop = Number(value)
    },
  })

  const scrollTo = vi.fn((options?: ScrollToOptions | number, y?: number) => {
    if (typeof options === 'number') {
      scrollTop = typeof y === 'number' ? y : options
    } else {
      scrollTop = Number(options?.top ?? scrollTop)
    }
    scrollContainer.dispatchEvent(new Event('scroll'))
  })
  Object.defineProperty(scrollContainer, 'scrollTo', {
    configurable: true,
    value: scrollTo,
  })

  document.body.appendChild(scrollContainer)

  return { scrollContainer, scrollTo }
}

function createRootVirtualizationStubs() {
  return {
    Button: defineComponent({
      name: 'Button',
      props: {
        label: String,
        icon: String,
      },
      emits: ['click'],
      template: '<button type="button" :data-icon="icon" @click="$emit(\'click\')">{{ label }}<slot /></button>',
    }),
    Select: defineComponent({
      name: 'Select',
      props: {
        modelValue: String,
        options: Array,
      },
      emits: ['update:modelValue'],
      template: '<select :value="modelValue"><option v-for="option in options" :key="String(option)" :value="option">{{ option }}</option></select>',
    }),
    LineItemCard: defineComponent({
      name: 'LineItemCard',
      props: {
        item: {
          type: Object,
          required: true,
        },
        expanded: Boolean,
      },
      emits: [
        'toggleExpanded',
        'addChildItem',
        'removeItem',
        'duplicateRootItem',
        'moveRootItem',
        'setItemPricingMethod',
        'updateItemField',
        'requestItemGoalSeek',
      ],
      template: `
        <article
          data-line-item-card
          :data-item-id="item.id"
          :data-item-focus-anchor="item.id"
          :data-history-target="'item:' + item.id"
          :data-expanded="String(expanded)"
        >
          <button type="button" data-test="add-child" @click="$emit('addChildItem', item.id)">Add child</button>
          <button type="button" data-test="remove" @click="$emit('removeItem', item.id)">Remove</button>
          <button type="button" data-test="duplicate" @click="$emit('duplicateRootItem', item.id)">Duplicate</button>
          <button type="button" data-test="move-up" @click="$emit('moveRootItem', item.id, -1)">Move up</button>
          <button type="button" data-test="pricing-method" @click="$emit('setItemPricingMethod', item.id, 'manual')">Pricing</button>
          <button type="button" data-test="update-name" @click="$emit('updateItemField', item.id, 'name', 'Updated item')">Update</button>
          <button type="button" data-test="goal-seek" @click="$emit('requestItemGoalSeek', item.id)">Goal seek</button>
          <div v-if="expanded">
            <span
              v-for="child in item.children"
              :key="child.id"
              :data-item-id="child.id"
              :data-item-focus-anchor="child.id"
            >
              {{ child.name }}
            </span>
          </div>
        </article>
      `,
    }),
    SectionHeaderRow: defineComponent({
      name: 'SectionHeaderRow',
      props: {
        header: {
          type: Object,
          required: true,
        },
      },
      emits: ['moveRow', 'removeRow', 'updateTitle'],
      template: `
        <article :data-item-id="header.id" :data-history-target="'item:' + header.id">
          <button type="button" data-test="section-title" @click="$emit('updateTitle', header.id, 'Updated section')">Title</button>
        </article>
      `,
    }),
    CalculationSheetDialog: true,
  }
}

async function flushVirtualRootScroll() {
  await nextTick()
  await nextTick()
  await new Promise((resolve) => window.setTimeout(resolve, 0))
  await nextTick()
  await nextTick()
}
