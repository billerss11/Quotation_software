// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createAppI18n } from '@/shared/i18n/createAppI18n'
import CustomerLibraryEditor from './CustomerLibraryEditor.vue'

describe('CustomerLibraryEditor', () => {
  beforeEach(() => vi.stubGlobal('ResizeObserver', ResizeObserverMock))
  afterEach(() => vi.unstubAllGlobals())

  it('shows inline accessible validation after an invalid save attempt', async () => {
    const wrapper = mount(CustomerLibraryEditor, {
      props: {
        modelValue: {
          id: 'customer-1',
          updatedAt: '',
          customerCompany: '',
          contactPerson: '',
          contactDetails: 'details only',
        },
        mode: 'create',
        canDelete: false,
        isDirty: true,
        validationErrors: ['missing_identity'],
      },
      global: { plugins: [PrimeVue, createAppI18n('en-US')] },
    })

    await wrapper.findAll('button').find((button) => button.text().includes('Save record'))!.trigger('click')

    expect(wrapper.get('#customer-identity-error').text()).toBe('Enter a company or contact person.')
    expect(wrapper.get('input[autocomplete="organization"]').attributes('aria-invalid')).toBe('true')
    expect(wrapper.get('input[autocomplete="name"]').attributes('aria-describedby')).toBe('customer-identity-error')
  })
})

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
