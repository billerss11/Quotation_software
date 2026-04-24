import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const electron = require('electron') as typeof import('electron')
const { contextBridge, ipcRenderer } = electron

const appApi = {
  getVersion: () => ipcRenderer.invoke('app:get-version') as Promise<string>,
  saveQuotationFile: (options: SaveQuotationFileOptions) =>
    ipcRenderer.invoke('quotation:save-file', options) as Promise<SaveQuotationFileResult>,
  openQuotationFile: () => ipcRenderer.invoke('quotation:open-file') as Promise<OpenQuotationFileResult>,
}

contextBridge.exposeInMainWorld('quotationApp', appApi)

export type QuotationAppApi = typeof appApi

export interface SaveQuotationFileOptions {
  filePath?: string
  defaultPath?: string
  content: string
}

export type SaveQuotationFileResult =
  | {
      canceled: true
    }
  | {
      canceled: false
      filePath: string
    }

export type OpenQuotationFileResult =
  | {
      canceled: true
    }
  | {
      canceled: false
      filePath: string
      content: string
    }
