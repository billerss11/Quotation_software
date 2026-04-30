/// <reference types="vite/client" />

import type { QuotationAppApi } from './shared/contracts/quotationApp'

declare global {
  interface Window {
    quotationApp?: QuotationAppApi
  }
}
