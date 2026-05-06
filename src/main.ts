import Aura from '@primevue/themes/aura'
import PrimeVue from 'primevue/config'
import ConfirmationService from 'primevue/confirmationservice'
import Tooltip from 'primevue/tooltip'
import ToastService from 'primevue/toastservice'
import { createApp, type App as VueApp } from 'vue'

import App from './App.vue'
import './assets/main.css'
import 'primeicons/primeicons.css'
import QuotationPrintDocumentView from './features/quotations/components/QuotationPrintDocumentView.vue'
import { createAppI18n } from './shared/i18n/createAppI18n'
import { resolveInitialLocale } from './shared/i18n/locale'
import { loadStoredAppSettings } from './shared/services/localAppSettingsStorage'
import { resolveAppRenderMode } from './shared/utils/appRenderMode'

const savedAppSettings = loadStoredAppSettings()
const initialUiLocale = resolveInitialLocale(savedAppSettings?.uiLocale, window.navigator.language)
const i18n = createAppI18n(initialUiLocale)
const renderMode = resolveAppRenderMode(window.location.href)

if (renderMode.kind === 'quotation-print') {
  const app = createApp(QuotationPrintDocumentView, {
    jobId: renderMode.jobId,
  })

  installCommonPlugins(app)
  app.mount('#app')
} else {
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
