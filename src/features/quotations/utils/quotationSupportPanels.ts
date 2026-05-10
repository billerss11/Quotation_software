export type QuotationSupportPanelValue =
  | 'outline'
  | 'quoteInfo'
  | 'customer'
  | 'pricing'
  | 'rates'

export type QuotationSupportPanelGroupValue = 'setup' | 'pricing' | 'structure'

export interface QuotationSupportPanel {
  value: QuotationSupportPanelValue
  label: string
  icon: string
}

export interface QuotationSupportPanelGroup {
  value: QuotationSupportPanelGroupValue
  label: string
  description: string
  icon: string
  panels: QuotationSupportPanel[]
}

const quoteInfoPanel: QuotationSupportPanel = { value: 'quoteInfo', label: 'Quote info', icon: 'pi pi-id-card' }
const customerPanel: QuotationSupportPanel = { value: 'customer', label: 'Customer', icon: 'pi pi-user' }
const pricingPanel: QuotationSupportPanel = { value: 'pricing', label: 'Pricing & tax', icon: 'pi pi-calculator' }
const ratesPanel: QuotationSupportPanel = { value: 'rates', label: 'FX rates', icon: 'pi pi-chart-line' }
const outlinePanel: QuotationSupportPanel = { value: 'outline', label: 'Outline', icon: 'pi pi-list' }

export function getQuotationSupportPanels(): QuotationSupportPanel[] {
  return getQuotationSupportPanelGroups().flatMap((group) => group.panels)
}

export function getQuotationSupportPanelGroups(): QuotationSupportPanelGroup[] {
  return [
    {
      value: 'setup',
      label: 'Setup',
      description: 'Quote details, customer, and company profile',
      icon: 'pi pi-id-card',
      panels: [quoteInfoPanel, customerPanel],
    },
    {
      value: 'pricing',
      label: 'Pricing',
      description: 'Markup, discounts, tax, and exchange rates',
      icon: 'pi pi-calculator',
      panels: [pricingPanel, ratesPanel],
    },
    {
      value: 'structure',
      label: 'Structure',
      description: 'Navigate and reorder quote sections',
      icon: 'pi pi-list',
      panels: [outlinePanel],
    },
  ]
}
