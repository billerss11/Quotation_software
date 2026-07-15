// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'

import { createAppI18n } from '@/shared/i18n/createAppI18n'

import QuotationEditor from './QuotationEditor.vue'

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
})

function mountQuotationEditor() {
  return mount(QuotationEditor, {
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
