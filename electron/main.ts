import { randomUUID } from 'node:crypto'
import { readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { IpcMainInvokeEvent } from 'electron'
import type {
  ExportGoodsReceiptPdfOptions,
  ExportQuotationPdfOptions,
  GoodsReceiptPdfRenderPayload,
  QuotationPdfRenderPayload,
  SaveQuotationFileOptions,
} from './preload-api.js'
import { getQuotationPdfViewportSize } from '../src/features/quotations/utils/quotationDocumentPage.js'
import { writeTextFileAtomically } from './atomicFile.js'
import {
  MAX_TEXT_FILE_BYTES,
  isDevAutoImportQuotationFileName,
  isTrustedRendererUrl,
  parseGoodsReceiptPdfOptions,
  parsePdfJobId,
  parseQuotationPdfOptions,
  parseSaveFileOptions,
  resolveAllowedFilePath,
} from './ipcValidation.js'

const require = createRequire(import.meta.url)
const electron = require('electron') as typeof import('electron')
const { app, BrowserWindow, dialog, ipcMain } = electron
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PDF_RENDER_READY_TIMEOUT_MS = 30_000

type PdfRenderPayload = QuotationPdfRenderPayload | GoodsReceiptPdfRenderPayload

interface PendingQuotationPdfJob {
  payload: PdfRenderPayload
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
      sandbox: true,
    },
  })

  secureRendererWindow(mainWindow)

  void loadRendererWindow(mainWindow)

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  }
}

