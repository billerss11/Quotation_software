// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { createAppI18n } from '@/shared/i18n/createAppI18n'

import QuotationSupportPanels from './QuotationSupportPanels.vue'

describe('QuotationSupportPanels', () => {
  it('groups side-panel tools by quotation task', async () => {
    const wrapper = mount(QuotationSupportPanels, {
      global: {
        plugins: [createAppI18n('en-US')],
        directives: {
          tooltip: {},
        },
      },
      slots: {
        quoteInfo: '<div data-testid="quote-info-slot">Quote info content</div>',
        customer: '<div data-testid="customer-slot">Customer content</div>',
        pricing: '<div data-testid="pricing-slot">Pricing content</div>',
        rates: '<div data-testid="rates-slot">Rates content</div>',
        outline: '<div data-testid="outline-slot">Outline content</div>',
      },
    })

    const groups = wrapper.findAll('.panel-group')
    const tabs = wrapper.findAll('.panel-tab')

    expect(groups.map((group) => group.text())).toEqual(['Details', 'Pricing', 'Structure'])
    expect(groups.map((group) => group.attributes('aria-selected'))).toEqual(['false', 'true', 'false'])
    expect(tabs.map((tab) => tab.text())).toEqual(['Pricing & tax', 'FX rates'])
    expect(tabs.map((tab) => tab.attributes('aria-selected'))).toEqual(['true', 'false'])
    expect(wrapper.text()).toContain('Pricing content')
    expect(wrapper.text()).not.toContain('Quote info content')

    await wrapper.get('[data-testid="support-group-setup"]').trigger('click')

    const setupTabs = wrapper.findAll('.panel-tab')

    expect(wrapper.findAll('.panel-group').map((group) => group.attributes('aria-selected'))).toEqual(['true', 'false', 'false'])
    expect(setupTabs.map((tab) => tab.text())).toEqual(['Quote info', 'Parties'])
    expect(setupTabs.map((tab) => tab.attributes('aria-selected'))).toEqual(['true', 'false'])
    expect(wrapper.text()).toContain('Quote info content')
    expect(wrapper.text()).not.toContain('Pricing content')

    await wrapper.get('[data-testid="support-panel-customer"]').trigger('click')

    expect(wrapper.findAll('.panel-tab').map((tab) => tab.attributes('aria-selected'))).toEqual(['false', 'true'])
    expect(wrapper.text()).toContain('Customer content')
    expect(wrapper.text()).not.toContain('Quote info content')
  })
})
