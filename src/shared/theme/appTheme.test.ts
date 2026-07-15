// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'

import {
  applyAppTheme,
  DEFAULT_APP_THEME_ID,
  getAppThemeDefinition,
  normalizeAppThemeId,
} from './appTheme'

describe('app theme', () => {
  it('normalizes unknown values to the default theme', () => {
    expect(normalizeAppThemeId('modern-blue')).toBe('modern-blue')
    expect(normalizeAppThemeId('unknown')).toBe(DEFAULT_APP_THEME_ID)
  })

  it('applies the selected theme to the root element', () => {
    applyAppTheme('modern-blue')

    expect(document.documentElement.dataset.uiTheme).toBe('modern-blue')
  })

  it('provides a separate chart palette for each theme', () => {
    expect(getAppThemeDefinition('ledger-teal').chartColors[0]).toBe('#0f766e')
    expect(getAppThemeDefinition('modern-blue').chartColors[0]).toBe('#2563eb')
  })
})
