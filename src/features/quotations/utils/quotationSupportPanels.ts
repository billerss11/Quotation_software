export type QuotationSupportPanelValue =
  | 'outline'
  | 'quoteInfo'
  | 'customer'
  | 'pricing'
  | 'rates'

export type QuotationSupportPanelGroupValue = 'setup' | 'pricing' | 'structure'

export interface QuotationSupportPanel {
  value: QuotationSupportPanelValue
  icon: string
}

export interface QuotationSupportPanelGroup {
  value: QuotationSupportPanelGroupValue
  icon: string
  panels: QuotationSupportPanel[]
}

const quoteInfoPanel: QuotationSupportPanel = { value: 'quoteInfo', icon: 'pi pi-id-card' }
const customerPanel: QuotationSupportPanel = { value: 'customer', icon: 'pi pi-users' }
const pricingPanel: QuotationSupportPanel = { value: 'pricing', icon: 'pi pi-calculator' }
const ratesPanel: QuotationSupportPanel = { value: 'rates', icon: 'pi pi-chart-line' }
const outlinePanel: QuotationSupportPanel = { value: 'outline', icon: 'pi pi-list' }

export function getQuotationSupportPanelGroups(): QuotationSupportPanelGroup[] {
  return [
    {
      value: 'setup',
      icon: 'pi pi-id-card',
      panels: [quoteInfoPanel, customerPanel],
    },
    {
      value: 'pricing',
      icon: 'pi pi-calculator',
      panels: [pricingPanel, ratesPanel],
    },
    {
      value: 'structure',
      icon: 'pi pi-list',
      panels: [outlinePanel],
    },
  ]
}
