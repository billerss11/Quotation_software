// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import QuotationUndoRedoNotice from './QuotationUndoRedoNotice.vue'

describe('QuotationUndoRedoNotice', () => {
  it('renders an undo notice with the provided title and detail', () => {
    const wrapper = mount(QuotationUndoRedoNotice, {
      props: {
        action: 'undo',
        title: 'Undo applied',
        detail: 'Quantity: 3 -> 1',
      },
    })

    expect(wrapper.text()).toContain('Undo applied')
    expect(wrapper.text()).toContain('Quantity: 3 -> 1')
    expect(wrapper.find('.pi-undo').exists()).toBe(true)
  })

  it('renders a redo notice with the redo icon', () => {
    const wrapper = mount(QuotationUndoRedoNotice, {
      props: {
        action: 'redo',
        title: 'Redo applied',
        detail: 'Quantity: 1 -> 3',
      },
    })

    expect(wrapper.find('.pi-replay').exists()).toBe(true)
  })
})
