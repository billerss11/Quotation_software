import type {
  OpenLineItemsCsvFileResult,
  OpenQuotationFileResult,
  QuotationAppApi,
  QuotationPdfRenderPayload,
  SaveQuotationFileOptions,
} from '@/shared/contracts/quotationApp'
import { decodeTextBuffer } from '@/shared/utils/textEncoding'
import {
  createWebPrintJob,
  loadWebPrintJob,
  removeWebPrintJob,
} from '@/shared/services/webPrintJobStore'

export interface QuotationRuntimeCapabilities {
  isDesktop: boolean
  hasNativeFileDialogs: boolean
  supportsFileSystemAccess: boolean
  supportsDirectPdfExport: boolean
  supportsBrowserPrint: boolean
}

export type RuntimeSaveFileResult =
  | {
  canceled: true
    }
  | {
      canceled: false
      filePath: string
      mode: 'native' | 'file-system-access' | 'download' | 'browser-print'
    }

export interface QuotationRuntime {
  capabilities: QuotationRuntimeCapabilities
  saveQuotationFile(options: SaveQuotationFileOptions): Promise<RuntimeSaveFileResult>
  openQuotationFile(): Promise<OpenQuotationFileResult>
  openLineItemsCsvFile(): Promise<OpenLineItemsCsvFileResult>
  saveLineItemsCsvFile(options: SaveQuotationFileOptions): Promise<RuntimeSaveFileResult>
  saveLineItemsCsvTemplateFile(options: SaveQuotationFileOptions): Promise<RuntimeSaveFileResult>
  saveCustomerLibraryFile(options: SaveQuotationFileOptions): Promise<RuntimeSaveFileResult>
  openCustomerLibraryFile(): Promise<OpenQuotationFileResult>
  exportQuotationDocument(payload: QuotationPdfRenderPayload): Promise<RuntimeSaveFileResult>
  getQuotationPrintPayload(jobId: string): Promise<QuotationPdfRenderPayload>
  notifyQuotationPrintReady(jobId: string): Promise<void>
}

interface RuntimeContext {
  appTarget?: string
  bridge?: QuotationAppApi
  locationHref?: string
  windowObject?: Window
}

interface WindowWithFileSystemAccess extends Window {
  showOpenFilePicker?: (options?: unknown) => Promise<Array<FileSystemFileHandle>>
  showSaveFilePicker?: (options?: unknown) => Promise<FileSystemFileHandle>
}

export function getQuotationRuntime() {
  return createQuotationRuntime()
}

export function createQuotationRuntime(context: RuntimeContext = {}): QuotationRuntime {
  const windowObject = context.windowObject ?? (typeof window !== 'undefined' ? window : undefined)
  const bridge = context.bridge ?? windowObject?.quotationApp
  const appTarget = context.appTarget ?? import.meta.env.VITE_APP_TARGET ?? 'desktop'
  const locationHref = context.locationHref ?? windowObject?.location.href ?? 'http://localhost/'
  const isDesktop = appTarget !== 'web' && Boolean(bridge)

  if (isDesktop && bridge) {
    return createDesktopRuntime(bridge)
  }

  return createWebRuntime(windowObject, locationHref)
}

function createDesktopRuntime(bridge: QuotationAppApi): QuotationRuntime {
  return {
    capabilities: {
      isDesktop: true,
      hasNativeFileDialogs: true,
      supportsFileSystemAccess: false,
      supportsDirectPdfExport: true,
      supportsBrowserPrint: false,
    },
    async saveQuotationFile(options) {
      return mapBridgeSaveResult(await bridge.saveQuotationFile(options))
    },
    openQuotationFile() {
      return bridge.openQuotationFile()
    },
    openLineItemsCsvFile() {
      return bridge.openLineItemsCsvFile()
    },
    async saveLineItemsCsvFile(options) {
      return mapBridgeSaveResult(await bridge.saveLineItemsCsvFile(options))
    },
    async saveLineItemsCsvTemplateFile(options) {
      return mapBridgeSaveResult(await bridge.saveLineItemsCsvTemplateFile(options))
    },
    async saveCustomerLibraryFile(options) {
      return mapBridgeSaveResult(await bridge.saveCustomerLibraryFile(options))
    },
    openCustomerLibraryFile() {
      return bridge.openCustomerLibraryFile()
    },
    async exportQuotationDocument(payload) {
      return mapBridgeSaveResult(await bridge.exportQuotationPdf(payload))
    },
    getQuotationPrintPayload(jobId) {
      return bridge.getQuotationPdfPayload(jobId)
    },
    notifyQuotationPrintReady(jobId) {
      return bridge.notifyQuotationPdfReady(jobId)
    },
  }
}

