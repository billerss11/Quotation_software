import { createI18n } from 'vue-i18n'

import { DEFAULT_LOCALE, type SupportedLocale } from './locale'
import { messages } from './messages'

export function createAppI18n(locale: SupportedLocale) {
  const i18n = createI18n({
    legacy: false,
    globalInjection: true,
    locale,
    fallbackLocale: DEFAULT_LOCALE,
    messages,
  })

  if (import.meta.hot) {
    import.meta.hot.accept('./messages', (module) => {
      const nextMessages = (module as { messages: typeof messages } | undefined)?.messages

      if (!nextMessages) {
        return
      }

      i18n.global.setLocaleMessage('en-US', nextMessages['en-US'])
      i18n.global.setLocaleMessage('zh-CN', nextMessages['zh-CN'])
    })
  }

  return i18n
}
