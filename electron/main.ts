import { randomUUID } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ExportQuotationPdfOptions, QuotationPdfRenderPayload } from './preload-api.js'

const require = createRequire(import.meta.url)
const electron = require('electron') as typeof import('electron')
const { app, BrowserWindow, dialog, ipcMain } = electron
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PDF_RENDER_READY_TIMEOUT_MS = 30_000

interface SaveQuotationFileOptions {
  filePath?: string
  defaultPath?: string
  content: string
}

interface PendingQuotationPdfJob {
  payload: QuotationPdfRenderPayload
  readyPromise: Promise<void>
  resolveReady: () => void
}

const pendingQuotationPdfJobs = new Map<string, PendingQuotationPdfJob>()

function createMainWindow() {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1180,
    minHeight: 760,
    title: 'Quotation Software',
    backgroundColor: '#f5f7fb',
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  void loadRendererWindow(mainWindow)

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  }
}

function createQuotationPdfWindow() {
  return new BrowserWindow({
    show: false,
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
}

function getPreloadPath() {
  const devServerUrl = process.env.VITE_DEV_SERVER_URL

  return devServerUrl
    ? path.join(__dirname, '../../electron/preload.cjs')
    : path.join(__dirname, 'preload.cjs')
}

async function loadRendererWindow(window: InstanceType<typeof BrowserWindow>, query: Record<string, string> = {}) {
  const devServerUrl = process.env.VITE_DEV_SERVER_URL

  if (devServerUrl) {
    const url = new URL(devServerUrl)

    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value)
    }

    await window.loadURL(url.toString())
    return
  }

  await window.loadFile(path.join(__dirname, '../../dist/index.html'), { query })
}

app.whenReady().then(() => {
  ipcMain.handle('app:get-version', () => app.getVersion())
  ipcMain.handle('quotation:save-file', (_event, options: SaveQuotationFileOptions) =>
    saveQuotationFile(options),
  )
  ipcMain.handle('line-items:save-csv-template-file', (_event, options: SaveQuotationFileOptions) =>
    saveLineItemsCsvTemplateFile(options),
  )
  ipcMain.handle('quotation:open-file', () =>
    openTextFile('Import quotation', [{ name: 'Quotation JSON', extensions: ['json'] }]),
  )
  ipcMain.handle('line-items:open-csv-file', () =>
    openTextFile('Import line items CSV', [{ name: 'CSV files', extensions: ['csv'] }]),
  )
  ipcMain.handle('customer-library:save-file', (_event, options: SaveQuotationFileOptions) =>
    saveCustomerLibraryFile(options),
  )
  ipcMain.handle('customer-library:open-file', () =>
    openTextFile('Import customer library', [{ name: 'Customer Library JSON', extensions: ['json'] }]),
  )
  ipcMain.handle('quotation:export-pdf', (_event, options: ExportQuotationPdfOptions) =>
    exportQuotationPdf(options),
  )
  ipcMain.handle('quotation:get-pdf-payload', (_event, jobId: string) => getQuotationPdfPayload(jobId))
  ipcMain.handle('quotation:pdf-render-ready', (_event, jobId: string) => markQuotationPdfReady(jobId))
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

async function exportQuotationPdf(options: ExportQuotationPdfOptions) {
  const result = await dialog.showSaveDialog({
    title: 'Export PDF',
    defaultPath: options.defaultFileName,
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
  })

  if (result.canceled || !result.filePath) {
    return { canceled: true as const }
  }

  const jobId = createPendingQuotationPdfJob(options)
  const pdfWindow = createQuotationPdfWindow()

  try {
    await loadRendererWindow(pdfWindow, {
      mode: 'quotation-pdf',
      jobId,
    })
    await waitForQuotationPdfReady(jobId)

    const pdfBuffer = await pdfWindow.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
    })

    await writeFile(result.filePath, pdfBuffer)

    return {
      canceled: false as const,
      filePath: result.filePath,
    }
  } finally {
    cleanupPendingQuotationPdfJob(jobId)

    if (!pdfWindow.isDestroyed()) {
      pdfWindow.destroy()
    }
  }
}

