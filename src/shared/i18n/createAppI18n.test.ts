import { describe, expect, it } from 'vitest'

import { createAppI18n } from './createAppI18n'

describe('app i18n', () => {
  it('starts in the requested locale and exposes translated labels', () => {
    const i18n = createAppI18n('zh-CN')

    expect(i18n.global.locale.value).toBe('zh-CN')
    expect(i18n.global.t('app.brandName')).toBe('\u62a5\u4ef7')
    expect(i18n.global.t('settings.uiLanguage')).toBe('\u754c\u9762\u8bed\u8a00')
    expect(i18n.global.t('quotations.document.table.taxRateShort')).toBe('\u7a0e\u7387')
    expect(i18n.global.t('quotations.document.table.taxAmountShort')).toBe('\u7a0e\u989d')
  })
})
