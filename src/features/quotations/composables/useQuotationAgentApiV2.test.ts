import { ref, shallowRef } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import { QUOTATION_AUTOMATION_API_VERSION } from '@/shared/contracts/quotationAutomation'
import type { QuotationRuntime } from '@/shared/runtime/quotationRuntime'

import type { QuotationTotals } from '../types'
import { createInitialQuotation } from '../utils/quotationDraft'
import { parseQuotationFileContent, QUOTATION_FILE_SCHEMA_VERSION } from '../utils/quotationFile'
import { useQuotationAgentApiV2 } from './useQuotationAgentApiV2'

describe('useQuotationAgentApiV2', () => {
  it('reports stable identity and accurate host capabilities', async () => {
    const { api } = createHarness({ host: 'headless' })

    await expect(api.getApiInfo()).resolves.toMatchObject({
      apiVersion: QUOTATION_AUTOMATION_API_VERSION,
      appVersion: '0.1.0-test',
      quotationSchemaVersion: QUOTATION_FILE_SCHEMA_VERSION,
      capabilities: {
        host: 'headless',
        pathImport: true,
        pathExport: true,
        directPdfExport: true,
        browserPrint: false,
        batchOperations: false,
      },
      supportedLocales: ['en-US', 'zh-CN'],
      supportedTaxModes: ['single', 'mixed'],
    })
  })

  it('serializes a detached schema-v2 quotation snapshot', async () => {
    const { api, quotation } = createHarness()

    const result = await api.serializeQuotation()

    expect(result).toMatchObject({
      ok: true,
      data: {
        schemaVersion: QUOTATION_FILE_SCHEMA_VERSION,
        revision: 0,
      },
      meta: {
        apiVersion: QUOTATION_AUTOMATION_API_VERSION,
        revision: 0,
        requestId: expect.any(String),
        warnings: [],
      },
    })
    if (!result.ok) return

    expect(parseQuotationFileContent(result.data.content)).toEqual(result.data.quotation)
    result.data.quotation.header.projectName = 'Detached change'
    expect(quotation.value.header.projectName).not.toBe('Detached change')
  })

  it('validates supplied content without replacing the active quotation', async () => {
    const { api, quotation } = createHarness()
    const originalQuotationId = quotation.value.id

    const result = await api.validateQuotationContent('{not-json')

    expect(result).toMatchObject({
      ok: true,
      data: {
        valid: false,
        schemaVersion: QUOTATION_FILE_SCHEMA_VERSION,
        issues: [{
          code: 'invalid_json',
          severity: 'error',
          fieldPath: '$',
        }],
      },
    })
    expect(quotation.value.id).toBe(originalQuotationId)
  })

  it('validates the active quotation without changing it', async () => {
    const { api, quotation } = createHarness()
    const original = JSON.stringify(quotation.value)

    const result = await api.validateQuotation()

    expect(result).toMatchObject({
      ok: true,
      data: {
        valid: true,
        schemaVersion: QUOTATION_FILE_SCHEMA_VERSION,
        issues: [],
      },
    })
    expect(JSON.stringify(quotation.value)).toBe(original)
  })

  it('rejects a non-string validation argument through the machine contract', async () => {
    const { api } = createHarness()

    const result = await api.validateQuotationContent(123 as unknown as string)

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: 'invalid_argument',
        fieldPath: 'content',
      },
      meta: {
        apiVersion: QUOTATION_AUTOMATION_API_VERSION,
        revision: 0,
      },
    })
  })

  it('advances the observed revision only when quotation state changes', async () => {
    const { api, quotation } = createHarness()

    const initial = await api.getQuotationSnapshot()
    quotation.value.header.projectName = 'Revision change'
    const changed = await api.getQuotationSnapshot()
    const unchanged = await api.getQuotationSnapshot()

    expect(initial.meta.revision).toBe(0)
    expect(changed.meta.revision).toBe(1)
    expect(unchanged.meta.revision).toBe(1)
  })
})

function createHarness(options: { host?: 'desktop-ui' | 'web-ui' | 'headless' } = {}) {
  const quotation = ref(createInitialQuotation([], 'en-US'))
  const itemSummaries = ref([])
  const totals = ref<QuotationTotals>({
    baseSubtotal: 0,
    markupAmount: 0,
    subtotalAfterMarkup: 0,
    taxableSubtotal: 0,
    taxAmount: 0,
    grandTotal: 0,
    taxBuckets: [],
  })
  const currentFilePath = shallowRef('')
  const runtime: Pick<QuotationRuntime, 'capabilities' | 'getAppVersion'> = {
    capabilities: {
      isDesktop: true,
      hasNativeFileDialogs: true,
      supportsFileSystemAccess: false,
      supportsDirectPdfExport: true,
      supportsBrowserPrint: false,
    },
    getAppVersion: vi.fn().mockResolvedValue('0.1.0-test'),
  }
  const api = useQuotationAgentApiV2({
    quotation,
    itemSummaries,
    totals,
    currentFilePath,
    runtime,
    host: options.host,
  })

  return { api, quotation }
}
