/// <reference types="vite/client" />

import type { QuotationAppApi } from '../electron/preload-api'

declare global {
  interface Window {
    quotationApp?: QuotationAppApi
  }
}
