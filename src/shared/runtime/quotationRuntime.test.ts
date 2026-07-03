// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'

import { createInitialQuotation } from '@/features/quotations/utils/quotationDraft'

import { createQuotationRuntime } from './quotationRuntime'

describe('createQuotationRuntime', () => {
  it('resolves a desktop runtime when the Electron bridge is present', () => {
    const runtime = createQuotationRuntime({
      appTarget: 'desktop',
      bridge: {
        getVersion: vi.fn(),
        saveQuotationFile: vi.fn(),
        openQuotationFile: vi.fn(),
        openQuotationFileFromPath: vi.fn(),
        openDevAutoImportQuotationFile: vi.fn(),
        openLineItemsCsvFile: vi.fn(),
        openLineItemsCsvFileFromPath: vi.fn(),
        saveLineItemsCsvFile: vi.fn(),
        saveLineItemsCsvTemplateFile: vi.fn(),
        saveLibraryFile: vi.fn(),
        openLibraryFile: vi.fn(),
        exportQuotationPdf: vi.fn(),
        getQuotationPdfPayload: vi.fn(),
        notifyQuotationPdfReady: vi.fn(),
      },
      locationHref: 'https://example.test/',
      windowObject: window,
    })

    expect(runtime.capabilities).toEqual({
      isDesktop: true,
      hasNativeFileDialogs: true,
      supportsFileSystemAccess: false,
      supportsDirectPdfExport: true,
      supportsBrowserPrint: false,
    })
    expect(runtime).toHaveProperty('saveLibraryFile')
    expect(runtime).toHaveProperty('openLibraryFile')
    expect(runtime).toHaveProperty('openDevAutoImportQuotationFile')
    expect(runtime).toHaveProperty('openQuotationFileFromPath')
    expect(runtime).toHaveProperty('openLineItemsCsvFileFromPath')
  })

  it('forwards dev auto-import requests through the desktop bridge', async () => {
    const openDevAutoImportQuotationFile = vi.fn().mockResolvedValue({
      canceled: false,
      filePath: 'J:/project/file/Q-2026-048.json',
      content: '{}',
    })
    const runtime = createQuotationRuntime({
      appTarget: 'desktop',
      bridge: {
        getVersion: vi.fn(),
        saveQuotationFile: vi.fn(),
        openQuotationFile: vi.fn(),
        openQuotationFileFromPath: vi.fn(),
        openDevAutoImportQuotationFile,
        openLineItemsCsvFile: vi.fn(),
        openLineItemsCsvFileFromPath: vi.fn(),
        saveLineItemsCsvFile: vi.fn(),
        saveLineItemsCsvTemplateFile: vi.fn(),
        saveLibraryFile: vi.fn(),
        openLibraryFile: vi.fn(),
        exportQuotationPdf: vi.fn(),
        getQuotationPdfPayload: vi.fn(),
        notifyQuotationPdfReady: vi.fn(),
      },
      locationHref: 'https://example.test/',
      windowObject: window,
    })

    await expect(runtime.openDevAutoImportQuotationFile()).resolves.toEqual({
      canceled: false,
      filePath: 'J:/project/file/Q-2026-048.json',
      content: '{}',
    })
    expect(openDevAutoImportQuotationFile).toHaveBeenCalledTimes(1)
  })

  it('forwards path-based import requests through the desktop bridge', async () => {
    const openQuotationFileFromPath = vi.fn().mockResolvedValue({
      canceled: false,
      filePath: 'J:/project/file/imported.json',
      content: '{}',
    })
    const openLineItemsCsvFileFromPath = vi.fn().mockResolvedValue({
      canceled: false,
      filePath: 'J:/project/file/items.csv',
      content: 'item_code,item_name\n',
    })
    const runtime = createQuotationRuntime({
      appTarget: 'desktop',
      bridge: {
        getVersion: vi.fn(),
        saveQuotationFile: vi.fn(),
        openQuotationFile: vi.fn(),
        openQuotationFileFromPath,
        openDevAutoImportQuotationFile: vi.fn(),
        openLineItemsCsvFile: vi.fn(),
        openLineItemsCsvFileFromPath,
        saveLineItemsCsvFile: vi.fn(),
        saveLineItemsCsvTemplateFile: vi.fn(),
        saveLibraryFile: vi.fn(),
        openLibraryFile: vi.fn(),
        exportQuotationPdf: vi.fn(),
        getQuotationPdfPayload: vi.fn(),
        notifyQuotationPdfReady: vi.fn(),
      },
      locationHref: 'https://example.test/',
      windowObject: window,
    })

    await expect(runtime.openQuotationFileFromPath('J:/project/file/imported.json')).resolves.toEqual({
      canceled: false,
      filePath: 'J:/project/file/imported.json',
      content: '{}',
    })
    await expect(runtime.openLineItemsCsvFileFromPath('J:/project/file/items.csv')).resolves.toEqual({
      canceled: false,
      filePath: 'J:/project/file/items.csv',
      content: 'item_code,item_name\n',
    })
    expect(openQuotationFileFromPath).toHaveBeenCalledWith('J:/project/file/imported.json')
    expect(openLineItemsCsvFileFromPath).toHaveBeenCalledWith('J:/project/file/items.csv')
  })

  it('resolves a web runtime and opens browser print jobs when Electron is unavailable', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(window)
    const runtime = createQuotationRuntime({
      appTarget: 'web',
      bridge: undefined,
      locationHref: 'https://example.test/editor',
      windowObject: window,
    })

    const quotation = createInitialQuotation([], 'en-US')
    const result = await runtime.exportQuotationDocument({
      quotation,
      summaries: [],
      totals: {
        baseSubtotal: 0,
        markupAmount: 0,
        subtotalAfterMarkup: 0,
        discountAmount: 0,
        taxableSubtotal: 0,
        taxAmount: 0,
        grandTotal: 0,
        taxBuckets: [],
      },
      globalMarkupRate: quotation.totalsConfig.globalMarkupRate,
      exchangeRates: quotation.exchangeRates,
      companyProfile: {
        companyName: 'ACME',
        email: '',
        phone: '',
      },
      defaultFileName: 'quotation.pdf',
    })

    expect(runtime.capabilities).toEqual({
      isDesktop: false,
      hasNativeFileDialogs: false,
      supportsFileSystemAccess: false,
      supportsDirectPdfExport: false,
      supportsBrowserPrint: true,
    })
    expect(result).toEqual({
      canceled: false,
      filePath: 'quotation.pdf',
      mode: 'browser-print',
    })
    expect(open).toHaveBeenCalledWith(
      expect.stringContaining('mode=quotation-print'),
      '_blank',
      'noopener,noreferrer',
    )
  })

  it('treats canceling the browser save picker as a canceled save', async () => {
    const showSaveFilePicker = vi.fn().mockRejectedValue(new DOMException('User canceled save', 'AbortError'))
    const webWindow = Object.assign(Object.create(window), {
      showOpenFilePicker: vi.fn(),
      showSaveFilePicker,
    }) as Window

    const runtime = createQuotationRuntime({
      appTarget: 'web',
      locationHref: 'https://example.test/editor',
      windowObject: webWindow,
    })

    await expect(runtime.saveQuotationFile({
      defaultPath: 'quotation.json',
      content: '{}',
    })).resolves.toEqual({
      canceled: true,
    })
    expect(showSaveFilePicker).toHaveBeenCalledTimes(1)
  })

  it('treats canceling the browser open picker as a canceled open', async () => {
    const showOpenFilePicker = vi.fn().mockRejectedValue(new DOMException('User canceled open', 'AbortError'))
    const webWindow = Object.assign(Object.create(window), {
      showOpenFilePicker,
      showSaveFilePicker: vi.fn(),
    }) as Window

    const runtime = createQuotationRuntime({
      appTarget: 'web',
      locationHref: 'https://example.test/editor',
      windowObject: webWindow,
    })

    await expect(runtime.openQuotationFile()).resolves.toEqual({
      canceled: true,
    })
    expect(showOpenFilePicker).toHaveBeenCalledTimes(1)
  })
})