function createWebRuntime(windowObject: Window | undefined, locationHref: string): QuotationRuntime {
  const windowWithFs = windowObject as WindowWithFileSystemAccess | undefined
  const supportsFileSystemAccess = Boolean(windowWithFs?.showOpenFilePicker && windowWithFs.showSaveFilePicker)
  let currentQuotationHandle: FileSystemFileHandle | null = null

  return {
    capabilities: {
      isDesktop: false,
      hasNativeFileDialogs: false,
      supportsFileSystemAccess,
      supportsDirectPdfExport: false,
      supportsBrowserPrint: true,
    },
    async saveQuotationFile(options) {
      if (supportsFileSystemAccess && windowWithFs?.showSaveFilePicker) {
        currentQuotationHandle = await getWritableFileHandle(windowWithFs, currentQuotationHandle, options)
        await writeFileHandle(currentQuotationHandle, options.content)
        return {
          canceled: false,
          filePath: currentQuotationHandle.name,
          mode: 'file-system-access',
        }
      }

      downloadFile(windowObject, options.defaultPath ?? 'quotation.json', options.content, 'application/json')
      return {
        canceled: false,
        filePath: options.defaultPath ?? 'quotation.json',
        mode: 'download',
      }
    },
    async openQuotationFile() {
      return openTextFile({
        windowObject,
        windowWithFs,
        supportsFileSystemAccess,
        accept: '.json,application/json',
        pickerTypes: [{
          description: 'Quotation JSON',
          accept: {
            'application/json': ['.json'],
          },
        }],
        onHandleSelected: (handle) => {
          currentQuotationHandle = handle
        },
      })
    },
    async openLineItemsCsvFile() {
      return openTextFile({
        windowObject,
        windowWithFs,
        supportsFileSystemAccess,
        accept: '.csv,text/csv',
        pickerTypes: [{
          description: 'CSV Files',
          accept: {
            'text/csv': ['.csv'],
          },
        }],
      })
    },
    async saveLineItemsCsvFile(options) {
      return saveBrowserTextFile({
        windowObject,
        windowWithFs,
        supportsFileSystemAccess,
        options,
        suggestedName: options.defaultPath ?? 'line-items.csv',
        mimeType: 'text/csv;charset=utf-8',
        pickerTypes: [{
          description: 'CSV Files',
          accept: {
            'text/csv': ['.csv'],
          },
        }],
      })
    },
    async saveLineItemsCsvTemplateFile(options) {
      return saveBrowserTextFile({
        windowObject,
        windowWithFs,
        supportsFileSystemAccess,
        options,
        suggestedName: options.defaultPath ?? 'quotation-line-items-template.csv',
        mimeType: 'text/csv;charset=utf-8',
        pickerTypes: [{
          description: 'CSV Files',
          accept: {
            'text/csv': ['.csv'],
          },
        }],
      })
    },
    async saveCustomerLibraryFile(options) {
      return saveBrowserTextFile({
        windowObject,
        windowWithFs,
        supportsFileSystemAccess,
        options,
        suggestedName: options.defaultPath ?? 'customer-library.json',
        mimeType: 'application/json',
        pickerTypes: [{
          description: 'Customer Library JSON',
          accept: {
            'application/json': ['.json'],
          },
        }],
      })
    },
    async openCustomerLibraryFile() {
      return openTextFile({
        windowObject,
        windowWithFs,
        supportsFileSystemAccess,
        accept: '.json,application/json',
        pickerTypes: [{
          description: 'Customer Library JSON',
          accept: {
            'application/json': ['.json'],
          },
        }],
      })
    },
    async exportQuotationDocument(payload) {
      const jobId = createWebPrintJob(payload)
      const printUrl = new URL(locationHref)
      printUrl.search = ''
      printUrl.searchParams.set('mode', 'quotation-print')
      printUrl.searchParams.set('jobId', jobId)

      windowObject?.open(printUrl.toString(), '_blank', 'noopener,noreferrer')

      return {
        canceled: false,
        filePath: payload.defaultFileName,
        mode: 'browser-print',
      }
    },
    async getQuotationPrintPayload(jobId) {
      const payload = loadWebPrintJob(jobId)

      if (!payload) {
        throw new Error(`Unknown quotation print job: ${jobId}`)
      }

      return payload
    },
    async notifyQuotationPrintReady(jobId) {
      if (!windowObject) {
        return
      }

      const handleAfterPrint = () => {
        removeWebPrintJob(jobId)
      }

      windowObject.addEventListener('afterprint', handleAfterPrint, { once: true })
      windowObject.print()
    },
  }
}

