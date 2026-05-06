// @vitest-environment jsdom

import { ref, shallowRef } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { QuotationAppApi } from '@/shared/contracts/quotationApp'
import type { QuotationRuntime } from '@/shared/runtime/quotationRuntime'

import type { MajorItemSummary, QuotationDraft, QuotationTotals } from '../types'
import { createInitialQuotation } from '../utils/quotationDraft'
import { createQuotationFileContent } from '../utils/quotationFile'
import { useQuotationFileActions } from './useQuotationFileActions'

describe('useQuotationFileActions', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('saves the quotation through the native file API and persists the draft state', async () => {
    const saveQuotationFile = vi.fn().mockResolvedValue({
      canceled: false,
      filePath: 'C:/quotes/quote-a.json',
    })
    const saveCurrentQuotation = vi.fn()
    const flushPendingEdits = vi.fn()
    const { actions, currentFilePath, statusMessage } = createHarness({
      quotationApp: {
        saveQuotationFile,
      },
      saveCurrentQuotation,
      flushPendingEdits,
    })

    await actions.saveDraft()

    expect(flushPendingEdits).toHaveBeenCalledTimes(1)
    expect(saveQuotationFile).toHaveBeenCalledTimes(1)
    expect(saveCurrentQuotation).toHaveBeenCalledTimes(1)
    expect(currentFilePath.value).toBe('C:/quotes/quote-a.json')
    expect(statusMessage.value).toContain('quotations.statuses.saved')
  })

  it('imports quotation JSON through the native file API', async () => {
    const quotation = createInitialQuotation([], 'en-US')
    quotation.header.projectName = 'Imported project'
    const replaceQuotationDraft = vi.fn()
    const saveCurrentQuotation = vi.fn()
    const { actions, currentFilePath, statusMessage } = createHarness({
      quotationApp: {
        openQuotationFile: vi.fn().mockResolvedValue({
          canceled: false,
          filePath: 'C:/quotes/imported.json',
          content: createQuotationFileContent(quotation),
        }),
      },
      replaceQuotationDraft,
      saveCurrentQuotation,
    })

    await actions.importJson()

    expect(replaceQuotationDraft).toHaveBeenCalledTimes(1)
    expect(replaceQuotationDraft.mock.calls[0]?.[0].header.projectName).toBe('Imported project')
    expect(saveCurrentQuotation).toHaveBeenCalledTimes(1)
    expect(currentFilePath.value).toBe('C:/quotes/imported.json')
    expect(statusMessage.value).toContain('quotations.statuses.imported')
  })

  it('reports CSV template export as a download when the runtime uses browser fallback saving', async () => {
    const saveLineItemsCsvTemplateFile = vi.fn().mockResolvedValue({
      canceled: false,
      filePath: 'quotation-line-items-template.csv',
      mode: 'download',
    })
    const { actions, statusMessage } = createHarness({
      runtime: createRuntimeMock({
        capabilities: {
          isDesktop: false,
          hasNativeFileDialogs: false,
          supportsFileSystemAccess: false,
          supportsDirectPdfExport: false,
          supportsBrowserPrint: true,
        },
        saveLineItemsCsvTemplateFile,
      }),
    })

    await actions.exportCsvTemplate()

    expect(saveLineItemsCsvTemplateFile).toHaveBeenCalledTimes(1)
    expect(statusMessage.value).toContain('quotations.statuses.downloaded')
  })

  it('opens the browser print flow when direct PDF export is unavailable', async () => {
    const exportQuotationDocument = vi.fn().mockResolvedValue({
      canceled: false,
      filePath: 'quotation.pdf',
      mode: 'browser-print',
    })
    const { actions, statusMessage } = createHarness({
      runtime: createRuntimeMock({
        capabilities: {
          isDesktop: false,
          hasNativeFileDialogs: false,
          supportsFileSystemAccess: false,
          supportsDirectPdfExport: false,
          supportsBrowserPrint: true,
        },
        exportQuotationDocument,
      }),
    })

    await actions.exportQuotationPdf()

    expect(exportQuotationDocument).toHaveBeenCalledTimes(1)
    expect(statusMessage.value).toContain('quotations.statuses.printOpened')
  })
})