function createQuotationPdfWindow() {
  const pdfViewport = getQuotationPdfViewportSize()

  const pdfWindow = new BrowserWindow({
    show: false,
    width: pdfViewport.width,
    height: pdfViewport.height,
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  secureRendererWindow(pdfWindow)
  return pdfWindow
}

function getPreloadPath() {
  return path.join(__dirname, 'preload.cjs')
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
  ipcMain.handle('app:get-version', (event) => {
    assertTrustedIpcSender(event)
    return app.getVersion()
  })
  ipcMain.handle('quotation:save-file', (event, options: unknown) => {
    assertTrustedIpcSender(event)
    return saveQuotationFile(parseSaveFileOptions(options, ['.json']))
  })
  ipcMain.handle('line-items:save-csv-file', (event, options: unknown) => {
    assertTrustedIpcSender(event)
    return saveLineItemsCsvFile(parseSaveFileOptions(options, ['.csv']))
  })
  ipcMain.handle('line-items:save-csv-template-file', (event, options: unknown) => {
    assertTrustedIpcSender(event)
    return saveLineItemsCsvTemplateFile(parseSaveFileOptions(options, ['.csv']))
  })
  ipcMain.handle('line-items:save-excel-template-file', (event) => {
    assertTrustedIpcSender(event)
    return saveLineItemsExcelTemplateFile()
  })
  ipcMain.handle('quotation:open-file', (event) => {
    assertTrustedIpcSender(event)
    return openTextFile('Import quotation', [{ name: 'Quotation JSON', extensions: ['json'] }], ['.json'])
  })
  ipcMain.handle('quotation:open-file-path', (event, filePath: unknown) => {
    assertTrustedIpcSender(event)
    return openTextFileAtPath(filePath, ['.json'])
  })
  ipcMain.handle('quotation:open-dev-auto-import-file', (event) => {
    assertTrustedIpcSender(event)
    return openDevAutoImportQuotationFile()
  })
  ipcMain.handle('line-items:open-csv-file', (event) => {
    assertTrustedIpcSender(event)
    return openTextFile('Import line items CSV', [{ name: 'CSV files', extensions: ['csv'] }], ['.csv'])
  })
  ipcMain.handle('line-items:open-csv-file-path', (event, filePath: unknown) => {
    assertTrustedIpcSender(event)
    return openTextFileAtPath(filePath, ['.csv'])
  })
  ipcMain.handle('line-items:open-xlsx-file', (event) => {
    assertTrustedIpcSender(event)
    return openBinaryFile('Import line items Excel workbook', [{ name: 'Excel Workbook', extensions: ['xlsx'] }])
  })
  ipcMain.handle('line-items:open-xlsx-file-path', (event, filePath: unknown) => {
    assertTrustedIpcSender(event)
    return openBinaryFileAtPath(filePath)
  })
  ipcMain.handle('library:save-file', (event, options: unknown) => {
    assertTrustedIpcSender(event)
    return saveLibraryFile(parseSaveFileOptions(options, ['.json']))
  })
  ipcMain.handle('library:open-file', (event) => {
    assertTrustedIpcSender(event)
    return openTextFile('Open quotation library', [{ name: 'Quotation Library JSON', extensions: ['json'] }], ['.json'])
  })
  ipcMain.handle('quotation:export-pdf', (event, options: unknown) => {
    assertTrustedIpcSender(event)
    return exportPdf(parseQuotationPdfOptions(options), 'quotation-print')
  })
  ipcMain.handle('goods-receipt:export-pdf', (event, options: unknown) => {
    assertTrustedIpcSender(event)
    return exportPdf(parseGoodsReceiptPdfOptions(options), 'goods-receipt-print')
  })
  ipcMain.handle('quotation:get-pdf-payload', (event, jobId: unknown) => {
    assertTrustedIpcSender(event)
    return getQuotationPdfPayload(parsePdfJobId(jobId))
  })
  ipcMain.handle('quotation:pdf-render-ready', (event, jobId: unknown) => {
    assertTrustedIpcSender(event)
    return markQuotationPdfReady(parsePdfJobId(jobId))
  })
  ipcMain.handle('goods-receipt:get-pdf-payload', (event, jobId: unknown) => {
    assertTrustedIpcSender(event)
    return getGoodsReceiptPdfPayload(parsePdfJobId(jobId))
  })
  ipcMain.handle('goods-receipt:pdf-render-ready', (event, jobId: unknown) => {
    assertTrustedIpcSender(event)
    return markQuotationPdfReady(parsePdfJobId(jobId))
  })
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

async function exportPdf(
  options: ExportQuotationPdfOptions | ExportGoodsReceiptPdfOptions,
  renderMode: 'quotation-print' | 'goods-receipt-print',
) {
  const filePath = options.filePath
    ? resolveAllowedFilePath(options.filePath, ['.pdf'])
    : await chooseQuotationPdfExportPath(options.defaultFileName)

  if (!filePath) {
    return { canceled: true as const }
  }

  const { filePath: _filePath, ...payload } = options
  const jobId = createPendingQuotationPdfJob(payload)
  const pdfWindow = createQuotationPdfWindow()

  try {
    await loadRendererWindow(pdfWindow, {
      mode: renderMode,
      jobId,
    })
    await waitForQuotationPdfReady(jobId)

    const pdfBuffer = await pdfWindow.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
    })

    await writeFile(filePath, pdfBuffer)

    return {
      canceled: false as const,
      filePath,
    }
  } finally {
    cleanupPendingQuotationPdfJob(jobId)

    if (!pdfWindow.isDestroyed()) {
      pdfWindow.destroy()
    }
  }
}

async function chooseQuotationPdfExportPath(defaultPath: string) {
  const result = await dialog.showSaveDialog({
    title: 'Export PDF',
    defaultPath,
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
  })

  return result.canceled || !result.filePath
    ? null
    : resolveAllowedFilePath(result.filePath, ['.pdf'])
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

    filePath = resolveAllowedFilePath(result.filePath, ['.json'])
  }

  await writeTextFileAtomically(filePath, options.content)
  return { canceled: false as const, filePath }
}

async function saveLineItemsCsvFile(options: SaveQuotationFileOptions) {
  return saveCsvFile(options, 'Export line items CSV')
}

async function saveLineItemsCsvTemplateFile(options: SaveQuotationFileOptions) {
  return saveCsvFile(options, 'Export CSV template')
}

async function saveLineItemsExcelTemplateFile() {
  const result = await dialog.showSaveDialog({
    title: 'Export Excel template',
    defaultPath: 'quotation-line-items-template.xlsx',
    filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }],
  })

  if (result.canceled || !result.filePath) {
    return { canceled: true as const }
  }

  const filePath = resolveAllowedFilePath(result.filePath, ['.xlsx'])
  const templatePath = path.join(app.getAppPath(), 'file', 'templates', 'quotation-line-items-template.xlsx')

  await writeFile(filePath, await readFile(templatePath))
  return { canceled: false as const, filePath }
}

async function openTextFile(
  title: string,
  filters: Array<{ name: string; extensions: string[] }>,
  allowedExtensions: readonly string[],
) {
  const result = await dialog.showOpenDialog({
    title,
    properties: ['openFile'],
    filters,
  })

  const filePath = result.filePaths[0]

  if (result.canceled || !filePath) {
    return { canceled: true as const }
  }

  const resolvedPath = resolveAllowedFilePath(filePath, allowedExtensions)

  return {
    canceled: false as const,
    filePath: resolvedPath,
    content: await readTextFile(resolvedPath),
  }
}

