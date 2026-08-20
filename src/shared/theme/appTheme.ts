import type { ComputedRef, InjectionKey } from 'vue'

export type AppThemeId = 'ledger-teal' | 'modern-blue' | 'warm-sand' | 'graphite-night'

export interface AppThemeDefinition {
  id: AppThemeId
  messageKey: 'ledgerTeal' | 'modernBlue' | 'warmSand' | 'graphiteNight'
  chartColors: readonly string[]
  chartTextColor: string
  chartGridColor: string
  chartSurfaceColor: string
}

export const DEFAULT_APP_THEME_ID: AppThemeId = 'ledger-teal'

export const APP_THEME_DEFINITIONS: readonly AppThemeDefinition[] = [
  {
    id: 'ledger-teal',
    messageKey: 'ledgerTeal',
    chartColors: ['#16806f', '#2e6f95', '#d17a22', '#8064a2', '#667a73'],
    chartTextColor: '#43534e',
    chartGridColor: '#d8e3de',
    chartSurfaceColor: '#fdfefc',
  },
  {
    id: 'modern-blue',
    messageKey: 'modernBlue',
    chartColors: ['#4056b8', '#2b7f9e', '#c97832', '#8266c1', '#69788c'],
    chartTextColor: '#405067',
    chartGridColor: '#d6dfea',
    chartSurfaceColor: '#ffffff',
  },
  {
    id: 'warm-sand',
    messageKey: 'warmSand',
    chartColors: ['#b34c32', '#447b70', '#5c66b0', '#c08b2c', '#87746b'],
    chartTextColor: '#65534b',
    chartGridColor: '#e5d5c5',
    chartSurfaceColor: '#fffdf9',
  },
  {
    id: 'graphite-night',
    messageKey: 'graphiteNight',
    chartColors: ['#b8a0ff', '#4fd1c5', '#f1a76a', '#7fafff', '#a8b5c2'],
    chartTextColor: '#cbd5dd',
    chartGridColor: '#3a4651',
    chartSurfaceColor: '#1e2329',
  },
]

export const APP_THEME_ID_KEY: InjectionKey<ComputedRef<AppThemeId>> = Symbol('app-theme-id')

export function normalizeAppThemeId(value: unknown): AppThemeId {
  return APP_THEME_DEFINITIONS.some((theme) => theme.id === value)
    ? value as AppThemeId
    : DEFAULT_APP_THEME_ID
}

export function getAppThemeDefinition(themeId: AppThemeId): AppThemeDefinition {
  return APP_THEME_DEFINITIONS.find((theme) => theme.id === themeId)
    ?? APP_THEME_DEFINITIONS[0]!
}

export function applyAppTheme(themeId: AppThemeId, root?: HTMLElement) {
  const target = root ?? (typeof document === 'undefined' ? undefined : document.documentElement)

  if (target) {
    target.dataset.uiTheme = themeId
  }
}
