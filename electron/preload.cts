import { contextBridge, ipcRenderer } from 'electron'

import type { QuotationAppApi } from '../src/shared/contracts/quotationApp.js'

const quotationApp = {
  getVersion: () => ipcRenderer.invoke('app:get-version'),
  saveQuotationFile: (options) => ipcRenderer.invoke('quotation:save-file', options),
  openQuotationFile: () => ipcRenderer.invoke('quotation:open-file'),
  openQuotationFileFromPath: (filePath) => ipcRenderer.invoke('quotation:open-file-path', filePath),
  openDevAutoImportQuotationFile: () => ipcRenderer.invoke('quotation:open-dev-auto-import-file'),
  openLineItemsCsvFile: () => ipcRenderer.invoke('line-items:open-csv-file'),
  openLineItemsCsvFileFromPath: (filePath) => ipcRenderer.invoke('line-items:open-csv-file-path', filePath),
  openLineItemsXlsxFile: () => ipcRenderer.invoke('line-items:open-xlsx-file'),
  openLineItemsXlsxFileFromPath: (filePath) => ipcRenderer.invoke('line-items:open-xlsx-file-path', filePath),
  saveLineItemsCsvFile: (options) => ipcRenderer.invoke('line-items:save-csv-file', options),
  saveLineItemsCsvTemplateFile: (options) => ipcRenderer.invoke('line-items:save-csv-template-file', options),
  saveLineItemsExcelTemplateFile: () => ipcRenderer.invoke('line-items:save-excel-template-file'),
  saveLibraryFile: (options) => ipcRenderer.invoke('library:save-file', options),
  openLibraryFile: () => ipcRenderer.invoke('library:open-file'),
  exportQuotationPdf: (options) => ipcRenderer.invoke('quotation:export-pdf', options),
  exportGoodsReceiptPdf: (options) => ipcRenderer.invoke('goods-receipt:export-pdf', options),
  getQuotationPdfPayload: (jobId) => ipcRenderer.invoke('quotation:get-pdf-payload', jobId),
  notifyQuotationPdfReady: (jobId) => ipcRenderer.invoke('quotation:pdf-render-ready', jobId),
  getGoodsReceiptPdfPayload: (jobId) => ipcRenderer.invoke('goods-receipt:get-pdf-payload', jobId),
  notifyGoodsReceiptPdfReady: (jobId) => ipcRenderer.invoke('goods-receipt:pdf-render-ready', jobId),
} satisfies QuotationAppApi

contextBridge.exposeInMainWorld('quotationApp', quotationApp)