async function openTextFileAtPath(filePath: unknown, allowedExtensions: readonly string[]) {
  const resolvedPath = resolveAllowedFilePath(filePath, allowedExtensions)

  return {
    canceled: false as const,
    filePath: resolvedPath,
    content: await readTextFile(resolvedPath),
  }
}

async function openBinaryFile(
  title: string,
  filters: Array<{ name: string; extensions: string[] }>,
) {
  const result = await dialog.showOpenDialog({
    title,
    properties: ['openFile'],
    filters,
  })
  const filePath = result.filePaths[0]

  if (result.canceled || !filePath) {
    return { canceled: true as const }
  }

  return openBinaryFileAtPath(filePath)
}

async function openBinaryFileAtPath(filePath: unknown) {
  const resolvedPath = resolveAllowedFilePath(filePath, ['.xlsx'])

  return {
    canceled: false as const,
    filePath: resolvedPath,
    content: await readFile(resolvedPath),
  }
}

async function openDevAutoImportQuotationFile() {
  if (!process.env.VITE_DEV_SERVER_URL) {
    return { canceled: true as const }
  }

  const filePath = await findDevAutoImportQuotationFile()

  if (!filePath) {
    return { canceled: true as const }
  }

  return {
    canceled: false as const,
    filePath,
    content: await readTextFile(filePath),
  }
}

async function findDevAutoImportQuotationFile() {
  const devFileDirectory = path.resolve(__dirname, '../..', 'file')

  try {
    const entries = await readdir(devFileDirectory, { withFileTypes: true })
    const fileName = entries
      .filter((entry) => entry.isFile() && isDevAutoImportQuotationFileName(entry.name))
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right))
      .at(0)

    return fileName ? path.join(devFileDirectory, fileName) : null
  } catch {
    return null
  }
}

async function saveLibraryFile(options: SaveQuotationFileOptions) {
  let filePath = options.filePath

  if (!filePath) {
    const result = await dialog.showSaveDialog({
      title: 'Save quotation library',
      defaultPath: options.defaultPath,
      filters: [{ name: 'Quotation Library JSON', extensions: ['json'] }],
    })

    if (result.canceled || !result.filePath) {
      return { canceled: true as const }
    }

    filePath = resolveAllowedFilePath(result.filePath, ['.json'])
  }

  await writeTextFileAtomically(filePath, options.content)
  return { canceled: false as const, filePath }
}

async function saveCsvFile(options: SaveQuotationFileOptions, title: string) {
  let filePath = options.filePath

  if (!filePath) {
    const result = await dialog.showSaveDialog({
      title,
      defaultPath: options.defaultPath,
      filters: [{ name: 'CSV Files', extensions: ['csv'] }],
    })

    if (result.canceled || !result.filePath) {
      return { canceled: true as const }
    }

    filePath = resolveAllowedFilePath(result.filePath, ['.csv'])
  }

  await writeFile(filePath, options.content, 'utf8')
  return { canceled: false as const, filePath }
}

function createPendingQuotationPdfJob(payload: PdfRenderPayload) {
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

  return pendingJob.payload as QuotationPdfRenderPayload
}

function getGoodsReceiptPdfPayload(jobId: string) {
  const pendingJob = pendingQuotationPdfJobs.get(jobId)

  if (!pendingJob) {
    throw new Error(`Unknown goods receipt PDF job: ${jobId}`)
  }

  return pendingJob.payload as GoodsReceiptPdfRenderPayload
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

async function readTextFile(filePath: string) {
  const metadata = await stat(filePath)
  if (metadata.size > MAX_TEXT_FILE_BYTES) {
    throw new Error('File exceeds the 50 MB limit.')
  }

  return decodeFileBuffer(await readFile(filePath))
}

function secureRendererWindow(window: InstanceType<typeof BrowserWindow>) {
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event) => {
    event.preventDefault()
  })
}

function assertTrustedIpcSender(event: IpcMainInvokeEvent) {
  const senderUrl = event.senderFrame?.url ?? event.sender.getURL()
  if (!isTrustedRendererUrl(senderUrl, {
    devServerUrl: process.env.VITE_DEV_SERVER_URL,
    packagedEntryPath: path.resolve(__dirname, '../../dist/index.html'),
  })) {
    throw new Error('Blocked IPC request from an untrusted renderer.')
  }
}
