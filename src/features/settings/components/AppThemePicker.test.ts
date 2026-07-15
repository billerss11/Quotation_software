// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import AppThemePicker from './AppThemePicker.vue'

const options = [
  { id: 'ledger-teal' as const, label: 'Ledger Teal', description: 'Current theme' },
  { id: 'modern-blue' as const, label: 'Modern Blue', description: 'New theme' },
  { id: 'warm-sand' as const, label: 'Warm Sand', description: 'Warm theme' },
]

describe('AppThemePicker', () => {
  it('shows the selected theme and emits a new selection', async () => {
    const wrapper = mount(AppThemePicker, {
      props: {
        modelValue: 'ledger-teal',
        options,
        pickerLabel: 'Application theme',
      },
    })

    const cards = wrapper.findAll('button')
    expect(cards).toHaveLength(3)
    expect(cards[0]?.attributes('aria-pressed')).toBe('true')
    expect(cards[1]?.attributes('aria-pressed')).toBe('false')
    expect(cards[2]?.attributes('aria-pressed')).toBe('false')

    await cards[2]?.trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([['warm-sand']])
  })
})
