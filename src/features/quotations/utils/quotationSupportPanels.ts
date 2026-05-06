export type QuotationSupportPanelValue =
  | 'outline'
  | 'quoteInfo'
  | 'customer'
  | 'pricing'
  | 'rates'

export interface QuotationSupportPanel {
  value: QuotationSupportPanelValue
  label: string
  icon: string
}

export function getQuotationSupportPanels(): QuotationSupportPanel[] {
  return [
    { value: 'outline', label: 'Outline', icon: 'pi pi-list' },
    { value: 'quoteInfo', label: 'Quote info', icon: 'pi pi-id-card' },
    { value: 'customer', label: 'Customer', icon: 'pi pi-user' },
    { value: 'pricing', label: 'Pricing & tax', icon: 'pi pi-calculator' },
    { value: 'rates', label: 'FX rates', icon: 'pi pi-chart-line' },
  ]
}
