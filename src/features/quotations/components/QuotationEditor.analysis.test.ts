// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'

import { createAppI18n } from '@/shared/i18n/createAppI18n'

import QuotationEditor from './QuotationEditor.vue'
import QuotationCommandBar from './QuotationCommandBar.vue'
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
})

function mountQuotationEditor(attachTo?: HTMLElement) {
  return mount(QuotationEditor, {
    attachTo,
    props: {
      uiLocale: 'en-US',
    },
    global: {
      plugins: [PrimeVue, ToastService, createAppI18n('en-US')],
      directives: {
        tooltip: {},
      },
      stubs: {
        QuotationCommandBar: {
          template: '<button data-testid="open-analysis" @click="$emit(\'openAnalysis\')">analysis</button>',
        },
        QuotationAnalysisView: {
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
