import { copyFile, mkdtemp } from 'node:fs/promises'
import path from 'node:path'

import type { UserManualLocale } from './preload-api.js'

const USER_MANUAL_FILE_NAMES: Record<UserManualLocale, string> = {
  'en-US': 'Quotation-Software-User-Guide-en-US.docx',
  'zh-CN': 'Quotation-Software-User-Guide-zh-CN.docx',
}

interface OpenBundledUserManualOptions {
  appPath: string
  isPackaged: boolean
  locale: unknown
  tempPath: string
  openPath: (filePath: string) => Promise<string>
}

export async function openBundledUserManual(options: OpenBundledUserManualOptions) {
  const locale = parseUserManualLocale(options.locale)
  const fileName = USER_MANUAL_FILE_NAMES[locale]
  const sourceFolder = options.isPackaged ? 'dist' : path.join('docs', 'user-guides')
  const sourcePath = path.join(options.appPath, sourceFolder, fileName)
  const temporaryFolder = await mkdtemp(path.join(options.tempPath, 'quotation-software-manual-'))
  const temporaryPath = path.join(temporaryFolder, fileName)

  await copyFile(sourcePath, temporaryPath)

  const openError = await options.openPath(temporaryPath)
  if (openError) {
    throw new Error(openError)
  }
}

export function parseUserManualLocale(value: unknown): UserManualLocale {
  if (value === 'en-US' || value === 'zh-CN') {
    return value
  }

  throw new Error('Unsupported user manual locale.')
}
