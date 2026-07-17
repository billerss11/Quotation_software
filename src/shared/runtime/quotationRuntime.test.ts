// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'

import { createInitialQuotation } from '@/features/quotations/utils/quotationDraft'
import { createGoodsReceiptDraft } from '@/features/goods-receipts/utils/goodsReceipt'

import { createQuotationRuntime } from './quotationRuntime'

describe('createQuotationRuntime', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('resolves a desktop runtime and delegates Excel template downloads', async () => {
    const xlsxContent = new Uint8Array([80, 75, 3, 4])
    const openLineItemsXlsxFile = vi.fn().mockResolvedValue({
      canceled: false,
      filePath: 'C:/imports/items.xlsx',
      content: xlsxContent,
    })
    const saveLineItemsExcelTemplateFile = vi.fn().mockResolvedValue({
      canceled: false,
      filePath: 'C:/exports/quotation-line-items-template.xlsx',
    })
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
        openLineItemsXlsxFile,
        openLineItemsXlsxFileFromPath: vi.fn(),
        saveLineItemsCsvFile: vi.fn(),
        saveLineItemsCsvTemplateFile: vi.fn(),
        saveLineItemsExcelTemplateFile,
        saveLibraryFile: vi.fn(),
        openLibraryFile: vi.fn(),
        exportQuotationPdf: vi.fn(),
        exportGoodsReceiptPdf: vi.fn(),
        getQuotationPdfPayload: vi.fn(),
        notifyQuotationPdfReady: vi.fn(),
        getGoodsReceiptPdfPayload: vi.fn(),
        notifyGoodsReceiptPdfReady: vi.fn(),
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
    await expect(runtime.openLineItemsXlsxFile()).resolves.toEqual({
      canceled: false,
      filePath: 'C:/imports/items.xlsx',
      content: xlsxContent,
    })
    await expect(runtime.saveLineItemsExcelTemplateFile()).resolves.toEqual({
      canceled: false,
      filePath: 'C:/exports/quotation-line-items-template.xlsx',
      mode: 'native',
    })
    expect(saveLineItemsExcelTemplateFile).toHaveBeenCalledTimes(1)
    expect(openLineItemsXlsxFile).toHaveBeenCalledTimes(1)
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
        openLineItemsXlsxFile: vi.fn(),
        openLineItemsXlsxFileFromPath: vi.fn(),
        saveLineItemsCsvFile: vi.fn(),
        saveLineItemsCsvTemplateFile: vi.fn(),
        saveLineItemsExcelTemplateFile: vi.fn(),
        saveLibraryFile: vi.fn(),
        openLibraryFile: vi.fn(),
        exportQuotationPdf: vi.fn(),
        exportGoodsReceiptPdf: vi.fn(),
        getQuotationPdfPayload: vi.fn(),
        notifyQuotationPdfReady: vi.fn(),
        getGoodsReceiptPdfPayload: vi.fn(),
        notifyGoodsReceiptPdfReady: vi.fn(),
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
    const xlsxContent = new Uint8Array([80, 75, 3, 4])
    const openLineItemsXlsxFileFromPath = vi.fn().mockResolvedValue({
      canceled: false,
      filePath: 'J:/project/file/items.xlsx',
      content: xlsxContent,
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
        openLineItemsXlsxFile: vi.fn(),
        openLineItemsXlsxFileFromPath,
        saveLineItemsCsvFile: vi.fn(),
        saveLineItemsCsvTemplateFile: vi.fn(),
        saveLineItemsExcelTemplateFile: vi.fn(),
        saveLibraryFile: vi.fn(),
        openLibraryFile: vi.fn(),
        exportQuotationPdf: vi.fn(),
        exportGoodsReceiptPdf: vi.fn(),
        getQuotationPdfPayload: vi.fn(),
        notifyQuotationPdfReady: vi.fn(),
        getGoodsReceiptPdfPayload: vi.fn(),
        notifyGoodsReceiptPdfReady: vi.fn(),
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
    await expect(runtime.openLineItemsXlsxFileFromPath('J:/project/file/items.xlsx')).resolves.toEqual({
      canceled: false,
      filePath: 'J:/project/file/items.xlsx',
      content: xlsxContent,
    })
    expect(openQuotationFileFromPath).toHaveBeenCalledWith('J:/project/file/imported.json')
    expect(openLineItemsCsvFileFromPath).toHaveBeenCalledWith('J:/project/file/items.csv')
    expect(openLineItemsXlsxFileFromPath).toHaveBeenCalledWith('J:/project/file/items.xlsx')
  })

  it('forwards path-based PDF export options through the desktop bridge', async () => {
    const exportQuotationPdf = vi.fn().mockResolvedValue({
      canceled: false,
      filePath: 'J:/project/file/agent-output.pdf',
    })
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
        openLineItemsXlsxFile: vi.fn(),
        openLineItemsXlsxFileFromPath: vi.fn(),
        saveLineItemsCsvFile: vi.fn(),
        saveLineItemsCsvTemplateFile: vi.fn(),
        saveLineItemsExcelTemplateFile: vi.fn(),
        saveLibraryFile: vi.fn(),
        openLibraryFile: vi.fn(),
        exportQuotationPdf,
        exportGoodsReceiptPdf: vi.fn(),
        getQuotationPdfPayload: vi.fn(),
        notifyQuotationPdfReady: vi.fn(),
        getGoodsReceiptPdfPayload: vi.fn(),
        notifyGoodsReceiptPdfReady: vi.fn(),
      },
      locationHref: 'https://example.test/',
      windowObject: window,
    })
    const quotation = createInitialQuotation([], 'en-US')
    const payload = {
      quotation,
      summaries: [],
      totals: {
        baseSubtotal: 0,
        markupAmount: 0,
        subtotalAfterMarkup: 0,
        taxableSubtotal: 0,
        taxAmount: 0,
        grandTotal: 0,
        taxBuckets: [],
      },
      globalMarkupRate: quotation.totalsConfig.globalMarkupRate,
      exchangeRates: quotation.exchangeRates,
      companyProfile: quotation.companyProfileSnapshot,
      defaultFileName: 'quotation.pdf',
      filePath: 'J:/project/file/agent-output.pdf',
    }

    await expect(runtime.exportQuotationDocument(payload)).resolves.toEqual({
      canceled: false,
      filePath: 'J:/project/file/agent-output.pdf',
      mode: 'native',
    })
    expect(exportQuotationPdf).toHaveBeenCalledWith(payload)
  })

  it('forwards goods receipt PDF export options through the desktop bridge', async () => {
    const exportGoodsReceiptPdf = vi.fn().mockResolvedValue({
      canceled: false,
      filePath: 'J:/project/file/GR-20260710.pdf',
    })
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
        openLineItemsXlsxFile: vi.fn(),
        openLineItemsXlsxFileFromPath: vi.fn(),
        saveLineItemsCsvFile: vi.fn(),
        saveLineItemsCsvTemplateFile: vi.fn(),
        saveLineItemsExcelTemplateFile: vi.fn(),
        saveLibraryFile: vi.fn(),
        openLibraryFile: vi.fn(),
        exportQuotationPdf: vi.fn(),
        exportGoodsReceiptPdf,
        getQuotationPdfPayload: vi.fn(),
        notifyQuotationPdfReady: vi.fn(),
        getGoodsReceiptPdfPayload: vi.fn(),
        notifyGoodsReceiptPdfReady: vi.fn(),
      },
      locationHref: 'https://example.test/',
      windowObject: window,
    })
    const quotation = createInitialQuotation([], 'en-US')
    const payload = {
      draft: createGoodsReceiptDraft(quotation, {
        documentDate: '2026-07-10',
      }),
      branding: quotation.branding,
      defaultFileName: 'GR-20260710.pdf',
      filePath: 'J:/project/file/GR-20260710.pdf',
    }

    await expect(runtime.exportGoodsReceiptDocument(payload)).resolves.toEqual({
      canceled: false,
      filePath: 'J:/project/file/GR-20260710.pdf',
      mode: 'native',
    })
    expect(exportGoodsReceiptPdf).toHaveBeenCalledWith(payload)
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
    await expect(runtime.openLineItemsXlsxFileFromPath('C:/items.xlsx')).rejects.toThrow(
      'Path-based XLSX import is only available in the desktop app.',
    )
  })

  it('opens browser print jobs for goods receipts when Electron is unavailable', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(window)
    const runtime = createQuotationRuntime({
      appTarget: 'web',
      bridge: undefined,
      locationHref: 'https://example.test/editor',
      windowObject: window,
    })
    const quotation = createInitialQuotation([], 'en-US')

    const result = await runtime.exportGoodsReceiptDocument({
      draft: createGoodsReceiptDraft(quotation, {
        documentDate: '2026-07-10',
      }),
      branding: quotation.branding,
      defaultFileName: 'GR-20260710.pdf',
    })

    expect(result).toEqual({
      canceled: false,
      filePath: 'GR-20260710.pdf',
      mode: 'browser-print',
    })
    expect(open).toHaveBeenCalledWith(
      expect.stringContaining('mode=goods-receipt-print'),
      '_blank',
      'noopener,noreferrer',
    )
  })

  it('preserves XLSX bytes from the web File System Access picker', async () => {
    const bytes = new Uint8Array([0, 255, 80, 75, 3, 4])
    const file = {
      name: 'items.xlsx',
      arrayBuffer: vi.fn().mockResolvedValue(bytes.buffer),
    } as unknown as File
    const showOpenFilePicker = vi.fn().mockResolvedValue([{
      getFile: vi.fn().mockResolvedValue(file),
    }])
    const webWindow = Object.assign(Object.create(window), {
      showOpenFilePicker,
      showSaveFilePicker: vi.fn(),
    }) as Window
    const runtime = createQuotationRuntime({
      appTarget: 'web',
      locationHref: 'https://example.test/editor',
      windowObject: webWindow,
    })

    await expect(runtime.openLineItemsXlsxFile()).resolves.toEqual({
      canceled: false,
      filePath: 'items.xlsx',
      content: bytes,
    })
    expect(showOpenFilePicker).toHaveBeenCalledWith(expect.objectContaining({
      multiple: false,
      types: [expect.objectContaining({ description: 'Excel Workbook' })],
    }))
  })

  it('preserves XLSX bytes through the hidden file-input fallback', async () => {
    const bytes = new Uint8Array([80, 75, 0, 200])
    const file = {
      name: 'fallback.xlsx',
      arrayBuffer: vi.fn().mockResolvedValue(bytes.buffer),
    } as unknown as File
    let acceptedTypes = ''
    vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function (this: HTMLInputElement) {
      acceptedTypes = this.accept
      Object.defineProperty(this, 'files', {
        configurable: true,
        value: [file],
      })
      this.dispatchEvent(new Event('change'))
    })
    const runtime = createQuotationRuntime({
      appTarget: 'web',
      locationHref: 'https://example.test/editor',
      windowObject: window,
    })

    await expect(runtime.openLineItemsXlsxFile()).resolves.toEqual({
      canceled: false,
      filePath: 'fallback.xlsx',
      content: bytes,
    })
    expect(acceptedTypes).toContain('.xlsx')
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

  it('writes the fetched Excel template Blob through the browser save picker', async () => {
    const templateBlob = new Blob(['xlsx-binary'], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const fetchTemplate = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      blob: vi.fn().mockResolvedValue(templateBlob),
    })
    vi.stubGlobal('fetch', fetchTemplate)

    const writable = {
      write: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    }
    const handle = {
      name: 'quotation-line-items-template.xlsx',
      createWritable: vi.fn().mockResolvedValue(writable),
    }
    const showSaveFilePicker = vi.fn().mockResolvedValue(handle)
    const webWindow = Object.assign(Object.create(window), {
      showOpenFilePicker: vi.fn(),
      showSaveFilePicker,
    }) as Window
    const runtime = createQuotationRuntime({
      appTarget: 'web',
      locationHref: 'https://example.test/editor',
      windowObject: webWindow,
    })

    await expect(runtime.saveLineItemsExcelTemplateFile()).resolves.toEqual({
      canceled: false,
      filePath: 'quotation-line-items-template.xlsx',
      mode: 'file-system-access',
    })
    expect(String(fetchTemplate.mock.calls[0]?.[0])).toBe(
      'http://localhost:3000/file/templates/quotation-line-items-template.xlsx',
    )
    expect(showSaveFilePicker).toHaveBeenCalledWith(expect.objectContaining({
      suggestedName: 'quotation-line-items-template.xlsx',
    }))
    expect(writable.write).toHaveBeenCalledWith(templateBlob)
    expect(writable.close).toHaveBeenCalledTimes(1)
  })

  it('downloads the fetched Excel template as an XLSX Blob without a save picker', async () => {
    const templateBlob = new Blob(['xlsx-binary'])
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      blob: vi.fn().mockResolvedValue(templateBlob),
    }))
    const createObjectUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:excel-template')
    const revokeObjectUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const runtime = createQuotationRuntime({
      appTarget: 'web',
      locationHref: 'https://example.test/editor',
      windowObject: window,
    })

    await expect(runtime.saveLineItemsExcelTemplateFile()).resolves.toEqual({
      canceled: false,
      filePath: 'quotation-line-items-template.xlsx',
      mode: 'download',
    })

    const downloadedBlob = createObjectUrl.mock.calls[0]?.[0] as Blob
    expect(downloadedBlob).toBeInstanceOf(Blob)
    expect(downloadedBlob?.type).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )
    expect(click).toHaveBeenCalledTimes(1)
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:excel-template')
  })

  it('returns canceled when the Excel template save picker is canceled', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      blob: vi.fn().mockResolvedValue(new Blob(['xlsx-binary'])),
    }))
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

    await expect(runtime.saveLineItemsExcelTemplateFile()).resolves.toEqual({ canceled: true })
  })

  it('fails clearly when the bundled Excel template cannot be loaded', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    }))
    const runtime = createQuotationRuntime({
      appTarget: 'web',
      locationHref: 'https://example.test/editor',
      windowObject: window,
    })

    await expect(runtime.saveLineItemsExcelTemplateFile()).rejects.toThrow(
      'Excel template could not be loaded (404).',
    )
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
    await expect(runtime.openLineItemsXlsxFile()).resolves.toEqual({
      canceled: true,
    })
    expect(showOpenFilePicker).toHaveBeenCalledTimes(2)
  })
})
