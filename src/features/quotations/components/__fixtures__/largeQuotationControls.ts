import { createInitialQuotation } from '../../utils/quotationDraft'
import { createQuotationItem } from '../../utils/quotationItems'

export function createLargeControlsQuotation(flat = false) {
  const quotation = createInitialQuotation([], 'en-US')
  quotation.header.projectName = 'Synthetic control verification'
  quotation.header.customerCompany = 'Synthetic customer'
  quotation.exchangeRates = { USD: 1, EUR: 1.08, CNY: 0.14 }
  quotation.majorItems = flat
    ? Array.from({ length: 404 }, (_, index) => createQuotationItem('USD', {
      id: `synthetic-${index + 1}`,
      name: `Synthetic item ${index + 1}`,
      quantity: 1,
      unitCost: 100,
    }))
    : Array.from({ length: 4 }, (_, groupIndex) => createQuotationItem('USD', {
      id: `synthetic-group-${groupIndex + 1}`,
      name: `Synthetic group ${groupIndex + 1}`,
      quantity: 1,
      children: Array.from({ length: 100 }, (_, index) => createQuotationItem('USD', {
        id: `synthetic-${groupIndex + 1}-${index + 1}`,
        name: `Synthetic item ${groupIndex + 1}.${index + 1}`,
        quantity: 1,
        unitCost: 100,
      })),
    }))
  return quotation
}
