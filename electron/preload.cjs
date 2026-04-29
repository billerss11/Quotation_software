const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('quotationApp', {
  getVersion: () => ipcRenderer.invoke('app:get-version'),
  saveQuotationFile: (options) => ipcRenderer.invoke('quotation:save-file', options),
  openQuotationFile: () => ipcRenderer.invoke('quotation:open-file'),
  openLineItemsCsvFile: () => ipcRenderer.invoke('line-items:open-csv-file'),
  saveLineItemsCsvFile: (options) => ipcRenderer.invoke('line-items:save-csv-file', options),
  saveLineItemsCsvTemplateFile: (options) => ipcRenderer.invoke('line-items:save-csv-template-file', options),
  saveCustomerLibraryFile: (options) => ipcRenderer.invoke('customer-library:save-file', options),
  openCustomerLibraryFile: () => ipcRenderer.invoke('customer-library:open-file'),
  exportQuotationPdf: (options) => ipcRenderer.invoke('quotation:export-pdf', options),
  getQuotationPdfPayload: (jobId) => ipcRenderer.invoke('quotation:get-pdf-payload', jobId),
  notifyQuotationPdfReady: (jobId) => ipcRenderer.invoke('quotation:pdf-render-ready', jobId),
})
