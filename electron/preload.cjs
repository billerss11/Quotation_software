const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('quotationApp', {
  getVersion: () => ipcRenderer.invoke('app:get-version'),
  saveQuotationFile: (options) => ipcRenderer.invoke('quotation:save-file', options),
  openQuotationFile: () => ipcRenderer.invoke('quotation:open-file'),
  saveCustomerLibraryFile: (options) => ipcRenderer.invoke('customer-library:save-file', options),
  openCustomerLibraryFile: () => ipcRenderer.invoke('customer-library:open-file'),
})
