import { describe, expect, it } from 'vitest'

import { getQuotationSupportPanelGroups, getQuotationSupportPanels } from './quotationSupportPanels'

describe('quotation support panels', () => {
  it('orders task-based panels around the line-item workflow', () => {
    expect(getQuotationSupportPanels()).toEqual([
      { value: 'quoteInfo', label: 'Quote info', icon: 'pi pi-id-card' },
      { value: 'customer', label: 'Customer', icon: 'pi pi-user' },
      { value: 'pricing', label: 'Pricing & tax', icon: 'pi pi-calculator' },
      { value: 'rates', label: 'FX rates', icon: 'pi pi-chart-line' },
      { value: 'outline', label: 'Outline', icon: 'pi pi-list' },
    ])
  })

  it('groups panels by quotation task', () => {
    expect(getQuotationSupportPanelGroups()).toEqual([
      {
        value: 'setup',
        label: 'Setup',
        description: 'Quote details, customer, and company profile',
        icon: 'pi pi-id-card',
        panels: [
          { value: 'quoteInfo', label: 'Quote info', icon: 'pi pi-id-card' },
          { value: 'customer', label: 'Customer', icon: 'pi pi-user' },
        ],
      },
      {
        value: 'pricing',
        label: 'Pricing',
        description: 'Markup, discounts, tax, and exchange rates',
        icon: 'pi pi-calculator',
        panels: [
          { value: 'pricing', label: 'Pricing & tax', icon: 'pi pi-calculator' },
          { value: 'rates', label: 'FX rates', icon: 'pi pi-chart-line' },
        ],
      },
      {
        value: 'structure',
        label: 'Structure',
        description: 'Navigate and reorder quote sections',
        icon: 'pi pi-list',
        panels: [
          { value: 'outline', label: 'Outline', icon: 'pi pi-list' },
        ],
      },
    ])
  })
})
