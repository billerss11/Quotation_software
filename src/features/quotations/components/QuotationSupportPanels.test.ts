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

    expect(wrapper.find('[data-testid="support-group-setup"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="support-group-pricing"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="support-group-structure"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="support-panel-pricing"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="support-panel-rates"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="pricing-slot"]').exists()).toBe(true)

    await wrapper.get('[data-testid="support-group-setup"]').trigger('click')

    expect(wrapper.find('[data-testid="support-panel-quoteInfo"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="support-panel-customer"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="quote-info-slot"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="pricing-slot"]').exists()).toBe(false)

    await wrapper.get('[data-testid="support-panel-customer"]').trigger('click')

    expect(wrapper.find('[data-testid="customer-slot"]').exists()).toBe(true)
  })
})
