/// <reference types="vite/client" />

import type { QuotationAgentApi, QuotationAppApi } from './shared/contracts/quotationApp'

declare global {
  interface Window {
    quotationApp?: QuotationAppApi
    quotationAgent?: QuotationAgentApi
  }
}
