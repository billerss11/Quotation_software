// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'

import { createAppI18n } from '@/shared/i18n/createAppI18n'

import GoalSeekDialog from './GoalSeekDialog.vue'
import type { QuotationItem } from '../types'

describe('GoalSeekDialog', () => {
  it('allows the user to apply the solver closest result when the exact subtotal is unreachable', async () => {
    const wrapper = mount(GoalSeekDialog, {
      props: createProps(),
      global: createMountOptions(),
    })

    await wrapper.get('input').setValue('73.50')

    const closestButton = wrapper.get('[data-goal-seek-apply-closest]')
    expect(wrapper.text()).toContain('Closest value is $73.00 at 5.00%.')
    expect(closestButton.text()).toBe('Use closest $73.00 (5.00%)')
    expect(wrapper.findAll('button').map((button) => button.text())).not.toContain('Apply')

    await closestButton.trigger('click')

    expect(wrapper.emitted('applyQuotation')).toEqual([[4.9999]])
  })

  it('only offers the closest-result action when the exact subtotal is unreachable', async () => {
    const wrapper = mount(GoalSeekDialog, {
      props: createProps(),
      global: createMountOptions(),
    })

    await wrapper.get('input').setValue('70')

    expect(wrapper.find('[data-goal-seek-apply-closest]').exists()).toBe(false)
  })

  it('keeps the quotation dialog within the viewport while allowing a wider action row', () => {
    const wrapper = mount(GoalSeekDialog, {
      props: createProps(),
      global: createMountOptions(),
    })

    expect(wrapper.getComponent({ name: 'Dialog' }).props('style')).toEqual({
      width: 'min(520px, calc(100vw - 32px))',
    })
  })

  it('lets the user choose which quotation amount to target', async () => {
    const wrapper = mount(GoalSeekDialog, {
      props: createProps(),
      global: createMountOptions(),
    })
    const targetType = wrapper.get('[data-goal-seek-target-type]')

    expect(targetType.findAll('option').map((option) => option.text())).toEqual([
      'Subtotal before tax',
      'Total after tax',
      'Quotation total',
    ])

    await targetType.setValue('total_after_tax')

    expect(wrapper.text()).toContain('Current total after tax')
    expect(wrapper.text()).toContain('Line items after markup plus tax, excluding extra charges.')
    expect(wrapper.text()).toContain('$77.00')

    await wrapper.get('[data-goal-seek-target-input]').setValue('77')

    expect(wrapper.text()).toContain('0.00% global markup -> $77.00')
  })

  it('uses the Chinese closest-result label instead of rendering its translation key', async () => {
    const wrapper = mount(GoalSeekDialog, {
      props: createProps(),
      global: createMountOptions('zh-CN'),
    })

    await wrapper.get('input').setValue('73.50')

    const closestButton = wrapper.get('[data-goal-seek-apply-closest]')
    expect(closestButton.text()).toContain('使用最接近值')
    expect(closestButton.text()).not.toContain('quotations.goalSeek.applyClosest')
  })
})

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
          style: Object,
        },
        template: '<section v-if="visible" class="dialog-stub" v-bind="$attrs"><slot /></section>',
      }),
      InputNumber: defineComponent({
        name: 'InputNumber',
        props: {
          modelValue: Number,
        },
        emits: ['update:modelValue'],
        template: '<input :value="modelValue ?? \'\'" @input="$emit(\'update:modelValue\', $event.target.value === \'\' ? null : Number($event.target.value))">',
      }),
      Select: defineComponent({
        name: 'Select',
        props: {
          modelValue: String,
          options: Array,
          optionLabel: String,
          optionValue: String,
        },
        emits: ['update:modelValue'],
        template: '<select :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value)"><option v-for="option in options" :key="option[optionValue]" :value="option[optionValue]">{{ option[optionLabel] }}</option></select>',
      }),
    },
  }
}

function createProps(overrides: Partial<InstanceType<typeof GoalSeekDialog>['$props']> = {}) {
  return {
    visible: true,
    mode: 'quotation' as const,
    items: [createItem({ quantity: 100, unitCost: 0.7 })],
    currency: 'USD' as const,
    exchangeRates: { USD: 1 },
    globalMarkupRate: 0,
    totals: {
      baseSubtotal: 70,
      markupAmount: 0,
      subtotalAfterMarkup: 70,
      taxableSubtotal: 70,
      taxAmount: 7,
      grandTotal: 82,
      taxBuckets: [],
    },
    totalsConfig: {
      globalMarkupRate: 0,
      taxRate: 10,
      extraCharges: [{ id: 'delivery', label: 'Delivery', amount: 5 }],
    },
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
