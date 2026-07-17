import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { QuotationRuntime } from '@/shared/runtime/quotationRuntime'
import { loadReusableLibraryData, replaceReusableLibraryData } from '@/shared/services/reusableLibraryStore'
import { createQuotationLibraryFileContent } from '@/shared/services/quotationLibraryFile'
import { useQuotationLibraryFileActions } from './useQuotationLibraryFileActions'

describe('useQuotationLibraryFileActions', () => {
  const localStorageMock = createLocalStorageMock()

  beforeEach(() => {
    vi.stubGlobal('window', { localStorage: localStorageMock })
    localStorageMock.clear()
    replaceReusableLibraryData(createLibraryData('Existing Company'))
  })

  afterEach(() => vi.unstubAllGlobals())

  it('parses a candidate without replacing current records until it is applied', async () => {
    const actions = createActions({
      openLibraryFile: vi.fn().mockResolvedValue({
        canceled: false,
        filePath: 'C:/shared/quotation-library.json',
        content: createQuotationLibraryFileContent(createLibraryData('Northwind Process')),
      }),
    })

    const candidate = await actions.selectLibraryFile()

    expect(candidate?.data.companyProfiles[0]?.companyName).toBe('Northwind Process')
    expect(loadReusableLibraryData().companyProfiles[0]?.companyName).toBe('Existing Company')

    actions.applyLibraryReplacement(candidate!)
    expect(loadReusableLibraryData().companyProfiles[0]?.companyName).toBe('Northwind Process')
    expect(actions.currentLibraryFilePath.value).toBe('C:/shared/quotation-library.json')
  })

  it('does nothing when the picker is canceled', async () => {
    const actions = createActions({
      openLibraryFile: vi.fn().mockResolvedValue({ canceled: true }),
    })

    expect(await actions.selectLibraryFile()).toBe(null)
    expect(loadReusableLibraryData().companyProfiles[0]?.companyName).toBe('Existing Company')
  })

  it('leaves current data unchanged when parsing fails', async () => {
    const actions = createActions({
      openLibraryFile: vi.fn().mockResolvedValue({
        canceled: false,
        filePath: 'C:/shared/broken.json',
        content: '{broken',
      }),
    })

    expect(await actions.selectLibraryFile()).toBe(null)
    expect(actions.statusMessage.value).toBe('settings.library.fileErrors.invalidJson')
    expect(loadReusableLibraryData().companyProfiles[0]?.companyName).toBe('Existing Company')
  })

  it('rejects business-invalid records before replacement', async () => {
    const invalidData = createLibraryData('')
    const actions = createActions({
      openLibraryFile: vi.fn().mockResolvedValue({
        canceled: false,
        filePath: 'C:/shared/invalid.json',
        content: createQuotationLibraryFileContent(invalidData),
      }),
    })

    expect(await actions.selectLibraryFile()).toBe(null)
    expect(actions.statusMessage.value).toBe('settings.library.fileErrors.invalidCompanyProfile')
    expect(loadReusableLibraryData().companyProfiles[0]?.companyName).toBe('Existing Company')
  })

  it('creates an empty library only when explicitly applied', () => {
    const actions = createActions()

    expect(loadReusableLibraryData().companyProfiles).toHaveLength(1)
    actions.createEmptyLibrary()

    expect(loadReusableLibraryData()).toMatchObject({ companyProfiles: [], customers: [] })
    expect(actions.currentLibraryFilePath.value).toBe('')
  })

  it('saves the current reusable library through the runtime', async () => {
    const saveLibraryFile = vi.fn().mockResolvedValue({
      canceled: false,
      filePath: 'C:/shared/quotation-library.json',
      mode: 'native',
    })
    const actions = createActions({ saveLibraryFile })

    await actions.saveLibraryAs()

    expect(saveLibraryFile).toHaveBeenCalledTimes(1)
    expect(saveLibraryFile.mock.calls[0]?.[0].content).toContain('Existing Company')
    expect(actions.currentLibraryFilePath.value).toBe('C:/shared/quotation-library.json')
  })
})

function createActions(overrides: Partial<QuotationRuntime> = {}) {
  return useQuotationLibraryFileActions({
    runtime: createRuntimeMock(overrides),
    t: (key) => key,
  })
}

function createLibraryData(companyName: string) {
  return {
    companyProfiles: [{
      id: 'company-1',
      updatedAt: '2026-05-07T08:00:00.000Z',
      companyName,
      email: 'quotes@northwind.test',
      phone: '+86 400 100 200',
    }],
    customers: [],
    numbering: { lastIssuedYear: 2026, lastIssuedSequence: 12 },
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
    saveQuotationFile: vi.fn(),
    openQuotationFile: vi.fn(),
    openQuotationFileFromPath: vi.fn(),
    openDevAutoImportQuotationFile: vi.fn().mockResolvedValue({ canceled: true }),
    openLineItemsCsvFile: vi.fn(),
    openLineItemsCsvFileFromPath: vi.fn(),
    openLineItemsXlsxFile: vi.fn(),
    openLineItemsXlsxFileFromPath: vi.fn(),
    saveLineItemsCsvFile: vi.fn(),
    saveLineItemsCsvTemplateFile: vi.fn(),
    saveLineItemsExcelTemplateFile: vi.fn(),
    saveLibraryFile: vi.fn().mockResolvedValue({
      canceled: false,
      filePath: 'quotation-library.json',
      mode: 'native',
    }),
    openLibraryFile: vi.fn().mockResolvedValue({ canceled: true }),
    exportQuotationDocument: vi.fn(),
    exportGoodsReceiptDocument: vi.fn(),
    getQuotationPrintPayload: vi.fn(),
    notifyQuotationPrintReady: vi.fn(),
    getGoodsReceiptPrintPayload: vi.fn(),
    notifyGoodsReceiptPrintReady: vi.fn(),
    ...overrides,
  }
}

function createLocalStorageMock() {
  const store = new Map<string, string>()

  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  }
}
