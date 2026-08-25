/// <reference types="vite/client" />

import type { QuotationAgentApiV2, QuotationAutomationApiInfo } from './shared/contracts/quotationAutomation'
import type { QuotationAgentApi, QuotationAppApi } from './shared/contracts/quotationApp'

declare global {
  interface Window {
    quotationApp?: QuotationAppApi
    quotationAgent?: QuotationAgentApi
    quotationAgentV2?: QuotationAgentApiV2
    quotationAgentReady?: Promise<QuotationAutomationApiInfo>
  }
}
