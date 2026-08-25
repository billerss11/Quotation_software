// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'

import type {
  QuotationAgentApiV2,
  QuotationAutomationApiInfo,
} from '@/shared/contracts/quotationAutomation'
import type { QuotationAgentApi } from '@/shared/contracts/quotationApp'

import {
  installQuotationAgentReadyPromise,
  registerQuotationAgentApis,
} from './quotationAutomationRegistration'

describe('quotation automation registration', () => {
  afterEach(() => {
    delete window.quotationAgent
    delete window.quotationAgentV2
    delete window.quotationAgentReady
    vi.restoreAllMocks()
  })

  it('keeps the legacy API while resolving the v2 readiness contract', async () => {
    const info = createApiInfo()
    const legacyApi = {} as QuotationAgentApi
    const apiV2 = {
      waitUntilReady: vi.fn().mockResolvedValue(info),
    } as unknown as QuotationAgentApiV2
    const ready = installQuotationAgentReadyPromise()

    const unregister = registerQuotationAgentApis(legacyApi, apiV2)

    expect(window.quotationAgent).toBe(legacyApi)
    expect(window.quotationAgentV2).toBe(apiV2)
    await expect(ready).resolves.toEqual(info)

    unregister()
    expect(window.quotationAgent).toBeUndefined()
    expect(window.quotationAgentV2).toBeUndefined()
  })
})

function createApiInfo(): QuotationAutomationApiInfo {
  return {
    apiVersion: '2.0.0',
    appVersion: '0.1.0-test',
    quotationSchemaVersion: 2,
    capabilities: {
      host: 'desktop-ui',
      pathImport: true,
      pathExport: true,
      directPdfExport: true,
      browserPrint: false,
      exchangeRateRefresh: true,
      goodsReceipt: true,
      batchOperations: false,
    },
    supportedTemplates: ['classic'],
    supportedLocales: ['en-US', 'zh-CN'],
    supportedTaxModes: ['single', 'mixed'],
    supportedMixedTaxColumns: [],
  }
}
