// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'

import { createAppI18n } from '@/shared/i18n/createAppI18n'
import { messages } from '@/shared/i18n/messages'
import * as quotationRuntime from '@/shared/runtime/quotationRuntime'
import type { RuntimeSaveFileResult } from '@/shared/runtime/quotationRuntime'

import QuotationEditor from './QuotationEditor.vue'
import QuotationCommandBar from './QuotationCommandBar.vue'
import LineItemsImportDialog from './LineItemsImportDialog.vue'
import { createInitialQuotation } from '../utils/quotationDraft'
import { createQuotationFileContent } from '../utils/quotationFile'
import { proposeQuotationRevision } from '../utils/quotationRevisions'

const toastAdd = vi.hoisted(() => vi.fn())

vi.mock('primevue/usetoast', () => ({
  useToast: () => ({ add: toastAdd }),
}))

describe('QuotationEditor', () => {
  const localStorageMock = createLocalStorageMock()

  beforeEach(() => {
    vi.spyOn(window, 'addEventListener').mockImplementation(() => undefined)
    vi.spyOn(window, 'removeEventListener').mockImplementation(() => undefined)
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: localStorageMock,
    })
    Object.defineProperty(window, 'quotationApp', {
      configurable: true,
      value: undefined,
      writable: true,
    })
    localStorageMock.clear()
    toastAdd.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the analysis view inside a dedicated scroll surface', async () => {
    const wrapper = mountQuotationEditor()

    await wrapper.get('[data-testid="open-analysis"]').trigger('click')

    const analysisSurface = wrapper.get('.analysis-surface')

    expect(analysisSurface.get('.analysis-view-stub').text()).toBe('analysis')
  })

  it('switches compact views without unmounting the line-item workbench', async () => {
    const wrapper = mountQuotationEditor()
    const workbench = wrapper.get('.workbench-main').element
    const tabs = wrapper.findAll('.compact-workbench-nav button')
    await tabs[1]!.trigger('click')
    expect(wrapper.get('.workbench-layout').classes()).toContain('workbench-layout--settings')
    expect(wrapper.get('.workbench-main').element).toBe(workbench)
    await tabs[0]!.trigger('click')
    expect(wrapper.get('.workbench-layout').classes()).not.toContain('workbench-layout--settings')
    wrapper.unmount()
  })

  it('reveals line items when selecting an analysis item after compact settings', async () => {
    const wrapper = mountQuotationEditor()
    await wrapper.findAll('.compact-workbench-nav button')[1]!.trigger('click')
    await wrapper.get('[data-testid="open-analysis"]').trigger('click')
    wrapper.findComponent({ name: 'QuotationAnalysisView' }).vm.$emit('selectItem', { itemId: 'item-1' })
    await flushPromises()
    expect(wrapper.get('.workbench-layout').classes()).not.toContain('workbench-layout--settings')
    expect(wrapper.find('.analysis-surface').exists()).toBe(false)
    wrapper.unmount()
  })

  it.each(['en-US', 'zh-CN'] as const)('keeps the %s manual-number warning visible until a number is entered', async locale => {
    const wrapper = mountQuotationEditor(undefined, true, locale)
    await flushPromises()
    const api = window.quotationAgentV2!
    expect((await api.updateHeader({ quotationNumber: '' })).ok).toBe(true)
    await flushPromises()
    expect(wrapper.get('[data-testid="quotation-number-warning"]').text()).toBe(messages[locale].quotations.statuses.quotationNumberRequired)

    expect((await api.updateHeader({ quotationNumber: 'MANUAL-001' })).ok).toBe(true)
    await flushPromises()
    expect(wrapper.find('[data-testid="quotation-number-warning"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('shows persistent storage and manual-number warnings when number reservation fails', async () => {
    localStorageMock.setItem('quotation-software:reusable-library-cache', JSON.stringify({
      companyProfiles: [], customers: [], numbering: { lastIssuedYear: 2026, lastIssuedSequence: 1 },
    }))
    const setItem = localStorageMock.setItem.bind(localStorageMock)
    vi.spyOn(localStorageMock, 'setItem').mockImplementation((key, value) => {
      if (key === 'quotation-software:reusable-library-cache') throw new DOMException('Full', 'QuotaExceededError')
      setItem(key, value)
    })
    const wrapper = mountQuotationEditor()
    await flushPromises()

    expect(wrapper.get('[data-testid="quotation-storage-warning"]').text()).toBe(messages['en-US'].quotations.statuses.libraryStorageWarning)
    expect(wrapper.find('[data-testid="quotation-number-warning"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('shows a translated warning when damaged local drafts cannot be recovered', async () => {
    localStorageMock.setItem('quotation-software:quotation-draft-ids', JSON.stringify(['quote-1']))
    localStorageMock.setItem('quotation-software:quotation-draft:quote-1', '{broken')

    const wrapper = mountQuotationEditor()
    await flushPromises()

    expect(toastAdd).toHaveBeenCalledWith({
      severity: 'warn',
      summary: 'Local draft recovery completed',
      detail: 'Recovered 0 draft(s). 1 damaged draft(s) could not be recovered.',
      life: 8000,
    })

    wrapper.unmount()
  })

  it('switches saved revisions in the main workspace without replacing unsaved working edits', async () => {
    const wrapper = mountQuotationEditor(window.document.body)
    await flushPromises()
    const api = window.quotationAgentV2!
    const first = createInitialQuotation([], 'en-US')
    first.header.projectName = 'Archived first'
    let document = proposeQuotationRevision({ quotation: first, revisions: [] })
    document.quotation.header.projectName = 'Archived second'
    document = proposeQuotationRevision(document)
    const imported = await api.importQuotationContent(createQuotationFileContent(document.quotation, document.revisions))
    expect(imported.ok).toBe(true)
    await api.updateHeader({ projectName: 'Unsaved working edits' })
    const before = await api.getQuotationSnapshot()
    const bar = wrapper.getComponent(QuotationCommandBar)

    bar.vm.$emit('selectRevision', document.revisions[0]!.id)
    await flushPromises()
    expect(wrapper.get('[data-testid="saved-revision-view"]').text()).toContain('Archived first')
    expect(wrapper.get('.workbench-layout').isVisible()).toBe(false)
    const whileViewing = await api.getQuotationSnapshot()
    expect(whileViewing.ok && whileViewing.data).toEqual(before.ok && before.data)

    bar.vm.$emit('selectRevision', document.revisions[1]!.id)
    await flushPromises()
    expect(wrapper.get('[data-testid="saved-revision-view"]').text()).toContain('Archived second')
    await wrapper.get('[data-testid="back-to-working"]').trigger('click')
    expect(wrapper.find('[data-testid="saved-revision-view"]').exists()).toBe(false)
    expect(wrapper.get('.workbench-layout').isVisible()).toBe(true)
    const after = await api.getQuotationSnapshot()
    expect(after.ok && after.data.quotation.header.projectName).toBe('Unsaved working edits')
    // Request metadata changes per API call; the quotation and its in-memory version do not.
    expect(after.ok && after.data).toEqual(before.ok && before.data)
    wrapper.unmount()
  })

  it.each(['saved revision', 'save in progress'] as const)('blocks import-dialog entry points and stale confirmation during %s', async (state) => {
    const runtime = quotationRuntime.createQuotationRuntime({ appTarget: 'web' })
    runtime.openLineItemsCsvFile = vi.fn().mockResolvedValue({
      canceled: false,
      filePath: 'items.csv',
      content: 'item_name,qty,manual_unit_price\nReplacement item,1,25',
    })
    let finishSave!: (result: RuntimeSaveFileResult) => void
    runtime.saveQuotationFile = vi.fn(() => new Promise<RuntimeSaveFileResult>(resolve => { finishSave = resolve }))
    vi.spyOn(quotationRuntime, 'getQuotationRuntime').mockReturnValue(runtime)
    const wrapper = mountQuotationEditor(undefined, false)
    await flushPromises()
    const api = window.quotationAgentV2!
    const document = proposeQuotationRevision({ quotation: createInitialQuotation([], 'en-US'), revisions: [] })
    expect((await api.importQuotationContent(createQuotationFileContent(document.quotation, document.revisions))).ok).toBe(true)
    const bar = wrapper.getComponent(QuotationCommandBar)
    const dialog = wrapper.getComponent(LineItemsImportDialog)
    bar.vm.$emit('importLineItems')
    await flushPromises()
    expect(dialog.props('visible')).toBe(true)
    dialog.vm.$emit('chooseCsvFile')
    await flushPromises()
    expect(dialog.props('hasPendingImport')).toBe(true)
    dialog.vm.$emit('update:visible', false)
    const before = await api.getQuotationSnapshot()

    if (state === 'saved revision') {
      bar.vm.$emit('selectRevision', document.revisions[0]!.id)
    } else {
      bar.vm.$emit('save')
    }
    await flushPromises()
    if (state === 'saved revision') {
      expect(bar.get(`button[aria-label="${messages['en-US'].quotations.csv.report.open}"]`).attributes('disabled')).toBeDefined()
    } else {
      expect(wrapper.get('.quotation-editor').attributes('aria-busy')).toBe('true')
    }
    bar.vm.$emit('openImportReport')
    bar.vm.$emit('importLineItems')
    dialog.vm.$emit('confirm')
    await flushPromises()
    expect(dialog.props('visible')).toBe(false)
    expect(dialog.props('hasPendingImport')).toBe(true)

    if (state === 'saved revision') bar.vm.$emit('selectRevision', null)
    else finishSave({ canceled: true })
    await flushPromises()
    const after = await api.getQuotationSnapshot()
    expect(after.ok && after.data.quotation).toEqual(before.ok && before.data.quotation)
    bar.vm.$emit('openImportReport')
    await flushPromises()
    expect(dialog.props('visible')).toBe(true)
    dialog.vm.$emit('confirm')
    await flushPromises()
    expect(dialog.props('hasPendingImport')).toBe(false)
    const imported = await api.getQuotationSnapshot()
    expect(imported.ok && imported.data.quotation.majorItems[0]).toMatchObject({ name: 'Replacement item' })
    wrapper.unmount()
  })
})

function mountQuotationEditor(attachTo?: HTMLElement, stubCommandBar = true, locale: 'en-US' | 'zh-CN' = 'en-US') {
  return mount(QuotationEditor, {
    attachTo,
    props: {
      uiLocale: locale,
    },
    global: {
      plugins: [PrimeVue, ToastService, createAppI18n(locale)],
      directives: {
        tooltip: {},
      },
      stubs: {
        QuotationCommandBar: stubCommandBar ? {
          template: '<button data-testid="open-analysis" @click="$emit(\'openAnalysis\')">analysis</button>',
        } : false,
        QuotationAnalysisView: {
          name: 'QuotationAnalysisView',
          template: '<div class="analysis-view-stub">analysis</div>',
        },
        LineItemsTable: true,
        PricingPanel: true,
        QuoteInfoPanel: true,
        QuoteCustomerPanel: true,
        ExchangeRatePanel: true,
        QuotationSupportPanels: true,
        QuotationNavigator: true,
        FloatingPreviewWindow: true,
        QuotationSavedRevisionView: {
          props: ['revision', 'workingRevisionNumber'],
          emits: ['back', 'restore'],
          template: '<section data-testid="saved-revision-view">{{ revision.quotation.header.projectName }}<button data-testid="back-to-working" @click="$emit(\'back\')">back</button></section>',
        },
        Dialog: {
          template: '<div><slot /></div>',
        },
        Button: {
          template: '<button><slot /></button>',
        },
        Select: {
          template: '<div><slot /></div>',
        },
      },
    },
  })
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
