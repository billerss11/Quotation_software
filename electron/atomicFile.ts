import { randomUUID } from 'node:crypto'
import * as fileSystem from 'node:fs/promises'
import path from 'node:path'

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

async function writeFileAtomically(
  filePath: string,
  content: string | Uint8Array,
  encoding?: BufferEncoding,
  signal?: AbortSignal,
) {
  const resolvedPath = path.resolve(filePath)
  const temporaryPath = path.join(
    path.dirname(resolvedPath),
    `.${path.basename(resolvedPath)}.${randomUUID()}.tmp`,
  )

  try {
    signal?.throwIfAborted()
    await fileSystem.writeFile(temporaryPath, content, encoding)
    signal?.throwIfAborted()
    await backupExistingFile(resolvedPath)
    signal?.throwIfAborted()
    await fileSystem.rename(temporaryPath, resolvedPath)
  } catch (error) {
    await fileSystem.rm(temporaryPath, { force: true }).catch(() => undefined)
    throw error
  }
}

export function getBackupFilePath(filePath: string) {
  const resolvedPath = path.resolve(filePath)
  const parsedPath = path.parse(resolvedPath)
  return path.join(parsedPath.dir, `${parsedPath.name}.backup${parsedPath.ext}`)
}

async function backupExistingFile(filePath: string) {
  try {
    await fileSystem.copyFile(filePath, getBackupFilePath(filePath))
  } catch (error) {
    if (isMissingFileError(error)) {
      return
    }

    throw error
  }
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}
