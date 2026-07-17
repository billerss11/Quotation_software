import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig(({ mode }) => {
  const isWebBuild = mode === 'web'

  return {
    base: isWebBuild ? './' : '/',
    assetsInclude: ['**/*.xlsx'],
    plugins: [vue()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
    },
    build: {
      outDir: isWebBuild ? 'dist-web' : 'dist',
    },
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts', 'electron/**/*.test.ts'],
    },
  }
})
