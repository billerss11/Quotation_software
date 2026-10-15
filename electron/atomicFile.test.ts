import * as fileSystem from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { writeBufferFileAtomically, writeTextFileAtomically } from './atomicFile.js'

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

describe('atomic file writes', () => {
  const temporaryDirectories: string[] = []

  afterEach(async () => {
    await Promise.all(temporaryDirectories.splice(0).map((directory) =>
      fileSystem.rm(directory, { force: true, recursive: true }),
    ))
    vi.restoreAllMocks()
  })

  it('replaces a file without creating a backup', async () => {
    const directory = await createTemporaryDirectory()
    const filePath = path.join(directory, 'quotation.json')
    await fileSystem.writeFile(filePath, 'previous', 'utf8')

    await writeTextFileAtomically(filePath, 'current')

    await expect(fileSystem.readFile(filePath, 'utf8')).resolves.toBe('current')
    expect(await fileSystem.readdir(directory)).toEqual(['quotation.json'])
  })

  it('leaves an existing backup unchanged when replacing a file', async () => {
    const directory = await createTemporaryDirectory()
    const filePath = path.join(directory, 'quotation.json')
    const backupPath = path.join(directory, 'quotation.backup.json')
    await fileSystem.writeFile(filePath, 'previous', 'utf8')
    await fileSystem.writeFile(backupPath, 'older backup', 'utf8')

    await writeTextFileAtomically(filePath, 'current')

    await expect(fileSystem.readFile(filePath, 'utf8')).resolves.toBe('current')
    await expect(fileSystem.readFile(backupPath, 'utf8')).resolves.toBe('older backup')
    expect((await fileSystem.readdir(directory)).sort()).toEqual(['quotation.backup.json', 'quotation.json'])
  })

  it('creates a new file without creating a backup', async () => {
    const directory = await createTemporaryDirectory()
    const filePath = path.join(directory, 'library.json')

    await writeTextFileAtomically(filePath, 'content')

    await expect(fileSystem.readFile(filePath, 'utf8')).resolves.toBe('content')
    expect(await fileSystem.readdir(directory)).toEqual(['library.json'])
  })

  it('replaces binary output atomically without creating a backup', async () => {
    const directory = await createTemporaryDirectory()
    const filePath = path.join(directory, 'quotation.pdf')
    await fileSystem.writeFile(filePath, 'previous')

    await writeBufferFileAtomically(filePath, Uint8Array.from([0x25, 0x50, 0x44, 0x46]))

    await expect(fileSystem.readFile(filePath)).resolves.toEqual(Buffer.from('%PDF'))
    expect(await fileSystem.readdir(directory)).toEqual(['quotation.pdf'])
  })

  it('preserves the original and removes the temporary file when the write fails', async () => {
    const directory = await createTemporaryDirectory()
    const filePath = path.join(directory, 'quotation.json')
    await fileSystem.writeFile(filePath, 'previous', 'utf8')

    fileSystemMock.writeFile.mockImplementationOnce(async (
      temporaryPath: Parameters<typeof fileSystem.writeFile>[0],
    ) => {
      const fileHandle = await fileSystem.open(temporaryPath, 'w')
      await fileHandle.writeFile('partial', 'utf8')
      await fileHandle.close()
      throw new Error('simulated write failure')
    })

    await expect(writeTextFileAtomically(filePath, 'current')).rejects.toThrow('simulated write failure')
    await expect(fileSystem.readFile(filePath, 'utf8')).resolves.toBe('previous')
    expect(await fileSystem.readdir(directory)).toEqual(['quotation.json'])
  })

  it('does not replace the destination when a binary write is aborted', async () => {
    const directory = await createTemporaryDirectory()
    const filePath = path.join(directory, 'quotation.pdf')
    const controller = new AbortController()
    await fileSystem.writeFile(filePath, 'previous')

    fileSystemMock.writeFile.mockImplementationOnce(async (
      temporaryPath: Parameters<typeof fileSystem.writeFile>[0],
      content: Parameters<typeof fileSystem.writeFile>[1],
    ) => {
      const fileHandle = await fileSystem.open(temporaryPath, 'w')
      await fileHandle.writeFile(content)
      await fileHandle.close()
      controller.abort()
    })

    await expect(writeBufferFileAtomically(
      filePath,
      Uint8Array.from([0x25, 0x50, 0x44, 0x46]),
      { signal: controller.signal },
    )).rejects.toMatchObject({ name: 'AbortError' })
    await expect(fileSystem.readFile(filePath, 'utf8')).resolves.toBe('previous')
    expect((await fileSystem.readdir(directory)).some(name => name.endsWith('.tmp'))).toBe(false)
  })

  async function createTemporaryDirectory() {
    const directory = await fileSystem.mkdtemp(path.join(os.tmpdir(), 'quotation-software-'))
    temporaryDirectories.push(directory)
    return directory
  }
})
