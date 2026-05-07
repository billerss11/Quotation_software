// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { createAppI18n } from '@/shared/i18n/createAppI18n'

import CustomerLibraryToolbar from './CustomerLibraryToolbar.vue'

describe('CustomerLibraryToolbar', () => {
  it('shows only the create action now that library file management lives in Settings', () => {
    const wrapper = mount(CustomerLibraryToolbar, {
      props: {
        recordCount: 3,
      },
      global: {
        plugins: [createAppI18n('en-US')],
        stubs: {
          Button: {
            props: ['label'],
            template: '<button>{{ label }}</button>',
          },
        },
      },
    })

    const buttonLabels = wrapper.findAll('button').map((button) => button.text())

    expect(buttonLabels).toEqual(['New customer'])
  })
})
