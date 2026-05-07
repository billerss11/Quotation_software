import { DEFAULT_LOCALE, type SupportedLocale } from './locale.js'

interface LocaleDefaults {
  companyName: string
  validityPeriod: string
  itemName: string
  childItemName: string
  siblingItemName: string
  sectionHeaderName: string
  duplicateSuffix: string
}

const localeDefaults: Record<SupportedLocale, LocaleDefaults> = {
  'en-US': {
    companyName: 'Your Company',
    validityPeriod: '30 days',
    itemName: 'New item',
    childItemName: 'New child item',
    siblingItemName: 'New sibling item',
    sectionHeaderName: 'New section',
    duplicateSuffix: 'copy',
  },
  'zh-CN': {
    companyName: '\u8d35\u516c\u53f8',
    validityPeriod: '30\u5929',
    itemName: '\u65b0\u9879\u76ee',
    childItemName: '\u65b0\u5b50\u9879',
    siblingItemName: '\u65b0\u540c\u7ea7\u9879',
    sectionHeaderName: '\u65b0\u5206\u7ec4',
    duplicateSuffix: '\u526f\u672c',
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

export function getDefaultQuotationSectionHeaderName(locale: SupportedLocale = DEFAULT_LOCALE) {
  return getLocaleDefaults(locale).sectionHeaderName
}

export function getDuplicateItemName(name: string, locale: SupportedLocale = DEFAULT_LOCALE) {
  return `${name} ${getLocaleDefaults(locale).duplicateSuffix}`.trim()
}
