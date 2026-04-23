import electron from 'electron'

const { contextBridge, ipcRenderer } = electron

const appApi = {
  getVersion: () => ipcRenderer.invoke('app:get-version') as Promise<string>,
}

contextBridge.exposeInMainWorld('quotationApp', appApi)

export type QuotationAppApi = typeof appApi
