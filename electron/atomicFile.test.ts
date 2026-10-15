import * as fileSystem from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { writeBufferFileAtomically, writeTextFileAtomically } from './atomicFile.js'

const fileSystemMock = vi.hoisted(() => ({
  writeFile: vi.fn(),
  rename: vi.fn(),
}))
const timersMock = vi.hoisted(() => ({ delay: vi.fn() }))

vi.mock('node:timers/promises', () => ({ setTimeout: timersMock.delay }))

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  fileSystemMock.writeFile.mockImplementation(actual.writeFile)

  return {
    ...actual,
    writeFile: fileSystemMock.writeFile,
    rename: fileSystemMock.rename,
  }
})

describe('atomic file writes', () => {
  const temporaryDirectories: string[] = []

  beforeEach(async () => {
    const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises')
    fileSystemMock.writeFile.mockReset().mockImplementation(actual.writeFile)
    fileSystemMock.rename.mockReset().mockImplementation(actual.rename)
    timersMock.delay.mockReset().mockResolvedValue(undefined)
  })

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

  it.each(['EPERM', 'EBUSY', 'EACCES'])('retries a temporary %s lock without rewriting the temporary file', async (code) => {
    const directory = await createTemporaryDirectory()
    const filePath = path.join(directory, 'quotation.json')
    await fileSystem.writeFile(filePath, 'previous')
    const error = Object.assign(new Error('locked'), { code })
    fileSystemMock.rename.mockRejectedValueOnce(error).mockRejectedValueOnce(error)

    await writeTextFileAtomically(filePath, 'current')

    await expect(fileSystem.readFile(filePath, 'utf8')).resolves.toBe('current')
    expect(fileSystemMock.rename).toHaveBeenCalledTimes(3)
    expect(new Set(fileSystemMock.rename.mock.calls.map(([source]) => source)).size).toBe(1)
    expect(fileSystemMock.writeFile.mock.calls.filter(([target]) => String(target).endsWith('.tmp'))).toHaveLength(1)
    expect(timersMock.delay.mock.calls.map(([waitMs]) => waitMs)).toEqual([100, 200])
    expect(await fileSystem.readdir(directory)).toEqual(['quotation.json'])
  })

  it('stops retrying a persistent lock and leaves the saved quotation intact', async () => {
    const directory = await createTemporaryDirectory()
    const filePath = path.join(directory, 'quotation.json')
    await fileSystem.writeFile(filePath, 'saved revision')
    const error = Object.assign(new Error('still locked'), { code: 'EPERM' })
    fileSystemMock.rename.mockRejectedValue(error)

    await expect(writeTextFileAtomically(filePath, 'unsaved changes')).rejects.toBe(error)

    expect(fileSystemMock.rename).toHaveBeenCalledTimes(6)
    expect(timersMock.delay.mock.calls.map(([waitMs]) => waitMs)).toEqual([100, 200, 400, 800, 1000])
    await expect(fileSystem.readFile(filePath, 'utf8')).resolves.toBe('saved revision')
    expect(await fileSystem.readdir(directory)).toEqual(['quotation.json'])
  })

  it.skipIf(process.platform !== 'win32')('recovers from a real Windows file sharing lock', async () => {
    const directory = await createTemporaryDirectory()
    const filePath = path.join(directory, 'quotation.json')
    await fileSystem.writeFile(filePath, 'previous')
    // This child holds only our temporary test file, allowing reads/writes but denying rename.
    const script = `
      $stream = [System.IO.File]::Open($env:QUOTATION_LOCK_TEST_PATH, 'Open', 'Read', 'ReadWrite')
      try {
        [Console]::Out.WriteLine('locked')
        [Console]::Out.Flush()
        [Console]::In.ReadLine() | Out-Null
      } finally { $stream.Dispose() }
    `
    const lock = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], {
      windowsHide: true,
      env: { ...process.env, QUOTATION_LOCK_TEST_PATH: filePath },
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    const exited = once(lock, 'exit')
    try {
      const [ready] = await Promise.race([
        once(lock.stdout, 'data'),
        exited.then(() => { throw new Error('Test lock process exited before opening its file') }),
      ])
      expect(String(ready).trim()).toBe('locked')
      const realTimers = await vi.importActual<typeof import('node:timers/promises')>('node:timers/promises')
      timersMock.delay.mockImplementationOnce(async (waitMs, value, options) => {
        lock.stdin.end('\n')
        await exited
        await realTimers.setTimeout(waitMs, value, options)
      })

      await writeTextFileAtomically(filePath, 'current')

      expect(fileSystemMock.rename).toHaveBeenCalledTimes(2)
      await expect(fileSystem.readFile(filePath, 'utf8')).resolves.toBe('current')
      expect(await fileSystem.readdir(directory)).toEqual(['quotation.json'])
    } finally {
      if (lock.pid && lock.exitCode === null) {
        lock.stdin.end('\n')
        await exited
      }
    }
  })

  it('reports unrelated filesystem errors immediately without replacing the original', async () => {
    const directory = await createTemporaryDirectory()
    const filePath = path.join(directory, 'quotation.json')
    await fileSystem.writeFile(filePath, 'previous')
    const error = Object.assign(new Error('disk full'), { code: 'ENOSPC' })
    fileSystemMock.rename.mockRejectedValueOnce(error)

    await expect(writeTextFileAtomically(filePath, 'current')).rejects.toBe(error)

    expect(timersMock.delay).not.toHaveBeenCalled()
    expect(fileSystemMock.rename).toHaveBeenCalledTimes(1)
    await expect(fileSystem.readFile(filePath, 'utf8')).resolves.toBe('previous')
    expect(await fileSystem.readdir(directory)).toEqual(['quotation.json'])
  })

  it('honors cancellation during a retry without replacing the destination', async () => {
    const directory = await createTemporaryDirectory()
    const filePath = path.join(directory, 'quotation.pdf')
    const controller = new AbortController()
    await fileSystem.writeFile(filePath, 'previous')
    fileSystemMock.rename.mockRejectedValueOnce(Object.assign(new Error('locked'), { code: 'EPERM' }))
    timersMock.delay.mockImplementationOnce(async (_waitMs, _value, options) => {
      expect(options.signal).toBe(controller.signal)
      controller.abort()
    })

    await expect(writeBufferFileAtomically(filePath, Uint8Array.from([1, 2]), {
      signal: controller.signal,
    })).rejects.toMatchObject({ name: 'AbortError' })

    expect(fileSystemMock.rename).toHaveBeenCalledTimes(1)
    await expect(fileSystem.readFile(filePath, 'utf8')).resolves.toBe('previous')
    expect(await fileSystem.readdir(directory)).toEqual(['quotation.pdf'])
  })

  it('keeps overlapping saves in order while allowing other files to save', async () => {
    const directory = await createTemporaryDirectory()
    const filePath = path.join(directory, 'quotation.json')
    const otherPath = path.join(directory, 'other.json')
    await fileSystem.writeFile(filePath, 'previous')
    let releaseRetry!: () => void
    let notifyRetry!: () => void
    const retryGate = new Promise<void>(resolve => { releaseRetry = resolve })
    const retryStarted = new Promise<void>(resolve => { notifyRetry = resolve })
    fileSystemMock.rename.mockRejectedValueOnce(Object.assign(new Error('locked'), { code: 'EPERM' }))
    timersMock.delay.mockImplementationOnce(() => { notifyRetry(); return retryGate })

    const first = writeTextFileAtomically(filePath, 'first save')
    await retryStarted
    const second = writeTextFileAtomically(process.platform === 'win32' ? filePath.toUpperCase() : filePath, 'second save')
    try {
      await writeTextFileAtomically(otherPath, 'unrelated save')
      await expect(fileSystem.readFile(filePath, 'utf8')).resolves.toBe('previous')
      expect(fileSystemMock.writeFile.mock.calls.some(([, content]) => content === 'second save')).toBe(false)
    } finally {
      releaseRetry()
      await Promise.all([first, second])
    }

    await expect(fileSystem.readFile(filePath, 'utf8')).resolves.toBe('second save')
    await expect(fileSystem.readFile(otherPath, 'utf8')).resolves.toBe('unrelated save')
    expect((await fileSystem.readdir(directory)).some(name => name.endsWith('.tmp'))).toBe(false)
  })

  it('allows the next queued save to succeed after an earlier save fails', async () => {
    const directory = await createTemporaryDirectory()
    const filePath = path.join(directory, 'quotation.json')
    const error = Object.assign(new Error('write failed'), { code: 'EIO' })
    fileSystemMock.rename.mockRejectedValueOnce(error)

    const outcomes = await Promise.allSettled([
      writeTextFileAtomically(filePath, 'failed save'),
      writeTextFileAtomically(filePath, 'successful save'),
    ])

    expect(outcomes).toEqual([{ status: 'rejected', reason: error }, { status: 'fulfilled', value: undefined }])
    await expect(fileSystem.readFile(filePath, 'utf8')).resolves.toBe('successful save')
    expect(await fileSystem.readdir(directory)).toEqual(['quotation.json'])
  })

  async function createTemporaryDirectory() {
    const directory = await fileSystem.mkdtemp(path.join(os.tmpdir(), 'quotation-software-'))
    temporaryDirectories.push(directory)
    return directory
  }
})