function mapBridgeSaveResult(result: Awaited<ReturnType<QuotationAppApi['saveQuotationFile']>>): RuntimeSaveFileResult {
  if (result.canceled) {
    return result
  }

  return {
    ...result,
    mode: 'native',
  }
}

async function saveBrowserTextFile(options: {
  windowObject?: Window
  windowWithFs?: WindowWithFileSystemAccess
  supportsFileSystemAccess: boolean
  options: SaveQuotationFileOptions
  suggestedName: string
  mimeType: string
  pickerTypes: Array<Record<string, unknown>>
}): Promise<RuntimeSaveFileResult> {
  if (options.supportsFileSystemAccess && options.windowWithFs?.showSaveFilePicker) {
    const handle = await options.windowWithFs.showSaveFilePicker({
      suggestedName: options.suggestedName,
      types: options.pickerTypes,
    })
    await writeFileHandle(handle, options.options.content)

    return {
      canceled: false,
      filePath: handle.name,
      mode: 'file-system-access',
    }
  }

  downloadFile(options.windowObject, options.suggestedName, options.options.content, options.mimeType)

  return {
    canceled: false,
    filePath: options.suggestedName,
    mode: 'download',
  }
}

async function getWritableFileHandle(
  windowObject: WindowWithFileSystemAccess,
  existingHandle: FileSystemFileHandle | null,
  options: SaveQuotationFileOptions,
) {
  if (existingHandle && options.filePath) {
    return existingHandle
  }

  return windowObject.showSaveFilePicker?.({
    suggestedName: options.defaultPath,
    types: [{
      description: 'Quotation JSON',
      accept: {
        'application/json': ['.json'],
      },
    }],
  }) ?? Promise.reject(new Error('File save picker is unavailable.'))
}

async function writeFileHandle(handle: FileSystemFileHandle, content: string) {
  const writable = await handle.createWritable()
  await writable.write(content)
  await writable.close()
}

async function openTextFile(options: {
  windowObject?: Window
  windowWithFs?: WindowWithFileSystemAccess
  supportsFileSystemAccess: boolean
  accept: string
  pickerTypes: Array<Record<string, unknown>>
  onHandleSelected?: (handle: FileSystemFileHandle) => void
}): Promise<OpenQuotationFileResult> {
  if (options.supportsFileSystemAccess && options.windowWithFs?.showOpenFilePicker) {
    const [handle] = await options.windowWithFs.showOpenFilePicker({
      excludeAcceptAllOption: false,
      multiple: false,
      types: options.pickerTypes,
    })

    if (!handle) {
      return { canceled: true }
    }

    options.onHandleSelected?.(handle)

    const file = await handle.getFile()
    return {
      canceled: false,
      filePath: file.name,
      content: decodeTextBuffer(await file.arrayBuffer()),
    }
  }

  const file = await promptForFile(options.windowObject, options.accept)

  if (!file) {
    return { canceled: true }
  }

  return {
    canceled: false,
    filePath: file.name,
    content: decodeTextBuffer(await file.arrayBuffer()),
  }
}

function promptForFile(windowObject: Window | undefined, accept: string) {
  return new Promise<File | null>((resolve) => {
    if (!windowObject) {
      resolve(null)
      return
    }

    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept

    const finish = (file: File | null) => {
      cleanup()
      resolve(file)
    }

    const handleChange = () => {
      finish(input.files?.[0] ?? null)
    }

    const handleFocus = () => {
      windowObject.setTimeout(() => {
        finish(input.files?.[0] ?? null)
      }, 0)
    }

    const cleanup = () => {
      input.removeEventListener('change', handleChange)
      windowObject.removeEventListener('focus', handleFocus)
    }

    input.addEventListener('change', handleChange)
    windowObject.addEventListener('focus', handleFocus, { once: true })
    input.click()
  })
}

function downloadFile(windowObject: Window | undefined, fileName: string, content: string, type: string) {
  if (!windowObject) {
    return
  }

  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
