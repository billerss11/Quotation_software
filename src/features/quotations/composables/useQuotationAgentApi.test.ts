// @vitest-environment jsdom

import { readFile } from 'node:fs/promises'

import { computed, shallowRef } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ExportGoodsReceiptPdfOptions, ExportQuotationPdfOptions } from '@/shared/contracts/quotationApp'
import type { QuotationRuntime, RuntimeSaveFileResult } from '@/shared/runtime/quotationRuntime'

import type { MajorItemSummary, QuotationTotals } from '../types'
import { fetchLatestExchangeRates } from '../services/onlineExchangeRates'
import { calculateMajorItemSummary, calculateQuotationTotals } from '../utils/quotationCalculations'
import { createCalculationTotalsConfig } from '../utils/quotationTaxes'
import { getQuotationRootItems } from '../utils/quotationItems'
import { useQuotationEditor } from './useQuotationEditor'
import { useQuotationFileActions } from './useQuotationFileActions'
import { useQuotationAgentApi } from './useQuotationAgentApi'

const ONE_PIXEL_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='

vi.mock('../services/onlineExchangeRates', () => ({
  fetchLatestExchangeRates: vi.fn(),
}))

describe('useQuotationAgentApi', () => {
  it('routes agent mutations through one undoable editor transaction', async () => {
    // Persistence timestamps are not quotation edits, so keep them stable while checking undo/redo content.
    vi.useFakeTimers()
    vi.setSystemTime('2026-08-25T00:00:00.000Z')

    const harness = createHarness()
    harness.resetQuotationChangeHistory()
    const original = createComparableQuotation(harness.quotation.value)

    await harness.agent.setBaseCurrency('CNY', { USD: 7.1, CNY: 1 })
    await harness.agent.setOutputItemDetailLevel(3)
    await harness.agent.setMixedTaxDocumentColumns(['taxRate', 'grossAmount'])
    const changed = createComparableQuotation(harness.quotation.value)

    expect(harness.undoLastQuotationChange().ok).toBe(true)
    expect(createComparableQuotation(harness.quotation.value)).toEqual(original)
    expect(harness.redoLastQuotationChange().ok).toBe(true)
    expect(createComparableQuotation(harness.quotation.value)).toEqual(changed)
  })

  const localStorageMock = createLocalStorageMock()

  beforeEach(() => {
    vi.mocked(fetchLatestExchangeRates).mockReset()
    vi.stubGlobal('window', {
      localStorage: localStorageMock,
    })
    localStorageMock.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('returns a structured summary after importing line-item CSV content', async () => {
    const { agent, quotation } = createHarness()

    const result = await agent.importLineItemsCsvContent([
      'item_code,item_name,item_description,qty,qty_unit,pricing_basis,unit_price,unit_cost,cost_currency,tax_class,markup_override,expected_total',
      ',Imported equipment,,2,,cost_plus,,50,USD,,,',
      '',
    ].join('\n'), 'items.csv')

    expect(result).toMatchObject({
      ok: true,
      action: 'importLineItemsCsvContent',
      currentFilePath: '',
      statusMessage: expect.stringContaining('quotations.statuses.importedLineItems'),
      summary: {
        currency: 'USD',
        topLevelItemCount: 1,
        itemCount: 1,
        outputItemDetailLevel: 3,
      },
      warnings: [
        'Row 2: item_code assigned 1',
        'Row 2: qty_unit defaulted to EA',
      ],
    })
    expect(result.summary.grandTotal).toBeGreaterThan(0)
    expect(getQuotationRootItems(quotation.value.majorItems)[0]?.name).toBe('Imported equipment')
    expect(agent.getQuotationSummary()).toEqual(result.summary)
  })

  it('returns CSV import errors and warnings to agent callers', async () => {
    const { agent } = createHarness()

    const result = await agent.importLineItemsCsvContent([
      'item_code,item_name,item_description,qty,qty_unit,pricing_basis,unit_price,unit_cost,cost_currency,tax_class,markup_override,expected_total',
      ',Imported equipment,,2,,cost_plus,,bad,USD,,,',
    ].join('\n'), 'items.csv')

    expect(result).toMatchObject({
      ok: false,
      action: 'importLineItemsCsvContent',
      error: 'csv_import_failed',
      warnings: [
        'Row 2: unit_cost must be numeric',
        'Row 2: item_code assigned 1',
        'Row 2: qty_unit defaulted to EA',
      ],
    })
  })

  it('imports XLSX content from raw base64 and returns a quotation summary', async () => {
    const harness = createHarness()
    const { agent, quotation } = harness
    harness.resetQuotationChangeHistory()
    const originalRows = JSON.parse(JSON.stringify(quotation.value.majorItems))
    const content = await readXlsxFixture('valid-line-items.xlsx')

    const result = await agent.importLineItemsXlsxContent(
      toRawBase64(content),
      '设备明细.xlsx',
    )

    expect(result).toMatchObject({
      ok: true,
      action: 'importLineItemsXlsxContent',
      statusMessage: expect.stringContaining('quotations.statuses.importedLineItems'),
      summary: {
        currency: 'USD',
        topLevelItemCount: 1,
        itemCount: 3,
      },
      warnings: [],
    })
    expect(getQuotationRootItems(quotation.value.majorItems)[0]?.name).toBe('设备 Equipment')
    expect(harness.undoLastQuotationChange().ok).toBe(true)
    expect(quotation.value.majorItems).toEqual(originalRows)
  })

  it('imports XLSX from a desktop path and preserves row warnings', async () => {
    const content = await readXlsxFixture('row-warning.xlsx')
    const openLineItemsXlsxFileFromPath = vi.fn().mockResolvedValue({
      canceled: false,
      filePath: 'C:/quotes/items.xlsx',
      content,
    })
    const { agent } = createHarness({
      runtime: createRuntimeMock({ openLineItemsXlsxFileFromPath }),
    })

    const result = await agent.importLineItemsXlsxFile('C:/quotes/items.xlsx')

    expect(result).toMatchObject({
      ok: true,
      action: 'importLineItemsXlsxFile',
      warnings: [
        'Row 2: item_code assigned 1',
        'Row 2: qty_unit defaulted to EA',
      ],
    })
    expect(openLineItemsXlsxFileFromPath).toHaveBeenCalledWith('C:/quotes/items.xlsx')
  })

  it('rejects malformed XLSX base64 before importing', async () => {
    const { agent } = createHarness()

    await expect(agent.importLineItemsXlsxContent('data:application/octet-stream;base64,AAAA')).resolves.toMatchObject({
      ok: false,
      action: 'importLineItemsXlsxContent',
      error: 'invalid_xlsx_base64',
    })
    await expect(agent.importLineItemsXlsxContent('AA=')).resolves.toMatchObject({
      ok: false,
      error: 'invalid_xlsx_base64',
    })
  })

  it('reports invalid XLSX workbooks without changing quotation rows', async () => {
    const { agent, quotation } = createHarness()
    const originalRows = JSON.parse(JSON.stringify(quotation.value.majorItems))

    const result = await agent.importLineItemsXlsxContent(
      toRawBase64(new TextEncoder().encode('not a workbook')),
    )

    expect(result).toMatchObject({
      ok: false,
      action: 'importLineItemsXlsxContent',
      error: 'xlsx_import_failed',
      warnings: [expect.stringContaining('quotations.xlsx.errors.invalidWorkbook')],
    })
    expect(quotation.value.majorItems).toEqual(originalRows)
  })

  it('uploads a logo from a base64 image data URL', async () => {
    const saveCurrentQuotation = vi.fn()
    const { agent, quotation } = createHarness({ saveCurrentQuotation })
    const logoDataUrl = ONE_PIXEL_PNG

    const result = await agent.uploadLogo(logoDataUrl)

    expect(result).toMatchObject({
      ok: true,
      action: 'uploadLogo',
      statusMessage: expect.stringContaining('quotations.statuses.logoAdded'),
    })
    expect(quotation.value.branding.logoDataUrl).toBe(logoDataUrl)
    expect(saveCurrentQuotation).toHaveBeenCalledTimes(1)
  })

  it('rejects non-image logo content without saving the quotation', async () => {
    const saveCurrentQuotation = vi.fn()
    const { agent, quotation } = createHarness({ saveCurrentQuotation })

    const result = await agent.uploadLogo('not-an-image')

    expect(result).toMatchObject({
      ok: false,
      action: 'uploadLogo',
      error: 'invalid_image',
      warnings: ['Logo must be a supported base64 image data URL.'],
    })
    expect(quotation.value.branding.logoDataUrl).toBe('')
    expect(saveCurrentQuotation).not.toHaveBeenCalled()
  })

  it('rejects an image data URL with malformed base64 content', async () => {
    const saveCurrentQuotation = vi.fn()
    const { agent, quotation } = createHarness({ saveCurrentQuotation })

    const result = await agent.uploadLogo('data:image/png;base64,not-base64!')

    expect(result).toMatchObject({
      ok: false,
      action: 'uploadLogo',
      error: 'invalid_image',
    })
    expect(quotation.value.branding.logoDataUrl).toBe('')
    expect(saveCurrentQuotation).not.toHaveBeenCalled()
  })

  it('sets the base currency and exchange rates through a named workflow action', async () => {
    const saveCurrentQuotation = vi.fn()
    const { agent, quotation, statusMessage } = createHarness({ saveCurrentQuotation })

    const result = await agent.setBaseCurrency('CNY', {
      USD: 7.2,
      EUR: 7.8,
    })

    expect(result).toMatchObject({
      ok: true,
      action: 'setBaseCurrency',
      statusMessage: expect.stringContaining('quotations.statuses.agentCurrencyUpdated'),
      summary: {
        currency: 'CNY',
      },
    })
    expect(quotation.value.header.currency).toBe('CNY')
    expect(quotation.value.exchangeRates).toMatchObject({
      CNY: 1,
      USD: 7.2,
      EUR: 7.8,
    })
    expect(saveCurrentQuotation).toHaveBeenCalledTimes(1)
    expect(statusMessage.value).toContain('quotations.statuses.agentCurrencyUpdated')
  })

  it('rejects invalid base currencies without saving the quotation', async () => {
    const saveCurrentQuotation = vi.fn()
    const { agent, quotation, statusMessage } = createHarness({ saveCurrentQuotation })

    const result = await agent.setBaseCurrency('bad-currency')

    expect(result).toMatchObject({
      ok: false,
      action: 'setBaseCurrency',
      error: 'unsupported_currency',
      summary: {
        currency: 'USD',
      },
    })
    expect(quotation.value.header.currency).toBe('USD')
    expect(saveCurrentQuotation).not.toHaveBeenCalled()
    expect(statusMessage.value).toBe('')
  })

  it('requires an explicit rate for a base currency without a reference rate', async () => {
    const saveCurrentQuotation = vi.fn()
    const { agent, quotation } = createHarness({ saveCurrentQuotation })

    const result = await agent.setBaseCurrency('CAD')

    expect(result).toMatchObject({
      ok: false,
      action: 'setBaseCurrency',
      error: 'exchange_rate_required',
      summary: { currency: 'USD' },
    })
    expect(quotation.value.header.currency).toBe('USD')
    expect(saveCurrentQuotation).not.toHaveBeenCalled()
  })

  it('refreshes exchange rates for the current quotation currency', async () => {
    const saveCurrentQuotation = vi.fn()
    const { agent, quotation } = createHarness({ saveCurrentQuotation })
    quotation.value.exchangeRates = { USD: 1, EUR: 1.08, CNY: 0.14 }
    vi.mocked(fetchLatestExchangeRates).mockResolvedValue({
      rates: { USD: 1, EUR: 1.12 },
      date: '2026-08-19',
      missingCurrencies: ['CNY'],
    })

    const result = await agent.refreshExchangeRates()

    expect(fetchLatestExchangeRates).toHaveBeenCalledWith('USD', ['USD', 'EUR', 'CNY'])
    expect(quotation.value.exchangeRates).toEqual({
      USD: 1,
      EUR: 1.12,
      CNY: 0.14,
    })
    expect(saveCurrentQuotation).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({
      ok: true,
      action: 'refreshExchangeRates',
      exchangeRateDate: '2026-08-19',
      warnings: [expect.stringContaining('CNY')],
    })
  })

  it('reports online exchange-rate failures without changing the quotation', async () => {
    const saveCurrentQuotation = vi.fn()
    const { agent, quotation } = createHarness({ saveCurrentQuotation })
    quotation.value.exchangeRates = { USD: 1, EUR: 1.08 }
    vi.mocked(fetchLatestExchangeRates).mockRejectedValue(new Error('network unavailable'))

    const result = await agent.refreshExchangeRates()

    expect(quotation.value.exchangeRates).toEqual({ USD: 1, EUR: 1.08 })
    expect(saveCurrentQuotation).not.toHaveBeenCalled()
    expect(result).toMatchObject({
      ok: false,
      action: 'refreshExchangeRates',
      error: 'exchange_rate_fetch_failed',
      warnings: ['network unavailable'],
    })
  })

  it('sets the preview and PDF item detail level and exposes output settings', async () => {
    const saveCurrentQuotation = vi.fn()
    const { agent, quotation } = createHarness({ saveCurrentQuotation })

    const result = await agent.setOutputItemDetailLevel(2)

    expect(result).toMatchObject({
      ok: true,
      action: 'setOutputItemDetailLevel',
      statusMessage: expect.stringContaining('quotations.statuses.agentOutputDetailUpdated'),
      summary: {
        outputItemDetailLevel: 2,
      },
    })
    expect(quotation.value.outputSettings).toEqual({
      itemDetailLevel: 2,
    })
    expect(agent.getOutputSettings()).toEqual({
      itemDetailLevel: 2,
    })
    expect(saveCurrentQuotation).toHaveBeenCalledTimes(1)
  })

  it('sets the preview and PDF mixed-tax document columns through a named workflow action', async () => {
    const saveCurrentQuotation = vi.fn()
    const { agent, quotation } = createHarness({ saveCurrentQuotation })

    const result = await agent.setMixedTaxDocumentColumns(['grossAmount', 'taxRate', 'grossAmount'])

    expect(result).toMatchObject({
      ok: true,
      action: 'setMixedTaxDocumentColumns',
      statusMessage: expect.stringContaining('quotations.statuses.agentDocumentColumnsUpdated'),
    })
    expect(quotation.value.totalsConfig.mixedTaxColumns).toEqual(['grossAmount', 'taxRate'])
    expect(saveCurrentQuotation).toHaveBeenCalledTimes(1)
  })

  it('rejects invalid preview and PDF mixed-tax document columns without saving', async () => {
    const saveCurrentQuotation = vi.fn()
    const { agent, quotation, statusMessage } = createHarness({ saveCurrentQuotation })

    const result = await agent.setMixedTaxDocumentColumns(['grossAmount', 'bad-column'])

    expect(result).toMatchObject({
      ok: false,
      action: 'setMixedTaxDocumentColumns',
      error: 'invalid_mixed_tax_document_columns',
      warnings: ['Unsupported mixed-tax document column: bad-column'],
    })
    expect(quotation.value.totalsConfig.mixedTaxColumns).toEqual([
      'taxRate',
      'unitPrice',
      'unitPriceWithTax',
      'netAmount',
      'grossAmount',
    ])
    expect(saveCurrentQuotation).not.toHaveBeenCalled()
    expect(statusMessage.value).toBe('')
  })

  it('sets mixed tax mode through a named workflow action', async () => {
    const saveCurrentQuotation = vi.fn()
    const { agent, quotation } = createHarness({ saveCurrentQuotation })

    const result = await agent.setTaxMode('mixed')

    expect(result).toMatchObject({
      ok: true,
      action: 'setTaxMode',
      statusMessage: expect.stringContaining('quotations.statuses.agentTaxModeUpdated'),
    })
    expect(quotation.value.totalsConfig.taxMode).toBe('mixed')
    expect(saveCurrentQuotation).toHaveBeenCalledTimes(1)
  })

  it('sets single tax mode with a selected tax class when one is required', async () => {
    const saveCurrentQuotation = vi.fn()
    const { agent, quotation, addRootItem } = createHarness({ saveCurrentQuotation })

    quotation.value.totalsConfig.taxClasses = [
      { id: 'standard-tax', label: 'Standard', rate: 13 },
      { id: 'reduced-tax', label: 'Reduced', rate: 5 },
    ]
    quotation.value.totalsConfig.defaultTaxClassId = 'standard-tax'
    quotation.value.totalsConfig.taxMode = 'mixed'
    getQuotationRootItems(quotation.value.majorItems)[0].taxClassId = 'standard-tax'
    addRootItem()
    getQuotationRootItems(quotation.value.majorItems)[1].taxClassId = 'reduced-tax'

    const result = await agent.setTaxMode('single', { taxClassId: 'standard-tax' })

    expect(result).toMatchObject({
      ok: true,
      action: 'setTaxMode',
      statusMessage: expect.stringContaining('quotations.statuses.agentTaxModeUpdated'),
    })
    expect(quotation.value.totalsConfig.taxMode).toBe('single')
    expect(quotation.value.totalsConfig.defaultTaxClassId).toBe('standard-tax')
    expect(getQuotationRootItems(quotation.value.majorItems).map((item) => item.taxClassId)).toEqual([
      'standard-tax',
      'standard-tax',
    ])
    expect(saveCurrentQuotation).toHaveBeenCalledTimes(1)
  })

  it('rejects single tax mode when a required tax class is missing', async () => {
    const saveCurrentQuotation = vi.fn()
    const { agent, quotation, addRootItem, statusMessage } = createHarness({ saveCurrentQuotation })

    quotation.value.totalsConfig.taxClasses = [
      { id: 'standard-tax', label: 'Standard', rate: 13 },
      { id: 'reduced-tax', label: 'Reduced', rate: 5 },
    ]
    quotation.value.totalsConfig.taxMode = 'mixed'
    getQuotationRootItems(quotation.value.majorItems)[0].taxClassId = 'standard-tax'
    addRootItem()
    getQuotationRootItems(quotation.value.majorItems)[1].taxClassId = 'reduced-tax'

    const result = await agent.setTaxMode('single')

    expect(result).toMatchObject({
      ok: false,
      action: 'setTaxMode',
      error: 'tax_class_required',
      warnings: ['Single tax mode requires a valid taxClassId when line items use multiple tax classes'],
    })
    expect(quotation.value.totalsConfig.taxMode).toBe('mixed')
    expect(saveCurrentQuotation).not.toHaveBeenCalled()
    expect(statusMessage.value).toBe('')
  })

  it('exports a PDF to a requested file path and returns the path plus summary', async () => {
    const exportQuotationDocument = vi.fn().mockResolvedValue({
      canceled: false,
      filePath: 'C:/quotes/agent-output.pdf',
      mode: 'native',
    })
    const { agent } = createHarness({
      runtime: createRuntimeMock({ exportQuotationDocument }),
    })

    const result = await agent.exportPdfToFile('C:/quotes/agent-output.pdf')

    expect(exportQuotationDocument).toHaveBeenCalledWith(expect.objectContaining({
      filePath: 'C:/quotes/agent-output.pdf',
      defaultFileName: expect.stringMatching(/\.pdf$/),
      quotation: expect.any(Object),
    }))
    expect(result).toMatchObject({
      ok: true,
      action: 'exportPdfToFile',
      filePath: 'C:/quotes/agent-output.pdf',
      statusMessage: expect.stringContaining('quotations.statuses.exportedPdf'),
      summary: {
        currency: 'USD',
      },
    })
  })

  it('exports a pending goods receipt PDF to a requested file path', async () => {
    const exportGoodsReceiptPdfToFile = vi.fn().mockResolvedValue({
      canceled: false,
      filePath: 'C:/quotes/GR-20260820.pdf',
      mode: 'native',
    })
    const { agent } = createHarness({ exportGoodsReceiptPdfToFile })

    const result = await agent.exportGoodsReceiptPdfToFile('C:/quotes/GR-20260820.pdf')

    expect(exportGoodsReceiptPdfToFile).toHaveBeenCalledWith('C:/quotes/GR-20260820.pdf')
    expect(result).toMatchObject({
      ok: true,
      action: 'exportGoodsReceiptPdfToFile',
      filePath: 'C:/quotes/GR-20260820.pdf',
    })
  })
})

function createComparableQuotation(quotation: unknown) {
  return JSON.parse(JSON.stringify(quotation))
}

function createHarness(overrides: Partial<CreateHarnessOptions> = {}) {
  const editor = useQuotationEditor(shallowRef('en-US'))
  const saveCurrentQuotation = overrides.saveCurrentQuotation ?? editor.saveCurrentQuotation
  const calculationTotalsConfig = computed(() => createCalculationTotalsConfig(editor.quotation.value.totalsConfig))
  const itemSummaries = computed<MajorItemSummary[]>(() =>
    getQuotationRootItems(editor.quotation.value.majorItems).map((item) =>
      calculateMajorItemSummary(item, calculationTotalsConfig.value, editor.quotation.value.exchangeRates),
    ),
  )
  const totals = computed<QuotationTotals>(() =>
    calculateQuotationTotals(
      editor.quotation.value.majorItems,
      calculationTotalsConfig.value,
      editor.quotation.value.exchangeRates,
    ),
  )
  const fileActions = useQuotationFileActions({
    quotation: editor.quotation,
    itemSummaries,
    totals,
    runtime: overrides.runtime ?? createRuntimeMock(),
    saveCurrentQuotation,
    replaceQuotationDraft: editor.replaceQuotationDraft,
    replaceLineItems: editor.replaceLineItems,
    setLogoDataUrl: editor.setLogoDataUrl,
    t: createTranslator(),
  })
  const agent = useQuotationAgentApi({
    quotation: editor.quotation,
    itemSummaries,
    totals,
    currentFilePath: fileActions.currentFilePath,
    statusMessage: fileActions.statusMessage,
    saveCurrentQuotation,
    importQuotationFile: fileActions.importJsonFromPath,
    importQuotationContent: fileActions.importJsonContent,
    importLineItemsCsvFile: fileActions.importCsvFromPath,
    importLineItemsCsvContent: fileActions.importCsvContent,
    importLineItemsXlsxFile: fileActions.importXlsxFromPath,
    importLineItemsXlsxContent: fileActions.importXlsxContent,
    setLogoDataUrl: editor.setLogoDataUrl,
    exportPdfToFile: fileActions.exportQuotationPdfToFile,
    exportGoodsReceiptPdfToFile: overrides.exportGoodsReceiptPdfToFile
      ?? vi.fn().mockResolvedValue(null),
    setTaxMode: editor.setTaxMode,
    setQuotationCurrency: editor.setQuotationCurrency,
    updateExchangeRates: editor.updateExchangeRates,
    setOutputItemDetailLevel: editor.setOutputItemDetailLevel,
    setMixedTaxDocumentColumns: editor.setMixedTaxDocumentColumns,
    t: createTranslator(),
  })

  return {
    ...editor,
    agent,
    statusMessage: fileActions.statusMessage,
  }
}

interface CreateHarnessOptions {
  runtime: QuotationRuntime
  saveCurrentQuotation: () => void
  exportGoodsReceiptPdfToFile: (filePath: string) => Promise<RuntimeSaveFileResult | null>
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
    getAppVersion: vi.fn().mockResolvedValue('0.1.0'),
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
    openLineItemsXlsxFile: vi.fn().mockResolvedValue({
      canceled: true,
    }),
    openLineItemsXlsxFileFromPath: vi.fn().mockResolvedValue({
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
    saveLineItemsExcelTemplateFile: vi.fn().mockResolvedValue({
      canceled: false,
      filePath: 'template.xlsx',
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
    exportQuotationDocument: vi.fn(async (options: ExportQuotationPdfOptions) => ({
      canceled: false,
      filePath: options.filePath ?? options.defaultFileName,
      mode: 'native' as const,
    })),
    exportGoodsReceiptDocument: vi.fn(async (options: ExportGoodsReceiptPdfOptions) => ({
      canceled: false,
      filePath: options.filePath ?? options.defaultFileName,
      mode: 'native' as const,
    })),
    getQuotationPrintPayload: vi.fn(),
    notifyQuotationPrintReady: vi.fn(),
    getGoodsReceiptPrintPayload: vi.fn(),
    notifyGoodsReceiptPrintReady: vi.fn(),
    ...overrides,
  }
}

async function readXlsxFixture(fileName: string) {
  const testModuleUrl = import.meta.url
  return new Uint8Array(await readFile(new URL(`../utils/fixtures/${fileName}`, testModuleUrl)))
}

function toRawBase64(content: Uint8Array) {
  let binary = ''
  for (const byte of content) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function createTranslator() {
  return (key: string, params?: Record<string, string | number>) => {
    if (!params) {
      return key
    }

    return `${key}:${JSON.stringify(params)}`
  }
}

function createLocalStorageMock(): Storage {
  let store = new Map<string, string>()

  return {
    get length() {
      return store.size
    },
    clear: vi.fn(() => {
      store = new Map()
    }),
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    key: vi.fn((index: number) => Array.from(store.keys())[index] ?? null),
    removeItem: vi.fn((key: string) => {
      store.delete(key)
    }),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value)
    }),
  }
}
