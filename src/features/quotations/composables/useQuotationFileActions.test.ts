// @vitest-environment jsdom

import { readFile } from 'node:fs/promises'

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

    await expect(actions.importCsvFromPath('C:/quotes/items.csv')).resolves.toEqual({
      ok: true,
      warnings: [],
    })

    expect(openLineItemsCsvFileFromPath).toHaveBeenCalledWith('C:/quotes/items.csv')
    expect(replaceLineItems).toHaveBeenCalledTimes(1)
    expect(replaceLineItems.mock.calls[0]?.[0][0].name).toBe('Imported line')
    expect(saveCurrentQuotation).toHaveBeenCalledTimes(1)
    expect(statusMessage.value).toContain('quotations.statuses.importedLineItems')
  })

  it('previews a UI CSV import before confirmation', async () => {
    const replaceLineItems = vi.fn()
    const saveCurrentQuotation = vi.fn()
    const flushPendingEdits = vi.fn()
    const { actions, pendingLineItemsImport, lineItemsImportReport } = createHarness({
      runtime: createRuntimeMock({
        openLineItemsCsvFile: vi.fn().mockResolvedValue({
          canceled: false,
          filePath: 'C:/quotes/preview.csv',
          content: [
            'item_name,qty,manual_unit_price,extra column',
            'Preview item,2,50,ignored',
          ].join('\n'),
        }),
      }),
      replaceLineItems,
      saveCurrentQuotation,
      flushPendingEdits,
    })

    await expect(actions.importCsv()).resolves.toBe(true)

    expect(replaceLineItems).not.toHaveBeenCalled()
    expect(saveCurrentQuotation).not.toHaveBeenCalled()
    expect(pendingLineItemsImport.value).toMatchObject({
      fileName: 'preview.csv',
      rowCount: 1,
      recognizedColumns: ['item_name', 'qty', 'manual_unit_price'],
      ignoredColumns: ['extra column'],
    })
    expect(lineItemsImportReport.value).toMatchObject({
      status: 'ready',
      ok: true,
      rowCount: 1,
    })

    expect(actions.confirmLineItemsImport()).toBe(true)
    expect(flushPendingEdits).toHaveBeenCalledTimes(1)
    expect(replaceLineItems).toHaveBeenCalledTimes(1)
    expect(saveCurrentQuotation).toHaveBeenCalledTimes(1)
    expect(pendingLineItemsImport.value).toBeNull()
    expect(lineItemsImportReport.value?.status).toBe('imported')
    expect(actions.confirmLineItemsImport()).toBe(false)
    expect(replaceLineItems).toHaveBeenCalledTimes(1)
    expect(saveCurrentQuotation).toHaveBeenCalledTimes(1)
  })

  it('blocks confirmation when a selected CSV has validation errors', async () => {
    const replaceLineItems = vi.fn()
    const { actions, pendingLineItemsImport, lineItemsImportReport } = createHarness({
      runtime: createRuntimeMock({
        openLineItemsCsvFile: vi.fn().mockResolvedValue({
          canceled: false,
          filePath: 'C:/quotes/invalid.csv',
          content: 'item_name,qty,manual_unit_price\nInvalid item,1,not-a-number',
        }),
      }),
      replaceLineItems,
    })

    await expect(actions.importCsv()).resolves.toBe(false)

    expect(pendingLineItemsImport.value).toBeNull()
    expect(lineItemsImportReport.value?.status).toBe('failed')
    expect(lineItemsImportReport.value?.fileName).toBe('invalid.csv')
    expect(lineItemsImportReport.value?.rowCount).toBe(1)
    expect(lineItemsImportReport.value?.entries[0]).toMatchObject({
      severity: 'error',
      code: 'invalid_number',
    })
    expect(actions.confirmLineItemsImport()).toBe(false)
    expect(replaceLineItems).not.toHaveBeenCalled()
  })

  it('cancels a pending UI CSV import without changing rows', async () => {
    const replaceLineItems = vi.fn()
    const { actions, pendingLineItemsImport, lineItemsImportReport, statusMessage } = createHarness({
      runtime: createRuntimeMock({
        openLineItemsCsvFile: vi.fn().mockResolvedValue({
          canceled: false,
          filePath: 'C:/quotes/preview.csv',
          content: 'item_name,qty,manual_unit_price\nPreview item,2,50',
        }),
      }),
      replaceLineItems,
    })

    await actions.importCsv()
    expect(pendingLineItemsImport.value).not.toBeNull()
    const reportEntries = lineItemsImportReport.value?.entries

    actions.cancelLineItemsImport()

    expect(pendingLineItemsImport.value).toBeNull()
    expect(lineItemsImportReport.value).toMatchObject({
      status: 'canceled',
      entries: reportEntries,
    })
    expect(statusMessage.value).toContain('quotations.statuses.lineItemsImportCanceled')
    expect(replaceLineItems).not.toHaveBeenCalled()
  })

  it('returns CSV import warnings and keeps a report for the UI', async () => {
    const replaceLineItems = vi.fn()
    const { actions, lineItemsImportReport, statusMessage } = createHarness({
      replaceLineItems,
    })

    await expect(actions.importCsvContent([
      'item_code,item_name,item_description,qty,qty_unit,pricing_basis,unit_price,unit_cost,cost_currency,tax_class,markup_override,expected_total',
      ',Imported line,,2,,cost_plus,,10,USD,,,',
    ].join('\n'))).resolves.toEqual({
      ok: true,
      warnings: [
        'Row 2: item_code assigned 1',
        'Row 2: qty_unit defaulted to EA',
      ],
    })

    expect(replaceLineItems.mock.calls[0]?.[0][0]).toMatchObject({
      name: 'Imported line',
      quantityUnit: 'EA',
    })
    expect(lineItemsImportReport.value).toMatchObject({
      ok: true,
      entries: [
        {
          severity: 'warning',
          row: 2,
          column: 'item_code',
        },
        {
          severity: 'warning',
          row: 2,
          column: 'qty_unit',
        },
      ],
    })
    expect(statusMessage.value).toContain('quotations.statuses.importedLineItemsWithWarnings')
  })

  it('keeps all CSV warnings and errors in the failed import report', async () => {
    const replaceLineItems = vi.fn()
    const { actions, lineItemsImportReport, statusMessage } = createHarness({
      replaceLineItems,
    })

    await expect(actions.importCsvContent([
      'item_code,item_name,item_description,qty,qty_unit,pricing_basis,unit_price,unit_cost,cost_currency,tax_class,markup_override,expected_total',
      ',Imported line,,2,,cost_plus,,bad,USD,,,',
    ].join('\n'))).resolves.toEqual({
      ok: false,
      warnings: [
        'Row 2: unit_cost must be numeric',
        'Row 2: item_code assigned 1',
        'Row 2: qty_unit defaulted to EA',
      ],
    })

    expect(replaceLineItems).not.toHaveBeenCalled()
    expect(lineItemsImportReport.value).toMatchObject({
      ok: false,
      entries: [
        {
          severity: 'error',
          row: 2,
          column: 'unit_cost',
        },
        {
          severity: 'warning',
          row: 2,
          column: 'item_code',
        },
        {
          severity: 'warning',
          row: 2,
          column: 'qty_unit',
        },
      ],
    })
    expect(statusMessage.value).toContain('quotations.csv.errors.invalidNumber')
  })

  it('previews an XLSX import and applies it only after confirmation', async () => {
    const replaceLineItems = vi.fn()
    const saveCurrentQuotation = vi.fn()
    const flushPendingEdits = vi.fn()
    const content = await readXlsxFixture('valid-line-items.xlsx')
    const { actions } = createHarness({
      runtime: createRuntimeMock({
        openLineItemsXlsxFile: vi.fn().mockResolvedValue({
          canceled: false,
          filePath: 'C:/quotes/items.xlsx',
          content,
        }),
      }),
      replaceLineItems,
      saveCurrentQuotation,
      flushPendingEdits,
    })

    await expect(actions.importXlsx()).resolves.toBe(true)
    expect(actions.pendingLineItemsImport.value).toMatchObject({
      fileName: 'items.xlsx',
      rowCount: 3,
    })
    expect(actions.lineItemsImportReport.value).toMatchObject({ status: 'ready', ok: true })
    expect(replaceLineItems).not.toHaveBeenCalled()

    expect(actions.confirmLineItemsImport()).toBe(true)
    expect(flushPendingEdits).toHaveBeenCalledTimes(1)
    expect(replaceLineItems.mock.calls[0]?.[0][0]).toMatchObject({ name: '设备 Equipment' })
    expect(saveCurrentQuotation).toHaveBeenCalledTimes(1)
    expect(actions.lineItemsImportReport.value?.status).toBe('imported')
  })

  it('cancels a staged XLSX import without replacing rows', async () => {
    const replaceLineItems = vi.fn()
    const content = await readXlsxFixture('valid-line-items.xlsx')
    const { actions } = createHarness({
      runtime: createRuntimeMock({
        openLineItemsXlsxFile: vi.fn().mockResolvedValue({
          canceled: false,
          filePath: 'C:/quotes/items.xlsx',
          content,
        }),
      }),
      replaceLineItems,
    })

    await actions.importXlsx()
    actions.cancelLineItemsImport()

    expect(actions.pendingLineItemsImport.value).toBeNull()
    expect(actions.lineItemsImportReport.value?.status).toBe('canceled')
    expect(replaceLineItems).not.toHaveBeenCalled()
  })

  it('keeps quotation rows unchanged when XLSX validation fails', async () => {
    const replaceLineItems = vi.fn()
    const content = await readXlsxFixture('corrupt.xlsx')
    const { actions } = createHarness({
      runtime: createRuntimeMock({
        openLineItemsXlsxFile: vi.fn().mockResolvedValue({
          canceled: false,
          filePath: 'C:/quotes/corrupt.xlsx',
          content,
        }),
      }),
      replaceLineItems,
    })

    await expect(actions.importXlsx()).resolves.toBe(false)

    expect(actions.pendingLineItemsImport.value).toBeNull()
    expect(actions.lineItemsImportReport.value).toMatchObject({
      fileName: 'corrupt.xlsx',
      status: 'failed',
      ok: false,
    })
    expect(replaceLineItems).not.toHaveBeenCalled()
  })

  it('reports the exact formula cell without replacing rows', async () => {
    const replaceLineItems = vi.fn()
    const content = await readXlsxFixture('formula.xlsx')
    const { actions } = createHarness({
      runtime: createRuntimeMock({
        openLineItemsXlsxFile: vi.fn().mockResolvedValue({
          canceled: false,
          filePath: 'C:/quotes/formula.xlsx',
          content,
        }),
      }),
      replaceLineItems,
    })

    await expect(actions.importXlsx()).resolves.toBe(false)

    expect(actions.statusMessage.value).toContain('quotations.xlsx.errors.unsupportedFormula')
    expect(actions.lineItemsImportReport.value?.entries[0]).toMatchObject({
      severity: 'error',
      row: 2,
      column: 'B2',
    })
    expect(replaceLineItems).not.toHaveBeenCalled()
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
    expect(saveLineItemsCsvTemplateFile).toHaveBeenCalledWith({
      defaultPath: 'quotation-line-items-template.csv',
      content: '\uFEFFitem_code,item_name,item_description,qty,qty_unit,manual_unit_price,unit_cost,cost_currency,tax_class,markup_override\n',
    })
    expect(statusMessage.value).toContain('quotations.statuses.downloaded')
  })

  it('reports a successful Excel template download', async () => {
    const saveLineItemsExcelTemplateFile = vi.fn().mockResolvedValue({
      canceled: false,
      filePath: 'quotation-line-items-template.xlsx',
      mode: 'download',
    })
    const { actions, statusMessage } = createHarness({
      runtime: createRuntimeMock({ saveLineItemsExcelTemplateFile }),
    })

    await actions.exportExcelTemplate()

    expect(saveLineItemsExcelTemplateFile).toHaveBeenCalledWith()
    expect(statusMessage.value).toContain('quotations.statuses.downloaded')
    expect(statusMessage.value).toContain('quotation-line-items-template.xlsx')
  })

  it('reports a canceled Excel template download', async () => {
    const { actions, statusMessage } = createHarness({
      runtime: createRuntimeMock({
        saveLineItemsExcelTemplateFile: vi.fn().mockResolvedValue({ canceled: true }),
      }),
    })

    await actions.exportExcelTemplate()

    expect(statusMessage.value).toBe('quotations.statuses.excelTemplateDownloadCanceled')
  })

  it('reports an Excel template download failure', async () => {
    const { actions, statusMessage } = createHarness({
      runtime: createRuntimeMock({
        saveLineItemsExcelTemplateFile: vi.fn().mockRejectedValue(new Error('asset missing')),
      }),
    })

    await actions.exportExcelTemplate()

    expect(statusMessage.value).toBe('quotations.statuses.excelTemplateDownloadFailed')
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
    openLineItemsXlsxFile: overrides.quotationApp?.openLineItemsXlsxFile
      ?? vi.fn().mockResolvedValue({ canceled: true }),
    openLineItemsXlsxFileFromPath: overrides.quotationApp?.openLineItemsXlsxFileFromPath
      ?? vi.fn().mockResolvedValue({ canceled: true }),
    saveLineItemsCsvFile: mapBridgeSaveMock(overrides.quotationApp?.saveLineItemsCsvFile),
    saveLineItemsCsvTemplateFile: mapBridgeSaveMock(overrides.quotationApp?.saveLineItemsCsvTemplateFile),
    saveLineItemsExcelTemplateFile: mapBridgeSaveMock(overrides.quotationApp?.saveLineItemsExcelTemplateFile),
    exportQuotationDocument: mapBridgeSaveMock(overrides.quotationApp?.exportQuotationPdf),
    exportGoodsReceiptDocument: mapBridgeSaveMock(overrides.quotationApp?.exportGoodsReceiptPdf),
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
    lineItemsImportReport: actions.lineItemsImportReport,
    pendingLineItemsImport: actions.pendingLineItemsImport,
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
    exportQuotationDocument: vi.fn().mockResolvedValue({
      canceled: false,
      filePath: 'quote.pdf',
      mode: 'native',
    }),
    exportGoodsReceiptDocument: vi.fn().mockResolvedValue({
      canceled: false,
      filePath: 'goods-receipt.pdf',
      mode: 'native',
    }),
    getQuotationPrintPayload: vi.fn(),
    notifyQuotationPrintReady: vi.fn(),
    getGoodsReceiptPrintPayload: vi.fn(),
    notifyGoodsReceiptPrintReady: vi.fn(),
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

async function readXlsxFixture(fileName: string) {
  const testModuleUrl = import.meta.url
  return new Uint8Array(await readFile(new URL(`../utils/fixtures/${fileName}`, testModuleUrl)))
}

function createTranslator() {
  return (key: string, params?: Record<string, string | number>) => {
    if (!params) {
      return key
    }

    return `${key}:${JSON.stringify(params)}`
  }
}
