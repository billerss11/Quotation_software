export type QuotationSupportPanelValue = 'pricing' | 'setup' | 'rates'

export interface QuotationSupportPanel {
  value: QuotationSupportPanelValue
  label: string
  icon: string
}

export function getQuotationSupportPanels(): QuotationSupportPanel[] {
  return [
    { value: 'pricing', label: 'Pricing', icon: 'pi pi-calculator' },
    { value: 'setup', label: 'Quote Setup', icon: 'pi pi-id-card' },
    { value: 'rates', label: 'Exchange Rates', icon: 'pi pi-chart-line' },
  ]
}
