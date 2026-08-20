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
    expect(normalizeAppThemeId('warm-sand')).toBe('warm-sand')
    expect(normalizeAppThemeId('graphite-night')).toBe('graphite-night')
    expect(normalizeAppThemeId('unknown')).toBe(DEFAULT_APP_THEME_ID)
  })

  it('applies the selected theme to the root element', () => {
    applyAppTheme('graphite-night')

    expect(document.documentElement.dataset.uiTheme).toBe('graphite-night')
  })

  it('provides a separate chart palette for each theme', () => {
    expect(getAppThemeDefinition('ledger-teal').chartColors[0]).toBe('#16806f')
    expect(getAppThemeDefinition('modern-blue').chartColors[0]).toBe('#4056b8')
    expect(getAppThemeDefinition('warm-sand').chartColors).toEqual([
      '#b34c32',
      '#447b70',
      '#5c66b0',
      '#c08b2c',
      '#87746b',
    ])
    expect(getAppThemeDefinition('graphite-night')).toMatchObject({
      chartColors: ['#b8a0ff', '#4fd1c5', '#f1a76a', '#7fafff', '#a8b5c2'],
      chartTextColor: '#cbd5dd',
      chartGridColor: '#3a4651',
      chartSurfaceColor: '#1e2329',
    })
  })
})
