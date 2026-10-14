import vue from '@vitejs/plugin-vue'
import { playwright } from '@vitest/browser-playwright'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue()],
  optimizeDeps: {
    include: [
      '@primevue/themes/aura',
      'primevue/config',
      'primevue/dialog',
      'primevue/inputnumber',
      'primevue/inputtext',
      'primevue/menu',
      'primevue/select',
      'primevue/textarea',
      'primevue/tooltip',
      'vue-echarts',
      'echarts/core',
      'echarts/components',
      'echarts/charts',
      'echarts/renderers',
    ],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    include: ['src/**/*.browser.spec.ts'],
    browser: {
      enabled: true,
      headless: true,
      screenshotFailures: false,
      provider: playwright({
        launchOptions: {
          channel: 'chrome',
        },
      }),
      instances: [{ browser: 'chromium' }],
    },
  },
})
