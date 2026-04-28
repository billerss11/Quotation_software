import { describe, expect, it } from 'vitest'

import { createAppI18n } from './createAppI18n'

describe('app i18n', () => {
  it('starts in the requested locale and exposes translated labels', () => {
    const i18n = createAppI18n('zh-CN')

    expect(i18n.global.locale.value).toBe('zh-CN')
    expect(i18n.global.t('app.brandName')).toBe('报价')
    expect(i18n.global.t('settings.uiLanguage')).toBe('界面语言')
  })
})