function createHarness(overrides: Partial<CreateHarnessOptions> = {}) {
  const quotation = ref(createInitialQuotation([], 'en-US'))
  const saveCurrentQuotation = overrides.saveCurrentQuotation ?? vi.fn()
  const replaceQuotationDraft = overrides.replaceQuotationDraft ?? vi.fn((draft: QuotationDraft) => {
    quotation.value = draft
  })
  const replaceLineItems = overrides.replaceLineItems ?? vi.fn()
  const setLogoDataUrl = overrides.setLogoDataUrl ?? vi.fn()
  const flushPendingEdits = overrides.flushPendingEdits ?? vi.fn()
  const itemSummaries = ref<MajorItemSummary[]>([])
  const totals = ref<QuotationTotals>({
    baseSubtotal: 0,
    markupAmount: 0,
    subtotalAfterMarkup: 0,
    discountAmount: 0,
    taxableSubtotal: 0,
    taxAmount: 0,
    grandTotal: 0,
    taxBuckets: [],
  })
  const runtime = overrides.runtime ?? createRuntimeMock({
    saveQuotationFile: mapBridgeSaveMock(overrides.quotationApp?.saveQuotationFile),
    openQuotationFile: overrides.quotationApp?.openQuotationFile,
    openLineItemsCsvFile: overrides.quotationApp?.openLineItemsCsvFile,
    saveLineItemsCsvFile: mapBridgeSaveMock(overrides.quotationApp?.saveLineItemsCsvFile),
    saveLineItemsCsvTemplateFile: mapBridgeSaveMock(overrides.quotationApp?.saveLineItemsCsvTemplateFile),
    saveCustomerLibraryFile: mapBridgeSaveMock(overrides.quotationApp?.saveCustomerLibraryFile),
    openCustomerLibraryFile: overrides.quotationApp?.openCustomerLibraryFile,
    exportQuotationDocument: mapBridgeSaveMock(overrides.quotationApp?.exportQuotationPdf),
  })

  const actions = useQuotationFileActions({
    quotation,
    itemSummaries,
    totals,
    flushPendingEdits,
    runtime,
    saveCurrentQuotation,
    replaceQuotationDraft,
    replaceLineItems,
    setLogoDataUrl,
    t: createTranslator(),
  })

  return {
    actions,
    quotation,
    currentFilePath: actions.currentFilePath,
    statusMessage: actions.statusMessage,
    saveCurrentQuotation,
    replaceQuotationDraft,
    replaceLineItems,
  }
}

interface CreateHarnessOptions {
  quotationApp: Partial<QuotationAppApi>
  runtime: QuotationRuntime
  flushPendingEdits: () => void
  saveCurrentQuotation: () => void
  replaceQuotationDraft: (draft: QuotationDraft) => void
  replaceLineItems: (...args: unknown[]) => void
  setLogoDataUrl: (logoDataUrl: string) => void
}

function createQuotationAppMock(overrides: Partial<QuotationAppApi> = {}): Partial<QuotationAppApi> {
  return {
    getVersion: vi.fn() as QuotationAppApi['getVersion'],
    saveQuotationFile: overrides.saveQuotationFile as QuotationAppApi['saveQuotationFile'] | undefined,
    openQuotationFile: overrides.openQuotationFile as QuotationAppApi['openQuotationFile'] | undefined,
    openLineItemsCsvFile: overrides.openLineItemsCsvFile as QuotationAppApi['openLineItemsCsvFile'] | undefined,
    saveLineItemsCsvFile: overrides.saveLineItemsCsvFile as QuotationAppApi['saveLineItemsCsvFile'] | undefined,
    saveLineItemsCsvTemplateFile: overrides.saveLineItemsCsvTemplateFile as QuotationAppApi['saveLineItemsCsvTemplateFile'] | undefined,
    saveCustomerLibraryFile: vi.fn() as QuotationAppApi['saveCustomerLibraryFile'],
    openCustomerLibraryFile: vi.fn() as QuotationAppApi['openCustomerLibraryFile'],
    exportQuotationPdf: overrides.exportQuotationPdf as QuotationAppApi['exportQuotationPdf'] | undefined,
    getQuotationPdfPayload: vi.fn() as QuotationAppApi['getQuotationPdfPayload'],
    notifyQuotationPdfReady: vi.fn() as QuotationAppApi['notifyQuotationPdfReady'],
  }
}

function createRuntimeMock(overrides: Partial<QuotationRuntime> = {}): QuotationRuntime {
  return {
    capabilities: {
      isDesktop: true,
      hasNativeFileDialogs: true,
      supportsFileSystemAccess: false,
      supportsDirectPdfExport: true,
      supportsBrowserPrint: false,
      ...(overrides.capabilities ?? {}),
    },
    saveQuotationFile: vi.fn().mockResolvedValue({
      canceled: false,
      filePath: 'quote.json',
      mode: 'native',
    }),
    openQuotationFile: vi.fn().mockResolvedValue({
      canceled: true,
    }),
    openLineItemsCsvFile: vi.fn().mockResolvedValue({
      canceled: true,
    }),
    saveLineItemsCsvFile: vi.fn().mockResolvedValue({
      canceled: false,
      filePath: 'items.csv',
      mode: 'native',
    }),
    saveLineItemsCsvTemplateFile: vi.fn().mockResolvedValue({
      canceled: false,
      filePath: 'template.csv',
      mode: 'native',
    }),
    saveCustomerLibraryFile: vi.fn().mockResolvedValue({
      canceled: false,
      filePath: 'customers.json',
      mode: 'native',
    }),
    openCustomerLibraryFile: vi.fn().mockResolvedValue({
      canceled: true,
    }),
    exportQuotationDocument: vi.fn().mockResolvedValue({
      canceled: false,
      filePath: 'quote.pdf',
      mode: 'native',
    }),
    getQuotationPrintPayload: vi.fn(),
    notifyQuotationPrintReady: vi.fn(),
    ...overrides,
  }
}

function mapBridgeSaveMock<T extends (...args: never[]) => Promise<{ canceled: true } | { canceled: false; filePath: string }>>(
  fn: T | undefined,
) {
  if (!fn) {
    return undefined
  }

  return vi.fn(async (...args: Parameters<T>) => {
    const result = await fn(...args)

    if (result.canceled) {
      return result
    }

    return {
      ...result,
      mode: 'native' as const,
    }
  })
}

function createTranslator() {
  return (key: string, params?: Record<string, string | number>) => {
    if (!params) {
      return key
    }

    return `${key}:${JSON.stringify(params)}`
  }
}
