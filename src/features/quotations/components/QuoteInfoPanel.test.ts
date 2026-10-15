// @vitest-environment jsdom

import { shallowMount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import InputText from 'primevue/inputtext'

import { createAppI18n } from '@/shared/i18n/createAppI18n'
import { messages } from '@/shared/i18n/messages'

import { createInitialQuotation } from '../utils/quotationDraft'
import QuoteInfoPanel from './QuoteInfoPanel.vue'

describe('QuoteInfoPanel', () => {
  it.each(['en-US', 'zh-CN'] as const)('keeps editable quotation details in %s and leaves document controls to Review', async (locale) => {
    const quotation = createInitialQuotation([], locale)
    quotation.header.revisionNumber = 4
    const wrapper = shallowMount(QuoteInfoPanel, {
      props: {
        header: quotation.header,
        quotationCurrencyOptions: ['USD'],
      },
      global: {
        plugins: [createAppI18n(locale)],
      },
    })
    expect(wrapper.get('.section-title').text()).toBe(messages[locale].workspace.quotationDetails)
    expect(wrapper.findAll('[data-history-target]').map(field => field.attributes('data-history-target'))).toEqual([
      'header:quotationNumber', 'header:quotationDate', 'header:projectName', 'header:validityPeriod', 'header:currency',
    ])
    expect(wrapper.find('.revision-controls').exists()).toBe(false)
    expect(wrapper.find('[data-history-target="header:documentLocale"]').exists()).toBe(false)
    expect(wrapper.find('[data-history-target="quotation:outputSettings"]').exists()).toBe(false)

    wrapper.get('[data-history-target="header:projectName"]').getComponent(InputText).vm.$emit('update:modelValue', 'New project')
    expect(wrapper.emitted('updateHeaderField')).toEqual([['projectName', 'New project']])
    expect(quotation.header.projectName).toBe('')
    wrapper.unmount()
  })

  it('reveals collapsed notes and terms when undo targets those fields', async () => {
    const wrapper = shallowMount(QuoteInfoPanel, {
      props: {
        header: createInitialQuotation([], 'en-US').header,
        quotationCurrencyOptions: ['USD'],
      },
      global: { plugins: [createAppI18n('en-US')] },
    })
    expect(wrapper.find('[data-history-target="header:notes"]').exists()).toBe(false)
    await wrapper.setProps({ historyRevealTarget: 'header:notes', historyRevealTargetKey: 1 })
    expect(wrapper.get('.extras-toggle').attributes('aria-expanded')).toBe('true')
    expect(wrapper.get('[data-history-target="header:notes"]').isVisible()).toBe(true)
    expect(wrapper.get('[data-history-target="header:terms"]').isVisible()).toBe(true)
    wrapper.unmount()
  })
})
