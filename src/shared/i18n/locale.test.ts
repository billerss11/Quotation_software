import { describe, expect, it } from 'vitest'

import { DEFAULT_LOCALE, normalizeSupportedLocale, resolveInitialLocale } from './locale'

describe('locale helpers', () => {
  it('normalizes supported locale inputs into app locales', () => {
    expect(normalizeSupportedLocale('en')).toBe('en-US')
    expect(normalizeSupportedLocale('en-GB')).toBe('en-US')
    expect(normalizeSupportedLocale('zh')).toBe('zh-CN')
    expect(normalizeSupportedLocale('zh-SG')).toBe('zh-CN')
    expect(normalizeSupportedLocale('fr-FR')).toBeNull()
  })

  it('prefers a saved locale over the system locale', () => {
    expect(resolveInitialLocale('zh-CN', 'en-US')).toBe('zh-CN')
  })

  it('falls back to the normalized system locale and then English', () => {
    expect(resolveInitialLocale(undefined, 'zh-TW')).toBe('zh-CN')
    expect(resolveInitialLocale(undefined, 'fr-FR')).toBe(DEFAULT_LOCALE)
  })
})
