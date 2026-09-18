import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { openBundledUserManual, parseUserManualLocale } from './userManual.js'

const temporaryRoots: string[] = []

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map(root => rm(root, { force: true, recursive: true })))
})

describe('user manual opening', () => {
  it('accepts only the two bundled manual locales', () => {
    expect(parseUserManualLocale('en-US')).toBe('en-US')
    expect(parseUserManualLocale('zh-CN')).toBe('zh-CN')
    expect(() => parseUserManualLocale('../manual.docx')).toThrow('Unsupported user manual locale.')
  })

  it.each([false, true])('opens a fresh temporary copy without overwriting an earlier copy (packaged: %s)', async (isPackaged) => {
    const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), 'quotation-manual-test-'))
    temporaryRoots.push(fixtureRoot)

    const appPath = path.join(fixtureRoot, 'app')
    const tempPath = path.join(fixtureRoot, 'temp')
    const manualFolder = path.join(appPath, isPackaged ? 'dist' : path.join('docs', 'user-guides'))
    const fileName = 'Quotation-Software-User-Guide-en-US.docx'
    await mkdir(manualFolder, { recursive: true })
    await mkdir(tempPath, { recursive: true })
    await writeFile(path.join(manualFolder, fileName), 'bundled guide')

    const openedPaths: string[] = []
    const openPath = vi.fn(async (filePath: string) => {
      openedPaths.push(filePath)
      return ''
    })

    const options = {
      appPath,
      isPackaged,
      locale: 'en-US',
      tempPath,
      openPath,
    }
    await openBundledUserManual(options)
    await openBundledUserManual(options)

    expect(openedPaths).toHaveLength(2)
    expect(openedPaths[0]).not.toBe(openedPaths[1])
    await expect(readFile(openedPaths[0]!, 'utf8')).resolves.toBe('bundled guide')
    await expect(readFile(openedPaths[1]!, 'utf8')).resolves.toBe('bundled guide')
  })
})
