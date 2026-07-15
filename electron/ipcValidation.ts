import { Buffer } from 'node:buffer'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type {
  ExportGoodsReceiptPdfOptions,
  ExportQuotationPdfOptions,
  SaveQuotationFileOptions,
} from './preload-api.js'

export const MAX_TEXT_FILE_BYTES = 50 * 1024 * 1024

export function isDevAutoImportQuotationFileName(fileName: string) {
  const normalizedName = fileName.toLowerCase()
  return normalizedName.endsWith('.json') && !normalizedName.endsWith('.backup.json')
}

export function parseSaveFileOptions(value: unknown, allowedExtensions: readonly string[]): SaveQuotationFileOptions {
  if (!isRecord(value) || typeof value.content !== 'string') {
    throw new Error('Invalid file save request.')
  }

  if (Buffer.byteLength(value.content, 'utf8') > MAX_TEXT_FILE_BYTES) {
    throw new Error('File content exceeds the 50 MB limit.')
  }

  return {
    content: value.content,
    filePath: value.filePath === undefined
      ? undefined
      : resolveAllowedFilePath(value.filePath, allowedExtensions),
    defaultPath: value.defaultPath === undefined
      ? undefined
      : parseOptionalPathText(value.defaultPath, 'default file path'),
  }
}

export function parseQuotationPdfOptions(value: unknown): ExportQuotationPdfOptions {
  if (
    !isRecord(value)
    || !isRecord(value.quotation)
    || !Array.isArray(value.summaries)
    || !isRecord(value.totals)
    || !isRecord(value.exchangeRates)
    || !isRecord(value.companyProfile)
  ) {
    throw new Error('Invalid quotation PDF export request.')
  }

  return {
    ...value,
    defaultFileName: parseRequiredText(value.defaultFileName, 'PDF file name'),
    filePath: value.filePath === undefined
      ? undefined
      : resolveAllowedFilePath(value.filePath, ['.pdf']),
  } as unknown as ExportQuotationPdfOptions
}

export function parseGoodsReceiptPdfOptions(value: unknown): ExportGoodsReceiptPdfOptions {
  if (!isRecord(value) || !isRecord(value.draft) || !isRecord(value.branding)) {
    throw new Error('Invalid goods receipt PDF export request.')
  }

  return {
    ...value,
    defaultFileName: parseRequiredText(value.defaultFileName, 'PDF file name'),
    filePath: value.filePath === undefined
      ? undefined
      : resolveAllowedFilePath(value.filePath, ['.pdf']),
  } as unknown as ExportGoodsReceiptPdfOptions
}

export function resolveAllowedFilePath(value: unknown, allowedExtensions: readonly string[]) {
  const filePath = parseRequiredText(value, 'file path')
  const resolvedPath = path.resolve(filePath)
  const extension = path.extname(resolvedPath).toLowerCase()

  if (!allowedExtensions.includes(extension)) {
    throw new Error(`Unsupported file extension: ${extension || '(none)'}`)
  }

  return resolvedPath
}

export function parsePdfJobId(value: unknown) {
  const jobId = parseRequiredText(value, 'PDF job ID')

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(jobId)) {
    throw new Error('Invalid PDF job ID.')
  }

  return jobId
}

export function isTrustedRendererUrl(value: string, options: {
  devServerUrl?: string
  packagedEntryPath: string
}) {
  try {
    const senderUrl = new URL(value)

    if (options.devServerUrl) {
      return senderUrl.origin === new URL(options.devServerUrl).origin
    }

    return senderUrl.protocol === 'file:'
      && path.resolve(fileURLToPath(senderUrl)) === path.resolve(options.packagedEntryPath)
  } catch {
    return false
  }
}

function parseOptionalPathText(value: unknown, label: string) {
  return parseRequiredText(value, label)
}

function parseRequiredText(value: unknown, label: string) {
  if (typeof value !== 'string' || value.trim().length === 0 || value.includes('\0')) {
    throw new Error(`A valid ${label} is required.`)
  }

  return value.trim()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
