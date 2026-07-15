import * as fileSystem from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { getBackupFilePath, writeTextFileAtomically } from './atomicFile.js'

const fileSystemMock = vi.hoisted(() => ({
  writeFile: vi.fn(),
}))

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  fileSystemMock.writeFile.mockImplementation(actual.writeFile)

  return {
    ...actual,
    writeFile: fileSystemMock.writeFile,
  }
})

describe('atomic text file writes', () => {
  const temporaryDirectories: string[] = []

  afterEach(async () => {
    await Promise.all(temporaryDirectories.splice(0).map((directory) =>
      fileSystem.rm(directory, { force: true, recursive: true }),
    ))
    vi.restoreAllMocks()
  })

  it('replaces a file and keeps the previous version as a backup', async () => {
    const directory = await createTemporaryDirectory()
    const filePath = path.join(directory, 'quotation.json')
    await fileSystem.writeFile(filePath, 'previous', 'utf8')

    await writeTextFileAtomically(filePath, 'current')

    await expect(fileSystem.readFile(filePath, 'utf8')).resolves.toBe('current')
    await expect(fileSystem.readFile(getBackupFilePath(filePath), 'utf8')).resolves.toBe('previous')
    expect(getBackupFilePath(filePath)).toBe(path.join(directory, 'quotation.backup.json'))
    expect((await fileSystem.readdir(directory)).some((name) => name.endsWith('.tmp'))).toBe(false)
  })

  it('creates a new file without creating an empty backup', async () => {
    const directory = await createTemporaryDirectory()
    const filePath = path.join(directory, 'library.json')

    await writeTextFileAtomically(filePath, 'content')

    await expect(fileSystem.readFile(filePath, 'utf8')).resolves.toBe('content')
    expect(await fileSystem.readdir(directory)).toEqual(['library.json'])
  })

  it('removes a partially written temporary file when the write fails', async () => {
    const directory = await createTemporaryDirectory()
    const filePath = path.join(directory, 'quotation.json')

    fileSystemMock.writeFile.mockImplementationOnce(async (
      temporaryPath: Parameters<typeof fileSystem.writeFile>[0],
    ) => {
      const fileHandle = await fileSystem.open(temporaryPath, 'w')
      await fileHandle.writeFile('partial', 'utf8')
      await fileHandle.close()
      throw new Error('simulated write failure')
    })

    await expect(writeTextFileAtomically(filePath, 'current')).rejects.toThrow('simulated write failure')
    expect(await fileSystem.readdir(directory)).toEqual([])
  })

  async function createTemporaryDirectory() {
    const directory = await fileSystem.mkdtemp(path.join(os.tmpdir(), 'quotation-software-'))
    temporaryDirectories.push(directory)
    return directory
  }
})
