import Aura from '@primevue/themes/aura'
import PrimeVue from 'primevue/config'
import ConfirmationService from 'primevue/confirmationservice'
import Tooltip from 'primevue/tooltip'
import ToastService from 'primevue/toastservice'
import { createApp } from 'vue'

import App from './App.vue'
import './assets/main.css'
import 'primeicons/primeicons.css'
import { createAppI18n } from './shared/i18n/createAppI18n'
import { resolveInitialLocale } from './shared/i18n/locale'
import { loadStoredAppSettings } from './shared/services/localAppSettingsStorage'

const savedAppSettings = loadStoredAppSettings()
const initialUiLocale = resolveInitialLocale(savedAppSettings?.uiLocale, window.navigator.language)
const app = createApp(App, {
  initialUiLocale,
})
const i18n = createAppI18n(initialUiLocale)

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

app.mount('#app')
