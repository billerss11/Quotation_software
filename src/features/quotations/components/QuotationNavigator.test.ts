// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { createAppI18n } from '@/shared/i18n/createAppI18n'

import QuotationNavigator from './QuotationNavigator.vue'
import type { QuotationItem } from '../types'

describe('QuotationNavigator', () => {
  it('expands and collapses all visible groups from the header action', async () => {
    const wrapper = mount(QuotationNavigator, {
      props: {
        items: createItems(),
      },
      global: {
        plugins: [createAppI18n('en-US')],
      },
    })

    expect(wrapper.findAll('.nav-row')).toHaveLength(2)

    const bulkToggle = wrapper.get('.navigator-toolbar-action')
    expect(bulkToggle.text()).toContain('Expand all')

    await bulkToggle.trigger('click')

    expect(wrapper.findAll('.nav-row')).toHaveLength(5)
    expect(wrapper.text()).toContain('1.1')
    expect(wrapper.text()).toContain('1.1.1')
    expect(wrapper.text()).toContain('2.1')

    const collapseAll = wrapper.get('.navigator-toolbar-action')
    expect(collapseAll.text()).toContain('Collapse all')

    await collapseAll.trigger('click')

    expect(wrapper.findAll('.nav-row')).toHaveLength(2)
    expect(wrapper.text()).not.toContain('1.1')
    expect(wrapper.text()).not.toContain('1.1.1')
    expect(wrapper.text()).not.toContain('2.1')
  })
})

function createItems(): QuotationItem[] {
  return [
    {
      id: 'item-1',
      name: 'Pump package',
      description: '',
      quantity: 1,
      quantityUnit: 'set',
      unitCost: 0,
      costCurrency: 'USD',
      children: [
        {
          id: 'item-1-1',
          name: 'Pump skid',
          description: '',
          quantity: 1,
          quantityUnit: 'set',
          unitCost: 0,
          costCurrency: 'USD',
          children: [
            {
              id: 'item-1-1-1',
              name: 'Motor',
              description: '',
              quantity: 1,
              quantityUnit: 'pc',
              unitCost: 120,
              costCurrency: 'USD',
              children: [],
            },
          ],
        },
      ],
    },
    {
      id: 'item-2',
      name: 'Base frame',
      description: '',
      quantity: 1,
      quantityUnit: 'pc',
      unitCost: 40,
      costCurrency: 'USD',
      children: [
        {
          id: 'item-2-1',
          name: 'Anchor bolts',
          description: '',
          quantity: 4,
          quantityUnit: 'pc',
          unitCost: 5,
          costCurrency: 'USD',
          children: [],
        },
      ],
    },
  ]
}
