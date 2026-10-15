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
import LineItemsTable from './LineItemsTable.vue'
import PricingPanel from './PricingPanel.vue'
import QuoteCustomerPanel from './QuoteCustomerPanel.vue'
import QuotationDocumentSettings from './QuotationDocumentSettings.vue'
import QuotationSummarySettings from './QuotationSummarySettings.vue'
import ExchangeRatePanel from './ExchangeRatePanel.vue'
import { registerLineItemEditBuffer } from '../utils/lineItemEditBuffers'
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
    wrapper.unmount()
  })

  it.each(['en-US', 'zh-CN'] as const)('retains quotation inputs across all workflow stages in %s', async locale => {
    const wrapper = mountQuotationEditor(document.body, true, locale)
    await flushPromises()
    const api = window.quotationAgentV2!
    const project = wrapper.get('[data-history-target="header:projectName"] input')
    await project.setValue('Hydraulic skid maintenance')
    wrapper.getComponent(QuoteCustomerPanel).vm.$emit('updateHeaderField', 'customerCompany', 'Harbor Services')

    await wrapper.get('[data-testid="workflow-items"]').trigger('click')
    expect(wrapper.get('#workflow-panel-items').isVisible()).toBe(true)
    const items = wrapper.getComponent(LineItemsTable)
    const itemId = items.props('items')[0]!.id
    items.vm.$emit('updateItemField', itemId, 'name', 'Pump service')
    items.vm.$emit('updateItemField', itemId, 'quantity', 3)

    await wrapper.get('[data-testid="workflow-pricing"]').trigger('click')
    expect(wrapper.get('#workflow-panel-pricing').isVisible()).toBe(true)
    wrapper.getComponent(PricingPanel).vm.$emit('updateTotalsField', 'globalMarkupRate', 25)

    await wrapper.get('[data-testid="workflow-review"]').trigger('click')
    await flushPromises()
    const settings = wrapper.getComponent(QuotationDocumentSettings)
    settings.vm.$emit('update:templateId', 'technical-bid')
    settings.vm.$emit('update:outputItemDetailLevel', 2)
    settings.vm.$emit('update:documentLocale', locale === 'en-US' ? 'zh-CN' : 'en-US')
    await flushPromises()
    expect(wrapper.get('#workflow-panel-review').isVisible()).toBe(true)
    expect(wrapper.findComponent(QuotationSummarySettings).exists()).toBe(true)
    expect(wrapper.get('#workflow-panel-details').find('.document-settings').exists()).toBe(false)

    await wrapper.get('[data-testid="workflow-details"]').trigger('click')
    expect((wrapper.get('[data-history-target="header:projectName"] input').element as HTMLInputElement).value).toBe('Hydraulic skid maintenance')
    await wrapper.get('[data-testid="workflow-items"]').trigger('click')
    expect(items.props('items')[0]).toMatchObject({ name: 'Pump service', quantity: 3 })
    await wrapper.get('[data-testid="workflow-pricing"]').trigger('click')
    expect(wrapper.getComponent(PricingPanel).props('totalsConfig').globalMarkupRate).toBe(25)
    await wrapper.get('[data-testid="workflow-review"]').trigger('click')
    await flushPromises()
    expect(wrapper.getComponent(QuotationDocumentSettings).props()).toMatchObject({
      templateId: 'technical-bid', outputItemDetailLevel: 2, documentLocale: locale === 'en-US' ? 'zh-CN' : 'en-US',
    })
    const snapshot = await api.getQuotationSnapshot()
    expect(snapshot.ok && snapshot.data.quotation.header).toMatchObject({
      projectName: 'Hydraulic skid maintenance', customerCompany: 'Harbor Services',
    })
    wrapper.unmount()
  })

  it('commits pending item edits before leaving the items stage', async () => {
    const wrapper = mountQuotationEditor(document.body)
    await flushPromises()
    await wrapper.get('[data-testid="workflow-items"]').trigger('click')
    const table = wrapper.getComponent(LineItemsTable)
    const itemId = table.props('items')[0]!.id
    let pending = true
    const stop = registerLineItemEditBuffer(() => {
      if (!pending) return
      pending = false
      table.vm.$emit('updateItemField', itemId, 'name', 'Committed before review')
    })
    try {
      await wrapper.get('[data-testid="workflow-review"]').trigger('click')
      await flushPromises()
      expect(pending).toBe(false)
      const snapshot = await window.quotationAgentV2!.getQuotationSnapshot()
      expect(snapshot.ok && snapshot.data.quotation.majorItems[0]).toMatchObject({ name: 'Committed before review' })
      expect(wrapper.get('#workflow-panel-review').isVisible()).toBe(true)
    } finally {
      stop()
      wrapper.unmount()
    }
  })

  it.each([
    ['project', 'details'],
    ['item', 'items'],
    ['markup', 'pricing'],
    ['exchangeRate', 'pricing'],
    ['documentLocale', 'review'],
    ['outputSettings', 'review'],
    ['template', 'review'],
  ] as const)('reveals the %s edit in the %s stage after undo and redo', async (field, expectedStep) => {
    const wrapper = mountQuotationEditor(document.body)
    await flushPromises()
    const table = wrapper.getComponent(LineItemsTable)
    if (field === 'project') {
      await wrapper.get('[data-history-target="header:projectName"] input').setValue('Undo project')
    } else if (field === 'item') {
      table.vm.$emit('updateItemField', table.props('items')[0]!.id, 'name', 'Undo item')
    } else if (field === 'markup') {
      wrapper.getComponent(PricingPanel).vm.$emit('updateTotalsField', 'globalMarkupRate', 25)
    } else if (field === 'exchangeRate') {
      wrapper.getComponent(ExchangeRatePanel).vm.$emit('updateRate', 'EUR', 1.5)
    } else {
      await wrapper.get('[data-testid="workflow-review"]').trigger('click')
      await flushPromises()
      const settings = wrapper.getComponent(QuotationDocumentSettings)
      if (field === 'documentLocale') settings.vm.$emit('update:documentLocale', 'zh-CN')
      else if (field === 'outputSettings') settings.vm.$emit('update:outputItemDetailLevel', 2)
      else settings.vm.$emit('update:templateId', 'technical-bid')
    }
    await wrapper.get('[data-testid="workflow-analysis"]').trigger('click')
    await flushPromises()
    await triggerQuotationShortcut('z')
    expect(wrapper.get('[role="tab"][aria-selected="true"]').attributes('id')).toBe(`workflow-tab-${expectedStep}`)
    expect(wrapper.get(`#workflow-panel-${expectedStep}`).isVisible()).toBe(true)
    const documentTarget = field === 'documentLocale' ? 'header:documentLocale'
      : field === 'outputSettings' ? 'quotation:outputSettings'
        : field === 'template' ? 'quotation:templateId' : null
    if (documentTarget) {
      expect(wrapper.get(`[data-history-target="${documentTarget}"]`).classes()).toContain('quotation-history-target-highlight')
    }
    await wrapper.get('[data-testid="workflow-analysis"]').trigger('click')
    await flushPromises()
    await triggerQuotationShortcut('y')
    expect(wrapper.get('[role="tab"][aria-selected="true"]').attributes('id')).toBe(`workflow-tab-${expectedStep}`)
    wrapper.unmount()
  })

  it('opens the items stage when an item is selected from analysis', async () => {
    const wrapper = mountQuotationEditor(document.body)
    await flushPromises()
    const itemId = wrapper.getComponent(LineItemsTable).props('items')[0]!.id
    await wrapper.get('[data-testid="workflow-analysis"]').trigger('click')
    await flushPromises()
    wrapper.getComponent({ name: 'QuotationAnalysisView' }).vm.$emit('selectItem', { itemId })
    await flushPromises()
    expect(wrapper.get('[role="tab"][aria-selected="true"]').attributes('id')).toBe('workflow-tab-items')
    expect(wrapper.getComponent(LineItemsTable).props('focusedItemId')).toBe(itemId)
    expect(wrapper.get('#workflow-panel-items').isVisible()).toBe(true)
    wrapper.unmount()
  })

  it('forwards repeated item-reveal requests from the table to the workspace', async () => {
    const wrapper = mountQuotationEditor(document.body)
    await flushPromises()
    const table = wrapper.getComponent(LineItemsTable)
    const itemId = table.props('items')[0]!.id
    const previousRequest = table.props('focusedItemRequestKey') ?? 0

    table.vm.$emit('requestFocusItem', itemId)
    await flushPromises()
    expect(table.props('focusedItemId')).toBe(itemId)
    expect(table.props('focusedItemRequestKey')).toBe(previousRequest + 1)
    expect(wrapper.get('[role="tab"][aria-selected="true"]').attributes('id')).toBe('workflow-tab-items')

    table.vm.$emit('requestFocusItem', itemId)
    await flushPromises()
    expect(table.props('focusedItemRequestKey')).toBe(previousRequest + 2)
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
      const reportLabel = messages['en-US'].quotations.csv.report.openWithCount.replace('{count}', String(bar.props('importReportIssueCount')))
      expect(bar.get(`button[aria-label="${reportLabel}"]`).attributes('disabled')).toBeDefined()
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
        QuoteInfoPanel: false,
        QuoteCustomerPanel: true,
        ExchangeRatePanel: true,
        QuotationSupportPanels: true,
        QuotationNavigator: true,
        FloatingPreviewWindow: true,
        QuotationReviewWorkspace: {
          template: '<div class="review-workspace-stub"><slot /></div>',
        },
        QuotationSummarySettings: true,
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

async function triggerQuotationShortcut(key: string) {
  const listener = vi.mocked(window.addEventListener).mock.calls.find(([event]) => event === 'keydown')?.[1]
  if (typeof listener !== 'function') throw new Error('Quotation keyboard shortcuts were not registered')
  listener.call(window, new KeyboardEvent('keydown', { key, ctrlKey: true, cancelable: true }))
  await flushPromises()
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
