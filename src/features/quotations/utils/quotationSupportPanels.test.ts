import { describe, expect, it } from 'vitest'

import { getQuotationSupportPanels } from './quotationSupportPanels'

describe('quotation support panels', () => {
  it('orders task-based panels around the line-item workflow', () => {
    expect(getQuotationSupportPanels()).toEqual([
      { value: 'outline', label: 'Outline', icon: 'pi pi-list' },
      { value: 'quoteInfo', label: 'Quote info', icon: 'pi pi-id-card' },
      { value: 'customer', label: 'Customer', icon: 'pi pi-user' },
      { value: 'pricing', label: 'Pricing & tax', icon: 'pi pi-calculator' },
      { value: 'rates', label: 'FX rates', icon: 'pi pi-chart-line' },
    ])
  })
})
