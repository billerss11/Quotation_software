import type { QuotationRuntime } from '@/shared/runtime/quotationRuntime'

import type { useGoodsReceiptExport } from '@/features/goods-receipts/composables/useGoodsReceiptExport'
import type { useQuotationEditor } from './useQuotationEditor'
import type { useQuotationFileActions } from './useQuotationFileActions'
import { useQuotationAgentApi } from './useQuotationAgentApi'
import { useQuotationAgentApiV2 } from './useQuotationAgentApiV2'

type TranslateFn = (key: string, params?: Record<string, string | number>) => string

interface UseQuotationAutomationApisOptions {
  editor: ReturnType<typeof useQuotationEditor>
  fileActions: ReturnType<typeof useQuotationFileActions>
  goodsReceiptExport: ReturnType<typeof useGoodsReceiptExport>
  runtime: QuotationRuntime
  t: TranslateFn
}

export function useQuotationAutomationApis(options: UseQuotationAutomationApisOptions) {
  const { editor, fileActions, goodsReceiptExport } = options
  const legacyApi = useQuotationAgentApi({
    quotation: editor.quotation,
    itemSummaries: editor.itemSummaries,
    totals: editor.totals,
    currentFilePath: fileActions.currentFilePath,
    statusMessage: fileActions.statusMessage,
    saveCurrentQuotation: editor.saveCurrentQuotation,
    importQuotationFile: fileActions.importJsonFromPath,
    importQuotationContent: fileActions.importJsonContent,
    importLineItemsCsvFile: fileActions.importCsvFromPath,
    importLineItemsCsvContent: fileActions.importCsvContent,
    importLineItemsXlsxFile: fileActions.importXlsxFromPath,
    importLineItemsXlsxContent: fileActions.importXlsxContent,
    setLogoDataUrl: editor.setLogoDataUrl,
    exportPdfToFile: fileActions.exportQuotationPdfToFile,
    exportGoodsReceiptPdfToFile: goodsReceiptExport.exportPendingGoodsReceiptPdfToFile,
    setTaxMode: editor.setTaxMode,
    setQuotationCurrency: editor.setQuotationCurrency,
    updateExchangeRates: editor.updateExchangeRates,
    setOutputItemDetailLevel: editor.setOutputItemDetailLevel,
    setMixedTaxDocumentColumns: editor.setMixedTaxDocumentColumns,
    t: options.t,
  })

  const apiV2 = useQuotationAgentApiV2({
    quotation: editor.quotation,
    itemSummaries: editor.itemSummaries,
    totals: editor.totals,
    currentFilePath: fileActions.currentFilePath,
    runtime: options.runtime,
    importQuotationFile: fileActions.importJsonFromPathForAutomation,
    importQuotationContent: fileActions.importJsonContentForAutomation,
    importLineItemsCsvFile: fileActions.importCsvFromPathForAutomation,
    importLineItemsCsvContent: fileActions.importCsvContentForAutomation,
    importLineItemsXlsxFile: fileActions.importXlsxFromPathForAutomation,
    importLineItemsXlsxContent: fileActions.importXlsxContentForAutomation,
    saveQuotationToFile: fileActions.saveQuotationToPath,
    exportPdfToFile: fileActions.exportQuotationPdfToFileForAutomation,
    exportGoodsReceiptPdfToFile: goodsReceiptExport.exportPendingGoodsReceiptPdfToFileForAutomation,
    createNewQuotation: editor.createNewQuotation,
    updateHeaderFields: editor.updateHeaderFields,
    setTemplateId: editor.setTemplateId,
    setBranding: editor.setBranding,
    setOutputSettings: editor.setOutputSettings,
    customerRecords: editor.customerRecords,
    companyProfileRecords: editor.companyProfileRecords,
    applyCustomerRecord: editor.applyCustomerRecord,
    applyCompanyProfile: editor.applyCompanyProfile,
    commitMutationHistory: editor.commitQuotationChangeHistory,
    insertLineItem: editor.insertLineItem,
    insertSectionHeader: editor.insertSectionHeader,
    updateItemFields: editor.updateItemFields,
    setItemPricingMethod: editor.setItemPricingMethod,
    updateSectionHeaderTitle: editor.updateSectionHeaderTitle,
    removeItem: editor.removeItem,
    duplicateItem: editor.duplicateItem,
    moveQuotationTreeRow: editor.moveQuotationTreeRow,
    setGlobalMarkupRate: (rate) => editor.updateTotalsField('globalMarkupRate', rate),
    updateExchangeRate: editor.updateExchangeRate,
    addExchangeRate: editor.addExchangeRate,
    removeExchangeRate: editor.removeExchangeRate,
    setQuotationCurrency: editor.setQuotationCurrency,
    updateExchangeRates: editor.updateExchangeRates,
    setTaxMode: editor.setTaxMode,
    setMixedTaxDocumentColumns: editor.setMixedTaxDocumentColumns,
    addTaxClass: editor.addTaxClass,
    updateTaxClassField: (id, field, value) => field === 'label'
      ? editor.updateTaxClassField(id, field, String(value))
      : editor.updateTaxClassField(id, field, Number(value)),
    removeTaxClass: editor.removeTaxClass,
    setDefaultTaxClass: (id) => editor.updateTotalsField('defaultTaxClassId', id),
    addExtraCharge: editor.addExtraCharge,
    updateExtraChargeField: (id, field, value) => field === 'label'
      ? editor.updateExtraChargeField(id, field, String(value))
      : editor.updateExtraChargeField(id, field, Number(value)),
    removeExtraCharge: editor.removeExtraCharge,
    applyItemGoalSeek: editor.applyItemGoalSeek,
    applyQuotationGoalSeek: editor.applyQuotationGoalSeek,
    replaceQuotationDraft: editor.replaceQuotationDraft,
  })

  return {
    legacyApi,
    apiV2,
  }
}
