// @vitest-environment jsdom

import { ref } from 'vue'
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

  it('imports quotation JSON from a file path for agent automation', async () => {
    const quotation = createInitialQuotation([], 'en-US')
    quotation.header.projectName = 'Agent imported project'
    const openQuotationFileFromPath = vi.fn().mockResolvedValue({
      canceled: false,
      filePath: 'C:/quotes/agent-imported.json',
      content: createQuotationFileContent(quotation),
    })
    const replaceQuotationDraft = vi.fn()
    const saveCurrentQuotation = vi.fn()
    const { actions, currentFilePath, statusMessage } = createHarness({
      runtime: createRuntimeMock({
        openQuotationFileFromPath,
      }),
      replaceQuotationDraft,
      saveCurrentQuotation,
    })

    await expect(actions.importJsonFromPath('C:/quotes/agent-imported.json')).resolves.toBe(true)

    expect(openQuotationFileFromPath).toHaveBeenCalledWith('C:/quotes/agent-imported.json')
    expect(replaceQuotationDraft).toHaveBeenCalledTimes(1)
    expect(replaceQuotationDraft.mock.calls[0]?.[0].header.projectName).toBe('Agent imported project')
    expect(saveCurrentQuotation).toHaveBeenCalledTimes(1)
    expect(currentFilePath.value).toBe('C:/quotes/agent-imported.json')
    expect(statusMessage.value).toContain('quotations.statuses.imported')
  })

  it('imports quotation JSON content without treating the display name as a save path', async () => {
    const quotation = createInitialQuotation([], 'en-US')
    quotation.header.projectName = 'Agent content project'
    const saveQuotationFile = vi.fn().mockResolvedValue({
      canceled: false,
      filePath: 'C:/quotes/saved-after-content-import.json',
      mode: 'native',
    })
    const replaceQuotationDraft = vi.fn()
    const { actions, currentFilePath } = createHarness({
      runtime: createRuntimeMock({
        saveQuotationFile,
      }),
      replaceQuotationDraft,
    })

    await expect(actions.importJsonContent(createQuotationFileContent(quotation))).resolves.toBe(true)

    expect(replaceQuotationDraft).toHaveBeenCalledTimes(1)
    expect(replaceQuotationDraft.mock.calls[0]?.[0].header.projectName).toBe('Agent content project')
    expect(currentFilePath.value).toBe('')

    await actions.saveDraft()

    expect(saveQuotationFile).toHaveBeenCalledWith(expect.objectContaining({
      filePath: undefined,
    }))
  })

  it('imports line item CSV from a file path for agent automation', async () => {
    const openLineItemsCsvFileFromPath = vi.fn().mockResolvedValue({
      canceled: false,
      filePath: 'C:/quotes/items.csv',
      content: [
        'item_code,item_name,item_description,qty,qty_unit,pricing_basis,unit_price,unit_cost,cost_currency,tax_class,markup_override,expected_total',
        '1,Imported line,,2,ea,cost_plus,,10,USD,,,',
        '',
      ].join('\n'),
    })
    const replaceLineItems = vi.fn()
    const saveCurrentQuotation = vi.fn()
    const { actions, statusMessage } = createHarness({
      runtime: createRuntimeMock({
        openLineItemsCsvFileFromPath,
      }),
      replaceLineItems,
      saveCurrentQuotation,
    })

    await expect(actions.importCsvFromPath('C:/quotes/items.csv')).resolves.toBe(true)

    expect(openLineItemsCsvFileFromPath).toHaveBeenCalledWith('C:/quotes/items.csv')
    expect(replaceLineItems).toHaveBeenCalledTimes(1)
    expect(replaceLineItems.mock.calls[0]?.[0][0].name).toBe('Imported line')
    expect(saveCurrentQuotation).toHaveBeenCalledTimes(1)
    expect(statusMessage.value).toContain('quotations.statuses.importedCsv')
  })

  it('auto-imports the dev quotation file when one is available', async () => {
    const quotation = createInitialQuotation([], 'en-US')
    quotation.header.projectName = 'Dev import project'
    const replaceQuotationDraft = vi.fn()
    const saveCurrentQuotation = vi.fn()
    const { actions, currentFilePath, statusMessage } = createHarness({
      runtime: createRuntimeMock({
        openDevAutoImportQuotationFile: vi.fn().mockResolvedValue({
          canceled: false,
          filePath: 'J:/cx_coding_project_unsyc/js/Quotation_software/file/Q-2026-048.json',
          content: createQuotationFileContent(quotation),
        }),
      }),
      replaceQuotationDraft,
      saveCurrentQuotation,
    })

    await actions.autoImportDevQuotation()

    expect(replaceQuotationDraft).toHaveBeenCalledTimes(1)
    expect(replaceQuotationDraft.mock.calls[0]?.[0].header.projectName).toBe('Dev import project')
    expect(saveCurrentQuotation).toHaveBeenCalledTimes(1)
    expect(currentFilePath.value).toContain('Q-2026-048.json')
    expect(statusMessage.value).toContain('quotations.statuses.imported')
  })

  it('does nothing when no dev quotation file is available', async () => {
    const replaceQuotationDraft = vi.fn()
    const saveCurrentQuotation = vi.fn()
    const { actions, currentFilePath, statusMessage } = createHarness({
      runtime: createRuntimeMock({
        openDevAutoImportQuotationFile: vi.fn().mockResolvedValue({
          canceled: true,
        }),
      }),
      replaceQuotationDraft,
      saveCurrentQuotation,
    })

    await actions.autoImportDevQuotation()

    expect(replaceQuotationDraft).not.toHaveBeenCalled()
    expect(saveCurrentQuotation).not.toHaveBeenCalled()
    expect(currentFilePath.value).toBe('')
    expect(statusMessage.value).toBe('')
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

  it('exports quotation PDF to a provided file path for agent automation', async () => {
    const exportQuotationDocument = vi.fn().mockResolvedValue({
      canceled: false,
      filePath: 'C:/quotes/agent-output.pdf',
      mode: 'native',
    })
    const { actions, statusMessage } = createHarness({
      runtime: createRuntimeMock({
        exportQuotationDocument,
      }),
    })

    await expect(actions.exportQuotationPdfToFile('C:/quotes/agent-output.pdf')).resolves.toEqual({
      canceled: false,
      filePath: 'C:/quotes/agent-output.pdf',
      mode: 'native',
    })

    expect(exportQuotationDocument).toHaveBeenCalledWith(expect.objectContaining({
      filePath: 'C:/quotes/agent-output.pdf',
      defaultFileName: expect.stringMatching(/\.pdf$/),
    }))
    expect(statusMessage.value).toContain('quotations.statuses.exportedPdf')
  })

  it('does not fall back to browser print for path-based PDF export', async () => {
    const exportQuotationDocument = vi.fn()
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

    await expect(actions.exportQuotationPdfToFile('C:/quotes/agent-output.pdf')).resolves.toBeNull()

    expect(exportQuotationDocument).not.toHaveBeenCalled()
    expect(statusMessage.value).toContain('quotations.statuses.fileOperationFailed')
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
    openQuotationFileFromPath: overrides.quotationApp?.openQuotationFileFromPath,
    openLineItemsCsvFile: overrides.quotationApp?.openLineItemsCsvFile,
    openLineItemsCsvFileFromPath: overrides.quotationApp?.openLineItemsCsvFileFromPath,
    saveLineItemsCsvFile: mapBridgeSaveMock(overrides.quotationApp?.saveLineItemsCsvFile),
    saveLineItemsCsvTemplateFile: mapBridgeSaveMock(overrides.quotationApp?.saveLineItemsCsvTemplateFile),
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
    openQuotationFileFromPath: vi.fn().mockResolvedValue({
      canceled: true,
    }),
    openDevAutoImportQuotationFile: vi.fn().mockResolvedValue({
      canceled: true,
    }),
    openLineItemsCsvFile: vi.fn().mockResolvedValue({
      canceled: true,
    }),
    openLineItemsCsvFileFromPath: vi.fn().mockResolvedValue({
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
    saveLibraryFile: vi.fn().mockResolvedValue({
      canceled: false,
      filePath: 'quotation-library.json',
      mode: 'native',
    }),
    openLibraryFile: vi.fn().mockResolvedValue({
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
