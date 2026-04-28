import { DEFAULT_LOCALE, type SupportedLocale } from './locale'

interface LocaleDefaults {
  companyName: string
  validityPeriod: string
  itemName: string
  childItemName: string
  siblingItemName: string
  duplicateSuffix: string
}

const localeDefaults: Record<SupportedLocale, LocaleDefaults> = {
  'en-US': {
    companyName: 'Your Company',
    validityPeriod: '30 days',
    itemName: 'New item',
    childItemName: 'New child item',
    siblingItemName: 'New sibling item',
    duplicateSuffix: 'copy',
  },
  'zh-CN': {
    companyName: '贵公司',
    validityPeriod: '30天',
    itemName: '新项目',
    childItemName: '新子项',
    siblingItemName: '新同级项',
    duplicateSuffix: '副本',
  },
}

export function getLocaleDefaults(locale: SupportedLocale = DEFAULT_LOCALE) {
  return localeDefaults[locale] ?? localeDefaults[DEFAULT_LOCALE]
}

export function getDefaultCompanyName(locale: SupportedLocale = DEFAULT_LOCALE) {
  return getLocaleDefaults(locale).companyName
}

export function getDefaultQuotationValidityPeriod(locale: SupportedLocale = DEFAULT_LOCALE) {
  return getLocaleDefaults(locale).validityPeriod
}

export function getDefaultQuotationItemName(locale: SupportedLocale = DEFAULT_LOCALE) {
  return getLocaleDefaults(locale).itemName
}

export function getDefaultQuotationChildItemName(locale: SupportedLocale = DEFAULT_LOCALE) {
  return getLocaleDefaults(locale).childItemName
}

export function getDefaultQuotationSiblingItemName(locale: SupportedLocale = DEFAULT_LOCALE) {
  return getLocaleDefaults(locale).siblingItemName
}

export function getDuplicateItemName(name: string, locale: SupportedLocale = DEFAULT_LOCALE) {
  return `${name} ${getLocaleDefaults(locale).duplicateSuffix}`.trim()
}
