// @vitest-environment jsdom

import { computed, shallowRef } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ExportGoodsReceiptPdfOptions, ExportQuotationPdfOptions } from '@/shared/contracts/quotationApp'
import type { QuotationRuntime } from '@/shared/runtime/quotationRuntime'

import type { MajorItemSummary, QuotationTotals } from '../types'
import { calculateMajorItemSummary, calculateQuotationTotals } from '../utils/quotationCalculations'
import { createCalculationTotalsConfig } from '../utils/quotationTaxes'
import { getQuotationRootItems } from '../utils/quotationItems'
import { useQuotationEditor } from './useQuotationEditor'
import { useQuotationFileActions } from './useQuotationFileActions'
import { useQuotationAgentApi } from './useQuotationAgentApi'

describe('useQuotationAgentApi', () => {
  it('routes agent mutations through one undoable editor transaction', async () => {
    const harness = createHarness()
    harness.resetQuotationChangeHistory()
    const original = JSON.parse(JSON.stringify(harness.quotation.value))

    await harness.agent.setBaseCurrency('CNY', { USD: 7.1, CNY: 1 })
    await harness.agent.setOutputItemDetailLevel(3)
    await harness.agent.setMixedTaxDocumentColumns(['taxRate', 'grossAmount'])
    const changed = JSON.parse(JSON.stringify(harness.quotation.value))

    expect(harness.undoLastQuotationChange().ok).toBe(true)
    expect(harness.quotation.value).toEqual(original)
    expect(harness.redoLastQuotationChange().ok).toBe(true)
    expect(harness.quotation.value).toEqual(changed)
  })

  const localStorageMock = createLocalStorageMock()

  beforeEach(() => {
    vi.stubGlobal('window', {
      localStorage: localStorageMock,
    })
    localStorageMock.clear()
  })

  afterEach(() => {
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
      statusMessage: expect.stringContaining('quotations.statuses.importedCsv'),
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

  it('uploads a logo from a base64 image data URL', async () => {
    const saveCurrentQuotation = vi.fn()
    const { agent, quotation } = createHarness({ saveCurrentQuotation })
    const logoDataUrl = 'data:image/png;base64,aGVsbG8='

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
      error: 'invalid_logo_data_url',
      warnings: ['Logo must be a base64 image data URL'],
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
      error: 'invalid_logo_data_url',
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
      'unitTax',
      'unitPriceWithTax',
      'taxAmount',
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
})

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
    setLogoDataUrl: editor.setLogoDataUrl,
    exportPdfToFile: fileActions.exportQuotationPdfToFile,
    setTaxMode: editor.setTaxMode,
    setQuotationCurrency: editor.setQuotationCurrency,
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
