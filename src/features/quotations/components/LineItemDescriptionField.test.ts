// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createAppI18n } from '@/shared/i18n/createAppI18n'

import LineItemDescriptionField from './LineItemDescriptionField.vue'

describe('LineItemDescriptionField', () => {
  beforeEach(() => vi.stubGlobal('ResizeObserver', ResizeObserverMock))
  afterEach(() => vi.unstubAllGlobals())

  it('applies edits from the expanded editor only when requested', async () => {
    const wrapper = mount(LineItemDescriptionField, {
      props: {
        modelValue: 'Original description',
        historyTarget: 'item:item-1-1:description',
        inputAriaLabel: 'Item 1.1 description',
        itemNumber: '1.1',
        placeholder: 'Description',
      },
      global: {
        plugins: [PrimeVue, createAppI18n('en-US')],
        directives: {
          tooltip: {},
        },
        stubs: {
          Teleport: true,
          Transition: false,
        },
      },
    })

    const openButton = wrapper.get('button[aria-label="Open a larger editor for item 1.1 description"]')
    await openButton.trigger('click')

    const expandedTextarea = wrapper.findAll('textarea')[1]
    expect(expandedTextarea).toBeDefined()
    await expandedTextarea!.setValue('Canceled description')
    await wrapper.findAll('button').find((button) => button.text() === 'Cancel')!.trigger('click')

    expect(wrapper.emitted('update:modelValue')).toBeUndefined()

    await openButton.trigger('click')
    await wrapper.findAll('textarea')[1]!.setValue('Applied description')
    await wrapper.findAll('button').find((button) => button.text() === 'Apply')!.trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([['Applied description']])
    expect(wrapper.emitted('blur')).toEqual([[]])
  })
})

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
