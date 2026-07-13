import Aura from '@primevue/themes/aura'
import PrimeVue from 'primevue/config'
import ConfirmationService from 'primevue/confirmationservice'
import Tooltip from 'primevue/tooltip'
import ToastService from 'primevue/toastservice'
import { createApp, type App as VueApp } from 'vue'

import App from './App.vue'
import './assets/main.css'
import 'primeicons/primeicons.css'
import { createAppI18n } from './shared/i18n/createAppI18n'
import { resolveInitialLocale } from './shared/i18n/locale'
import { loadStoredAppSettings } from './shared/services/localAppSettingsStorage'
import { resolveAppRenderMode } from './shared/utils/appRenderMode'

const savedAppSettings = loadStoredAppSettings()
const initialUiLocale = resolveInitialLocale(savedAppSettings?.uiLocale, window.navigator.language)
const i18n = createAppI18n(initialUiLocale)
const renderMode = resolveAppRenderMode(window.location.href)

void mountApp()

async function mountApp() {
  if (renderMode.kind === 'quotation-print') {
    const { default: QuotationPrintDocumentView } = await import('./features/quotations/components/QuotationPrintDocumentView.vue')

    const app = createApp(QuotationPrintDocumentView, {
      jobId: renderMode.jobId,
    })

    installCommonPlugins(app)
    app.mount('#app')
    return
  }

  if (renderMode.kind === 'goods-receipt-print') {
    const { default: GoodsReceiptPrintDocumentView } = await import('./features/goods-receipts/components/GoodsReceiptPrintDocumentView.vue')

    const app = createApp(GoodsReceiptPrintDocumentView, {
      jobId: renderMode.jobId,
    })

    installCommonPlugins(app)
    app.mount('#app')
    return
  }

  const app = createApp(App, {
    initialUiLocale,
  })

  installCommonPlugins(app)
  app.mount('#app')
}

function installCommonPlugins(app: VueApp) {
  app.use(PrimeVue, {
    theme: {
      preset: Aura,
      options: {
        darkModeSelector: false,
      },
    },
  })
  app.use(i18n)
  app.use(ConfirmationService)
  app.use(ToastService)
  app.directive('tooltip', Tooltip)
}
