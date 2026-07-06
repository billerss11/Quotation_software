import { describe, expect, it } from 'vitest'

import { getQuotationSupportPanelGroups } from './quotationSupportPanels'

describe('quotation support panels', () => {
  it('groups panels by quotation task', () => {
    expect(getQuotationSupportPanelGroups()).toEqual([
      {
        value: 'setup',
        icon: 'pi pi-id-card',
        panels: [
          { value: 'quoteInfo', icon: 'pi pi-id-card' },
          { value: 'customer', icon: 'pi pi-users' },
        ],
      },
      {
        value: 'pricing',
        icon: 'pi pi-calculator',
        panels: [
          { value: 'pricing', icon: 'pi pi-calculator' },
          { value: 'rates', icon: 'pi pi-chart-line' },
        ],
      },
      {
        value: 'structure',
        icon: 'pi pi-list',
        panels: [
          { value: 'outline', icon: 'pi pi-list' },
        ],
      },
    ])
  })
})
