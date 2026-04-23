import electron from 'electron'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const { app, BrowserWindow, dialog, ipcMain } = electron
const __dirname = path.dirname(fileURLToPath(import.meta.url))

interface SaveQuotationFileOptions {
  filePath?: string
  defaultPath?: string
  content: string
}

function createMainWindow() {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1180,
    minHeight: 760,
    title: 'Quotation Software',
    backgroundColor: '#f5f7fb',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  const devServerUrl = process.env.VITE_DEV_SERVER_URL

  if (devServerUrl) {
    void mainWindow.loadURL(devServerUrl)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
    return
  }

  void mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'))
}

app.whenReady().then(() => {
  ipcMain.handle('app:get-version', () => app.getVersion())
  ipcMain.handle('quotation:save-file', (_event, options: SaveQuotationFileOptions) =>
    saveQuotationFile(options),
  )
  ipcMain.handle('quotation:open-file', () => openQuotationFile())
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

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

async function openQuotationFile() {
  const result = await dialog.showOpenDialog({
    title: 'Import quotation',
    properties: ['openFile'],
    filters: [{ name: 'Quotation JSON', extensions: ['json'] }],
  })

  const filePath = result.filePaths[0]

  if (result.canceled || !filePath) {
    return { canceled: true as const }
  }

  return {
    canceled: false as const,
    filePath,
    content: await readFile(filePath, 'utf8'),
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
