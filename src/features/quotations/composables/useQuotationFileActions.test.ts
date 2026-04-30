// @vitest-environment jsdom

import { ref, shallowRef } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { QuotationAppApi } from '@/shared/contracts/quotationApp'

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

  it('falls back to browser download for CSV template export when the native API is unavailable', async () => {
    const createObjectURL = vi.fn(() => 'blob:template')
    const revokeObjectURL = vi.fn()
    const link = document.createElement('a')
    const click = vi.spyOn(link, 'click').mockImplementation(() => undefined)
    const append = vi.spyOn(document.body, 'append').mockImplementation(() => undefined)
    const createElement = vi.spyOn(document, 'createElement').mockReturnValue(link)

    vi.stubGlobal('URL', {
      createObjectURL,
      revokeObjectURL,
    })

    const { actions, statusMessage } = createHarness()

    await actions.exportCsvTemplate()

    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(createElement).toHaveBeenCalledWith('a')
    expect(append).toHaveBeenCalledTimes(1)
    expect(click).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledTimes(1)
    expect(statusMessage.value).toContain('quotations.statuses.downloaded')
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
  const quotationApp = createQuotationAppMock(overrides.quotationApp)

  const actions = useQuotationFileActions({
    quotation,
    itemSummaries,
    totals,
    companyProfile: ref({
      companyName: 'ACME',
      email: '',
      phone: '',
    }),
    flushPendingEdits,
    quotationApp,
    saveCurrentQuotation,
    replaceQuotationDraft,
    replaceLineItems,
    setLogoDataUrl,
    jsonImportInput: shallowRef(null),
    csvImportInput: shallowRef(null),
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

function createTranslator() {
  return (key: string, params?: Record<string, string | number>) => {
    if (!params) {
      return key
    }

    return `${key}:${JSON.stringify(params)}`
  }
}
