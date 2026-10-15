// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createAppI18n } from '@/shared/i18n/createAppI18n'

import LineItemDescriptionField from './LineItemDescriptionField.vue'
import ExpandableTextField from './ExpandableTextField.vue'

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

  it('supports compact generic text fields and applies multiline drafts with Ctrl+Enter', async () => {
    const wrapper = mount(ExpandableTextField, {
      props: {
        modelValue: 'Original notes',
        historyTarget: 'header:notes',
        inputAriaLabel: 'Quotation notes',
        editorTitle: 'Edit quotation notes',
        rows: 3,
        autoResize: false,
      },
      global: {
        plugins: [PrimeVue, createAppI18n('en-US')],
        directives: { tooltip: {} },
        stubs: { Teleport: true, Transition: false },
      },
    })

    const compactTextarea = wrapper.get('textarea')
    expect(compactTextarea.attributes('rows')).toBe('3')
    expect(compactTextarea.attributes('data-history-target')).toBe('header:notes')
    await wrapper.get('.description-expand-button').trigger('click')
    expect(wrapper.get('.description-editor-dialog').text()).toContain('Edit quotation notes')
    const expandedTextarea = wrapper.findAll('textarea')[1]!
    await expandedTextarea.setValue('First line\nSecond line')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    await expandedTextarea.trigger('keydown', { key: 'Enter', ctrlKey: true })

    expect(wrapper.emitted('update:modelValue')).toEqual([['First line\nSecond line']])
    expect(wrapper.emitted('blur')).toEqual([[]])
    wrapper.unmount()
  })
})

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
