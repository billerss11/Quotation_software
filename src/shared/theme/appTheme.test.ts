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
    expect(getAppThemeDefinition('ledger-teal').chartColors[0]).toBe('#0f766e')
    expect(getAppThemeDefinition('modern-blue').chartColors[0]).toBe('#2563eb')
    expect(getAppThemeDefinition('warm-sand').chartColors).toEqual([
      '#b45309',
      '#0f766e',
      '#4f46e5',
      '#be123c',
      '#78716c',
    ])
    expect(getAppThemeDefinition('graphite-night')).toMatchObject({
      chartColors: ['#38bdf8', '#22d3ee', '#f59e0b', '#a78bfa', '#94a3b8'],
      chartTextColor: '#cbd5e1',
      chartGridColor: '#334155',
      chartSurfaceColor: '#111827',
    })
  })
})
