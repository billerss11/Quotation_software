import type { ComputedRef, InjectionKey } from 'vue'

export type AppThemeId = 'ledger-teal' | 'modern-blue' | 'warm-sand'

export interface AppThemeDefinition {
  id: AppThemeId
  messageKey: 'ledgerTeal' | 'modernBlue' | 'warmSand'
  chartColors: readonly string[]
}

export const DEFAULT_APP_THEME_ID: AppThemeId = 'ledger-teal'

export const APP_THEME_DEFINITIONS: readonly AppThemeDefinition[] = [
  {
    id: 'ledger-teal',
    messageKey: 'ledgerTeal',
    chartColors: ['#0f766e', '#2563eb', '#d97706', '#7c3aed', '#64748b'],
  },
  {
    id: 'modern-blue',
    messageKey: 'modernBlue',
    chartColors: ['#2563eb', '#0891b2', '#d97706', '#7c3aed', '#64748b'],
  },
  {
    id: 'warm-sand',
    messageKey: 'warmSand',
    chartColors: ['#b45309', '#0f766e', '#4f46e5', '#be123c', '#78716c'],
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
