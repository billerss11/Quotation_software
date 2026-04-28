import { describe, expect, it } from 'vitest'

import { getQuotationSupportPanels } from './quotationSupportPanels'

describe('quotation support panels', () => {
  it('orders task-based panels around the line-item workflow', () => {
    expect(getQuotationSupportPanels()).toEqual([
      { value: 'pricing', label: 'Pricing', icon: 'pi pi-calculator' },
      { value: 'setup', label: 'Quote Setup', icon: 'pi pi-id-card' },
      { value: 'rates', label: 'Exchange Rates', icon: 'pi pi-chart-line' },
      { value: 'outline', label: 'Outline', icon: 'pi pi-list' },
    ])
  })
})
