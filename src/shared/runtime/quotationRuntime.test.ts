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
        openLineItemsCsvFile: vi.fn(),
        saveLineItemsCsvFile: vi.fn(),
        saveLineItemsCsvTemplateFile: vi.fn(),
        saveCustomerLibraryFile: vi.fn(),
        openCustomerLibraryFile: vi.fn(),
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
})
