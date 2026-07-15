import { describe, expect, it } from 'vitest'

import { createAppI18n } from './createAppI18n'

describe('app i18n', () => {
  it('starts in the requested locale and exposes translated labels', () => {
    const i18n = createAppI18n('zh-CN')
    const englishI18n = createAppI18n('en-US')

    expect(i18n.global.locale.value).toBe('zh-CN')
    expect(i18n.global.t('app.brandName')).toBe('\u62a5\u4ef7')
    expect(i18n.global.t('settings.uiLanguage')).toBe('\u754c\u9762\u8bed\u8a00')
    expect(i18n.global.t('settings.themes.ledgerTeal.name')).toBe('\u8d26\u672c\u9752\u7eff')
    expect(i18n.global.t('settings.themes.modernBlue.name')).toBe('\u73b0\u4ee3\u84dd')
    expect(i18n.global.t('settings.themes.warmSand.name')).toBe('\u6696\u7802\u5546\u52a1')
    expect(i18n.global.t('settings.themes.warmSand.description')).toBe(
      '\u6e29\u6696\u7684\u8c61\u7259\u767d\u754c\u9762\u3001\u6df1\u5496\u4fa7\u680f\u548c\u514b\u5236\u7684\u7425\u73c0\u8272\u5f3a\u8c03\u3002',
    )
    expect(englishI18n.global.t('settings.themes.warmSand.name')).toBe('Warm Sand')
    expect(englishI18n.global.t('settings.themes.warmSand.description')).toBe(
      'Warm ivory surfaces, a deep espresso sidebar, and restrained amber accents.',
    )
    expect(i18n.global.t('quotations.document.table.taxRateShort')).toBe('\u7a0e\u7387')
    expect(i18n.global.t('quotations.document.table.taxAmountShort')).toBe('\u7a0e\u989d')
    expect(i18n.global.t('quotations.document.table.amountBeforeTaxShort')).toBe('\u7a0e\u524d\u91d1\u989d')
  })
})
