// @vitest-environment jsdom

import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'

import { createAppI18n } from '@/shared/i18n/createAppI18n'
import { messages } from '@/shared/i18n/messages'
import type { SupportedLocale } from '@/shared/i18n/locale'

import QuotationWorkflowNav, { type QuotationWorkflowStep } from './QuotationWorkflowNav.vue'

const mounted: VueWrapper[] = []
const steps: QuotationWorkflowStep[] = ['details', 'items', 'pricing', 'review', 'analysis']

function mountNavigation(step: QuotationWorkflowStep = 'details', locale: SupportedLocale = 'en-US') {
  const wrapper: VueWrapper<InstanceType<typeof QuotationWorkflowNav>> = mount(QuotationWorkflowNav, {
    attachTo: document.body,
    props: {
      modelValue: step,
      'onUpdate:modelValue': value => { void wrapper.setProps({ modelValue: value }) },
    },
    global: { plugins: [createAppI18n(locale)] },
  })
  mounted.push(wrapper)
  return wrapper
}

afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount()
  document.body.replaceChildren()
})

describe('QuotationWorkflowNav', () => {
  it.each(['en-US', 'zh-CN'] as const)('names all stages and their tab panels in %s', locale => {
    const wrapper = mountNavigation('details', locale)
    const copy = messages[locale].workspace
    expect(wrapper.get('[role="tablist"]').attributes('aria-label')).toBe(copy.navigation)
    for (const step of steps) {
      const tab = wrapper.get(`#workflow-tab-${step}`)
      expect(tab.get('span:last-child').text()).toBe(copy[step])
      expect(tab.attributes('aria-controls')).toBe(`workflow-panel-${step}`)
      expect(tab.attributes('tabindex')).toBe(step === 'details' ? '0' : '-1')
    }
  })

  it('updates selection when a stage is clicked and keeps one tab stop', async () => {
    const wrapper = mountNavigation()
    await wrapper.get('#workflow-tab-review').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([['review']])
    expect(wrapper.get('[aria-selected="true"]').attributes('id')).toBe('workflow-tab-review')
    expect(wrapper.findAll('[tabindex="0"]')).toHaveLength(1)
    expect(wrapper.get('#workflow-tab-details').attributes('aria-selected')).toBe('false')
  })

  it.each([
    ['details', 'ArrowRight', 'items'],
    ['review', 'ArrowLeft', 'pricing'],
    ['analysis', 'ArrowRight', 'details'],
    ['details', 'ArrowLeft', 'analysis'],
    ['pricing', 'Home', 'details'],
    ['items', 'End', 'analysis'],
  ] as const)('moves selection and keyboard focus from %s with %s to %s', async (from, key, to) => {
    const wrapper = mountNavigation(from)
    await wrapper.get(`#workflow-tab-${from}`).trigger('keydown', { key })
    const selected = wrapper.get(`#workflow-tab-${to}`)
    expect(wrapper.emitted('update:modelValue')).toEqual([[to]])
    expect(selected.attributes('aria-selected')).toBe('true')
    expect(selected.attributes('tabindex')).toBe('0')
    expect(document.activeElement).toBe(selected.element)
  })

  it('leaves unrelated keys available to the browser', async () => {
    const wrapper = mountNavigation()
    await wrapper.get('#workflow-tab-details').trigger('keydown', { key: 'Tab' })
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })
})
