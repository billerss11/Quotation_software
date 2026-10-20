// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createAppI18n } from '@/shared/i18n/createAppI18n'
import { messages } from '@/shared/i18n/messages'
import QuotationMoveConfirmation from './QuotationMoveConfirmation.vue'

describe('QuotationMoveConfirmation', () => {
  it.each(['en-US', 'zh-CN'] as const)('explains price transitions and lets the user cancel or confirm in %s', async locale => {
    const copy = messages[locale].quotations.lineItems.navigator
    const wrapper = mount(QuotationMoveConfirmation, {
      props: {
        impact: {
          beforeTotal: 780,
          afterTotal: 580,
          requiresConfirmation: true,
          hiddenPriceItemName: 'Valve',
          reactivatedPriceItemName: 'Pump',
        },
        currency: 'USD',
        disabled: false,
      },
      global: {
        plugins: [createAppI18n(locale)],
        stubs: {
          Dialog: { props: ['header'], template: '<section><h2>{{ header }}</h2><slot/><slot name="footer"/></section>' },
          Button: { props: ['label', 'disabled'], template: '<button :disabled="disabled">{{ label }}</button>' },
        },
      },
    })
    expect(wrapper.text()).toContain(copy.priceConfirmationTitle)
    expect(wrapper.text()).toContain(copy.priceHidden.replace('{label}', 'Valve'))
    expect(wrapper.text()).toContain(copy.priceReactivated.replace('{label}', 'Pump'))
    expect(wrapper.findAll('dd').map(element => element.text())).toEqual(['$780.00', '$580.00'])
    const [cancel, confirm] = wrapper.findAll('button')
    await cancel!.trigger('click')
    expect(wrapper.emitted('cancel')).toHaveLength(1)
    expect(wrapper.emitted('confirm')).toBeUndefined()
    await confirm!.trigger('click')
    expect(wrapper.emitted('confirm')).toHaveLength(1)
    await wrapper.setProps({ disabled: true })
    expect(confirm!.attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })
})
