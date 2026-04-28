import { createI18n } from 'vue-i18n'

import { DEFAULT_LOCALE, type SupportedLocale } from './locale'
import { messages } from './messages'

export function createAppI18n(locale: SupportedLocale) {
  return createI18n({
    legacy: false,
    globalInjection: true,
    locale,
    fallbackLocale: DEFAULT_LOCALE,
    messages,
  })
}
