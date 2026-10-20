// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createAppI18n } from '@/shared/i18n/createAppI18n'
import QuotationSupportPanels from './QuotationSupportPanels.vue'

function mountPanels(locale: 'en-US' | 'zh-CN' = 'en-US') {
  return mount(QuotationSupportPanels, {
    props: { collapsible: true },
    global: { plugins: [createAppI18n(locale)], directives: { tooltip: {} } },
    slots: Object.fromEntries(['quoteInfo', 'customer', 'pricing', 'rates', 'outline']
      .map(panel => [panel, `<div data-testid="${panel}-content">${panel} content</div>`])),
  })
}

describe('QuotationSupportPanels', () => {
  it.each(['en-US', 'zh-CN'] as const)('makes every tool directly reachable in %s', async locale => {
    const wrapper = mountPanels(locale)
    expect(wrapper.findAll('[role="tab"]')).toHaveLength(5)
    expect(wrapper.get('[data-testid="pricing-content"]').element).toBeTruthy()

    for (const panel of ['quoteInfo', 'customer', 'rates', 'outline', 'pricing']) {
      await wrapper.get(`[data-testid="support-panel-${panel}"]`).trigger('click')
      expect(wrapper.get(`[data-testid="${panel}-content"]`).element).toBeTruthy()
      expect(wrapper.findAll('[role="tab"][aria-selected="true"]')).toHaveLength(1)
      const active = wrapper.get('[role="tab"][aria-selected="true"]')
      expect(wrapper.get('[role="tabpanel"]').attributes('aria-labelledby')).toBe(active.attributes('id'))
    }
    expect(wrapper.text()).not.toContain('quotations.supportPanels.')
    await wrapper.get('.panel-collapse').trigger('click')
    expect(wrapper.emitted('collapse')).toHaveLength(1)
  })

  it('supports arrow keys, Home and End with a single keyboard tab stop', async () => {
    const wrapper = mountPanels()
    const navigation = wrapper.get('[role="tablist"]')
    await navigation.trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.get('[data-testid="rates-content"]').element).toBeTruthy()
    await navigation.trigger('keydown', { key: 'Home' })
    expect(wrapper.get('[data-testid="quoteInfo-content"]').element).toBeTruthy()
    await navigation.trigger('keydown', { key: 'ArrowLeft' })
    expect(wrapper.get('[data-testid="outline-content"]').element).toBeTruthy()
    await navigation.trigger('keydown', { key: 'End' })
    expect(wrapper.findAll('[role="tab"][tabindex="0"]')).toHaveLength(1)
    expect(wrapper.get('[data-testid="support-panel-outline"]').attributes('tabindex')).toBe('0')
  })

  it('follows panel selection from history without replacing the slot contract', async () => {
    const wrapper = mountPanels()
    await wrapper.setProps({ activeTab: 'customer' })
    expect(wrapper.get('[data-testid="customer-content"]').element).toBeTruthy()
  })
})