async function saveQuotationFile(options: SaveQuotationFileOptions) {
  let filePath = options.filePath

  if (!filePath) {
    const result = await dialog.showSaveDialog({
      title: 'Save quotation',
      defaultPath: options.defaultPath,
      filters: [{ name: 'Quotation JSON', extensions: ['json'] }],
    })

    if (result.canceled || !result.filePath) {
      return { canceled: true as const }
    }

    filePath = result.filePath
  }

  await writeFile(filePath, options.content, 'utf8')
  return { canceled: false as const, filePath }
}

async function saveLineItemsCsvTemplateFile(options: SaveQuotationFileOptions) {
  let filePath = options.filePath

  if (!filePath) {
    const result = await dialog.showSaveDialog({
      title: 'Export CSV template',
      defaultPath: options.defaultPath,
      filters: [{ name: 'CSV Files', extensions: ['csv'] }],
    })

    if (result.canceled || !result.filePath) {
      return { canceled: true as const }
    }

    filePath = result.filePath
  }

  await writeFile(filePath, options.content, 'utf8')
  return { canceled: false as const, filePath }
}

async function openTextFile(title: string, filters: Array<{ name: string; extensions: string[] }>) {
  const result = await dialog.showOpenDialog({
    title,
    properties: ['openFile'],
    filters,
  })

  const filePath = result.filePaths[0]

  if (result.canceled || !filePath) {
    return { canceled: true as const }
  }

  return {
    canceled: false as const,
    filePath,
    content: decodeFileBuffer(await readFile(filePath)),
  }
}

async function saveCustomerLibraryFile(options: SaveQuotationFileOptions) {
  let filePath = options.filePath

  if (!filePath) {
    const result = await dialog.showSaveDialog({
      title: 'Export customer library',
      defaultPath: options.defaultPath,
      filters: [{ name: 'Customer Library JSON', extensions: ['json'] }],
    })

    if (result.canceled || !result.filePath) {
      return { canceled: true as const }
    }

    filePath = result.filePath
  }

  await writeFile(filePath, options.content, 'utf8')
  return { canceled: false as const, filePath }
}

function createPendingQuotationPdfJob(payload: QuotationPdfRenderPayload) {
  const jobId = randomUUID()
  let resolveReady = () => {}

  const readyPromise = new Promise<void>((resolve) => {
    resolveReady = resolve
  })

  pendingQuotationPdfJobs.set(jobId, {
    payload,
    readyPromise,
    resolveReady,
  })

  return jobId
}

function getQuotationPdfPayload(jobId: string) {
  const pendingJob = pendingQuotationPdfJobs.get(jobId)

  if (!pendingJob) {
    throw new Error(`Unknown quotation PDF job: ${jobId}`)
  }

  return pendingJob.payload
}

function markQuotationPdfReady(jobId: string) {
  const pendingJob = pendingQuotationPdfJobs.get(jobId)

  if (!pendingJob) {
    throw new Error(`Unknown quotation PDF job: ${jobId}`)
  }

  pendingJob.resolveReady()
}

async function waitForQuotationPdfReady(jobId: string) {
  const pendingJob = pendingQuotationPdfJobs.get(jobId)

  if (!pendingJob) {
    throw new Error(`Unknown quotation PDF job: ${jobId}`)
  }

  let timeoutHandle: NodeJS.Timeout | undefined

  try {
    await Promise.race([
      pendingJob.readyPromise,
      new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new Error(`Timed out waiting for quotation PDF render readiness: ${jobId}`))
        }, PDF_RENDER_READY_TIMEOUT_MS)
      }),
    ])
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle)
    }
  }
}

function cleanupPendingQuotationPdfJob(jobId: string) {
  pendingQuotationPdfJobs.delete(jobId)
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

function decodeFileBuffer(buffer: Buffer): string {
  const bytes = new Uint8Array(buffer)

  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(buffer)
  }

  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(buffer)
  }

  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(buffer)
  }

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer)
  } catch {
    return new TextDecoder('gbk').decode(buffer)
  }
}
