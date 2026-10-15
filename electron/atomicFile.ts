import { randomUUID } from 'node:crypto'
import * as fileSystem from 'node:fs/promises'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

const RENAME_RETRY_DELAYS_MS = [100, 200, 400, 800, 1000]
const pendingWrites = new Map<string, Promise<void>>()

export async function writeTextFileAtomically(filePath: string, content: string) {
  return writeFileAtomically(filePath, content, 'utf8')
}

export async function writeBufferFileAtomically(
  filePath: string,
  content: Uint8Array,
  options: { signal?: AbortSignal } = {},
) {
  return writeFileAtomically(filePath, content, undefined, options.signal)
}

function writeFileAtomically(
  filePath: string,
  content: string | Uint8Array,
  encoding?: BufferEncoding,
  signal?: AbortSignal,
) {
  const resolvedPath = path.resolve(filePath)
  const key = process.platform === 'win32' ? resolvedPath.toLowerCase() : resolvedPath
  const previousWrite = pendingWrites.get(key) ?? Promise.resolve()
  // Keep a retrying older save from replacing a newer save to the same path.
  const write = previousWrite.catch(() => undefined).then(() =>
    replaceFileAtomically(resolvedPath, content, encoding, signal),
  )
  pendingWrites.set(key, write)
  return write.finally(() => {
    if (pendingWrites.get(key) === write) pendingWrites.delete(key)
  })
}

async function replaceFileAtomically(
  resolvedPath: string,
  content: string | Uint8Array,
  encoding?: BufferEncoding,
  signal?: AbortSignal,
) {
  const temporaryPath = path.join(
    path.dirname(resolvedPath),
    `.${path.basename(resolvedPath)}.${randomUUID()}.tmp`,
  )

  try {
    signal?.throwIfAborted()
    await fileSystem.writeFile(temporaryPath, content, encoding)
    await renameWithRetry(temporaryPath, resolvedPath, signal)
  } catch (error) {
    await fileSystem.rm(temporaryPath, { force: true }).catch(() => undefined)
    throw error
  }
}

async function renameWithRetry(temporaryPath: string, filePath: string, signal?: AbortSignal) {
  for (let attempt = 0; ; attempt += 1) {
    signal?.throwIfAborted()
    try {
      await fileSystem.rename(temporaryPath, filePath)
      return
    } catch (error) {
      const waitMs = RENAME_RETRY_DELAYS_MS[attempt]
      // Windows sharing violations can surface as permission errors during sync/scanning.
      if (waitMs === undefined || !isFileBusyError(error)) throw error
      await delay(waitMs, undefined, { signal })
    }
  }
}

function isFileBusyError(error: unknown): boolean {
  return error instanceof Error && 'code' in error
    && (error.code === 'EBUSY' || error.code === 'EPERM' || error.code === 'EACCES')
}
