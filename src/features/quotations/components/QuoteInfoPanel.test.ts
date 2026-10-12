// @vitest-environment jsdom

import { shallowMount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'

import { createAppI18n } from '@/shared/i18n/createAppI18n'
import { messages } from '@/shared/i18n/messages'

import { createInitialQuotation } from '../utils/quotationDraft'
import QuoteInfoPanel from './QuoteInfoPanel.vue'

describe('QuoteInfoPanel revision controls', () => {
  it.each(['en-US', 'zh-CN'] as const)('shows the revision without a manual number input and opens management in %s', async (locale) => {
    const quotation = createInitialQuotation([], locale)
    quotation.header.revisionNumber = 4
    const wrapper = shallowMount(QuoteInfoPanel, {
      props: {
        header: quotation.header,
        quotationCurrencyOptions: ['USD'],
        templateId: 'classic',
        outputItemDetailLevel: 3,
      },
      global: {
        plugins: [createAppI18n(locale)],
        stubs: {
          Button: defineComponent({
            props: { label: String },
            emits: ['click'],
            template: '<button type="button" @click="$emit(\'click\')">{{ label }}</button>',
          }),
        },
      },
    })
    const revisionControls = wrapper.get('.revision-controls')
    const copy = messages[locale].quotations.revisions

    expect(revisionControls.text()).toContain(copy.revision.replace('{number}', '4'))
    expect(revisionControls.find('input, [role="spinbutton"]').exists()).toBe(false)
    expect(revisionControls.get('button').text()).toBe(copy.manage)
    await revisionControls.get('button').trigger('click')
    expect(wrapper.emitted('openRevisions')).toEqual([[]])
    expect(wrapper.emitted('updateHeaderField')).toBeUndefined()
  })
})
