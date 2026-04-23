/// <reference types="vite/client" />

import type { QuotationAppApi } from '../electron/preload'

declare global {
  interface Window {
    quotationApp?: QuotationAppApi
  }
}
