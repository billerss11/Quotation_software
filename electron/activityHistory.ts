import { appendFile, mkdir, readdir, stat, unlink } from 'node:fs/promises'
import path from 'node:path'

import type { ActivityHistoryEntry } from './preload-api.js'

export const ACTIVITY_HISTORY_FOLDER_NAME = 'Quotation Activity History - Safe to Delete'
export const ACTIVITY_HISTORY_MAX_TOTAL_BYTES = 100 * 1024 * 1024
export const ACTIVITY_HISTORY_CONTEXT_MAX_CHARACTERS = 200
export const ACTIVITY_HISTORY_MESSAGE_MAX_CHARACTERS = 1_000

const ACTIVITY_HISTORY_FILE_PATTERN = /^quotation-activity-(\d{4})-(\d{2})\.log$/
const ACTIVITY_HISTORY_FILE_HEADER = [
  '# Quotation Software Activity History / 报价软件操作历史',
  '# Temporary and safe to delete. Deleting this folder does not affect saved quotations.',
  '# 此历史为临时记录，可安全删除。删除此文件夹不会影响已保存的报价。',
  '',
].join('\n')

interface ActivityHistoryWriterOptions {
  maxTotalBytes?: number
  now?: () => Date
}

export function createActivityHistoryWriter(
  userDataPath: string,
  options: ActivityHistoryWriterOptions = {},
) {
  const folderPath = path.join(userDataPath, ACTIVITY_HISTORY_FOLDER_NAME)
  const maxTotalBytes = options.maxTotalBytes ?? ACTIVITY_HISTORY_MAX_TOTAL_BYTES
  const now = options.now ?? (() => new Date())
  let writeQueue = Promise.resolve()

  function appendEntry(entry: ActivityHistoryEntry) {
    const timestamp = now()
    const pendingWrite = writeQueue.then(() => appendActivityHistoryEntry({
      entry,
      folderPath,
      maxTotalBytes,
      timestamp,
    }))
    writeQueue = pendingWrite.then(() => undefined, () => undefined)
    return pendingWrite
  }

  async function ensureFolder() {
    await mkdir(folderPath, { recursive: true })
    return folderPath
  }

  return {
    appendEntry,
    ensureFolder,
    folderPath,
  }
}

async function appendActivityHistoryEntry(options: {
  entry: ActivityHistoryEntry
  folderPath: string
  maxTotalBytes: number
  timestamp: Date
}) {
  await mkdir(options.folderPath, { recursive: true })

  const fileName = createActivityHistoryFileName(options.timestamp)
  const filePath = path.join(options.folderPath, fileName)
  const existingSize = await getFileSize(filePath)
  const line = formatActivityHistoryLine(options.entry, options.timestamp)
  const content = existingSize === 0 ? `${ACTIVITY_HISTORY_FILE_HEADER}${line}` : line

  await appendFile(filePath, content, 'utf8')
  await pruneActivityHistoryFiles(options.folderPath, fileName, options.maxTotalBytes)
  return options.folderPath
}

export function createActivityHistoryFileName(timestamp: Date) {
  return `quotation-activity-${timestamp.getFullYear()}-${pad(timestamp.getMonth() + 1)}.log`
}

export function formatActivityHistoryLine(entry: ActivityHistoryEntry, timestamp: Date) {
  const context = sanitizeActivityHistoryText(entry.context, ACTIVITY_HISTORY_CONTEXT_MAX_CHARACTERS)
  const message = sanitizeActivityHistoryText(entry.message, ACTIVITY_HISTORY_MESSAGE_MAX_CHARACTERS)
  return `[${formatLocalTimestamp(timestamp)}] [${context}] ${message}\n`
}

export function sanitizeActivityHistoryText(value: string, maxCharacters: number) {
  const normalized = value
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (normalized.length <= maxCharacters) {
    return normalized
  }

  return `${normalized.slice(0, Math.max(0, maxCharacters - 1)).trimEnd()}…`
}

async function pruneActivityHistoryFiles(
  folderPath: string,
  currentFileName: string,
  maxTotalBytes: number,
) {
  const entries = await readdir(folderPath, { withFileTypes: true })
  const managedFiles = await Promise.all(entries.flatMap((entry) => {
    if (!entry.isFile() || !ACTIVITY_HISTORY_FILE_PATTERN.test(entry.name)) {
      return []
    }

    const filePath = path.join(folderPath, entry.name)
    return [getFileSize(filePath).then((size) => ({
      fileName: entry.name,
      filePath,
      size,
    }))]
  }))
  let totalBytes = managedFiles.reduce((total, file) => total + file.size, 0)

  for (const file of managedFiles.sort((left, right) => left.fileName.localeCompare(right.fileName))) {
    if (totalBytes <= maxTotalBytes) {
      break
    }
    if (file.fileName >= currentFileName) {
      continue
    }

    await unlink(file.filePath)
    totalBytes -= file.size
  }
}

async function getFileSize(filePath: string) {
  try {
    return (await stat(filePath)).size
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return 0
    }

    throw error
  }
}

function formatLocalTimestamp(timestamp: Date) {
  const timezoneOffsetMinutes = -timestamp.getTimezoneOffset()
  const timezoneSign = timezoneOffsetMinutes >= 0 ? '+' : '-'
  const absoluteOffset = Math.abs(timezoneOffsetMinutes)
  const timezoneHours = pad(Math.floor(absoluteOffset / 60))
  const timezoneMinutes = pad(absoluteOffset % 60)

  return [
    `${timestamp.getFullYear()}-${pad(timestamp.getMonth() + 1)}-${pad(timestamp.getDate())}`,
    `${pad(timestamp.getHours())}:${pad(timestamp.getMinutes())}:${pad(timestamp.getSeconds())}`,
    `${timezoneSign}${timezoneHours}:${timezoneMinutes}`,
  ].join(' ')
}

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error
}
