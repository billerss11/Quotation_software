import type {
  QuotationAgentApiV2,
  QuotationAutomationApiInfo,
} from '@/shared/contracts/quotationAutomation'
import type { QuotationAgentApi } from '@/shared/contracts/quotationApp'

let resolveAgentReady: ((info: QuotationAutomationApiInfo) => void) | null = null

export function installQuotationAgentReadyPromise() {
  if (!window.quotationAgentReady) {
    window.quotationAgentReady = new Promise<QuotationAutomationApiInfo>((resolve) => {
      resolveAgentReady = resolve
    })
  }

  return window.quotationAgentReady
}

export function registerQuotationAgentApis(legacyApi: QuotationAgentApi, apiV2: QuotationAgentApiV2) {
  installQuotationAgentReadyPromise()
  window.quotationAgent = legacyApi
  window.quotationAgentV2 = apiV2

  void apiV2.waitUntilReady().then((info) => {
    resolveAgentReady?.(info)
    resolveAgentReady = null
  })

  return () => {
    if (window.quotationAgent === legacyApi) {
      delete window.quotationAgent
    }
    if (window.quotationAgentV2 === apiV2) {
      delete window.quotationAgentV2
    }
  }
}
