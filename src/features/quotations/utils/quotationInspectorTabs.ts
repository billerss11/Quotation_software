export type QuotationInspectorTabValue = 'totals' | 'rates' | 'header' | 'preview' | 'navigate'

export interface QuotationInspectorTab {
  value: QuotationInspectorTabValue
  label: string
  icon: string
}

export function getQuotationInspectorTabs(): QuotationInspectorTab[] {
  return [
    { value: 'totals', label: 'Totals', icon: 'pi pi-calculator' },
    { value: 'rates', label: 'Rates', icon: 'pi pi-chart-line' },
    { value: 'header', label: 'Header', icon: 'pi pi-id-card' },
    { value: 'preview', label: 'Preview', icon: 'pi pi-file-pdf' },
    { value: 'navigate', label: 'Items', icon: 'pi pi-list' },
  ]
}
