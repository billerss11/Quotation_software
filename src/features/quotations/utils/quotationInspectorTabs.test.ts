import { describe, expect, it } from 'vitest'

import { getQuotationInspectorTabs } from './quotationInspectorTabs'

describe('quotation inspector tabs', () => {
  it('orders supporting panels for fast line-item entry', () => {
    expect(getQuotationInspectorTabs()).toEqual([
      { value: 'totals', label: 'Totals', icon: 'pi pi-calculator' },
      { value: 'rates', label: 'Rates', icon: 'pi pi-chart-line' },
      { value: 'header', label: 'Header', icon: 'pi pi-id-card' },
      { value: 'preview', label: 'Preview', icon: 'pi pi-file-pdf' },
      { value: 'navigate', label: 'Items', icon: 'pi pi-list' },
    ])
  })
})
