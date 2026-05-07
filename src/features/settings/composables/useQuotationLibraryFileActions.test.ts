import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { QuotationRuntime } from '@/shared/runtime/quotationRuntime'
import { loadReusableLibraryData, replaceReusableLibraryData } from '@/shared/services/reusableLibraryStore'

import { useQuotationLibraryFileActions } from './useQuotationLibraryFileActions'

describe('useQuotationLibraryFileActions', () => {
  const localStorageMock = createLocalStorageMock()

  beforeEach(() => {
    vi.stubGlobal('window', {
      localStorage: localStorageMock,
    })
    localStorageMock.clear()
    replaceReusableLibraryData({
      companyProfiles: [],
      customers: [],
      numbering: {
        lastIssuedYear: null,
        lastIssuedSequence: 0,
      },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('opens a reusable library file and replaces the in-app library state', async () => {
    const runtime = createRuntimeMock({
      openLibraryFile: vi.fn().mockResolvedValue({
        canceled: false,
        filePath: 'C:/shared/quotation-library.json',
        content: JSON.stringify({
          schemaVersion: 1,
          app: 'quotation-software',
          exportedAt: '2026-05-07T08:00:00.000Z',
          library: {
            companyProfiles: [
              {
                id: 'company-1',
                updatedAt: '2026-05-07T08:00:00.000Z',
                companyName: 'Northwind Process',
                email: 'quotes@northwind.test',
                phone: '+86 400 100 200',
              },
            ],
            customers: [],
            numbering: {
              lastIssuedYear: 2026,
              lastIssuedSequence: 12,
            },
          },
        }),
      }),
    })
    const actions = useQuotationLibraryFileActions({
      runtime,
      t: createTranslator(),
    })

    await actions.openLibrary()

    expect(actions.currentLibraryFilePath.value).toBe('C:/shared/quotation-library.json')
    expect(loadReusableLibraryData()).toMatchObject({
      companyProfiles: [
        {
          companyName: 'Northwind Process',
        },
      ],
      numbering: {
        lastIssuedSequence: 12,
      },
    })
  })

  it('saves the reusable library file through the runtime', async () => {
    replaceReusableLibraryData({
      companyProfiles: [
        {
          id: 'company-1',
          updatedAt: '2026-05-07T08:00:00.000Z',
          companyName: 'Northwind Process',
          email: 'quotes@northwind.test',
          phone: '+86 400 100 200',
        },
      ],
      customers: [],
      numbering: {
        lastIssuedYear: 2026,
        lastIssuedSequence: 12,
      },
    })

    const saveLibraryFile = vi.fn().mockResolvedValue({
      canceled: false,
      filePath: 'C:/shared/quotation-library.json',
      mode: 'native',
    })
    const actions = useQuotationLibraryFileActions({
      runtime: createRuntimeMock({
        saveLibraryFile,
      }),
      t: createTranslator(),
    })

    await actions.saveLibraryAs()

    expect(saveLibraryFile).toHaveBeenCalledTimes(1)
    expect(saveLibraryFile.mock.calls[0]?.[0].defaultPath).toBe('quotation-library.json')
    expect(saveLibraryFile.mock.calls[0]?.[0].content).toContain('Northwind Process')
    expect(actions.currentLibraryFilePath.value).toBe('C:/shared/quotation-library.json')
  })
})

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
    openLineItemsCsvFile: vi.fn(),
    saveLineItemsCsvFile: vi.fn(),
    saveLineItemsCsvTemplateFile: vi.fn(),
    saveCustomerLibraryFile: vi.fn(),
    openCustomerLibraryFile: vi.fn(),
    saveLibraryFile: vi.fn().mockResolvedValue({
      canceled: false,
      filePath: 'quotation-library.json',
      mode: 'native',
    }),
    openLibraryFile: vi.fn().mockResolvedValue({
      canceled: true,
    }),
    exportQuotationDocument: vi.fn(),
    getQuotationPrintPayload: vi.fn(),
    notifyQuotationPrintReady: vi.fn(),
    ...overrides,
  }
}

function createTranslator() {
  return (key: string, params?: Record<string, string | number>) => {
    if (!params) {
      return key
    }

    return `${key}:${JSON.stringify(params)}`
  }
}

function createLocalStorageMock() {
  const store = new Map<string, string>()

  return {
    getItem(key: string) {
      return store.get(key) ?? null
    },
    setItem(key: string, value: string) {
      store.set(key, value)
    },
    removeItem(key: string) {
      store.delete(key)
    },
    clear() {
      store.clear()
    },
  }
}
