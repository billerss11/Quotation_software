// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'

import { createAppI18n } from '@/shared/i18n/createAppI18n'

import QuotationEditor from './QuotationEditor.vue'

describe('QuotationEditor analysis layout', () => {
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
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the analysis view inside a dedicated scroll surface', async () => {
    const wrapper = mount(QuotationEditor, {
      props: {
        uiLocale: 'en-US',
        companyProfile: {
          companyName: 'ACME',
          email: '',
          phone: '',
        },
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

    await wrapper.get('[data-testid="open-analysis"]').trigger('click')

    expect(wrapper.find('.analysis-surface').exists()).toBe(true)
    expect(wrapper.find('.analysis-view-stub').exists()).toBe(true)
  })
})

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
