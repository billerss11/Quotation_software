import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import {
  ACTIVITY_HISTORY_FOLDER_NAME,
  createActivityHistoryFileName,
  createActivityHistoryWriter,
  formatActivityHistoryLine,
} from './activityHistory.js'

const temporaryFolders: string[] = []

async function createTemporaryUserDataFolder() {
  const folderPath = await mkdtemp(path.join(os.tmpdir(), 'quotation-activity-history-'))
  temporaryFolders.push(folderPath)
  return folderPath
}

afterEach(async () => {
  await Promise.all(temporaryFolders.splice(0).map((folderPath) => rm(folderPath, {
    recursive: true,
    force: true,
  })))
})

describe('activity history writer', () => {
  it('creates the safe-to-delete folder and a monthly file with one bilingual notice', async () => {
    const userDataPath = await createTemporaryUserDataFolder()
    const timestamp = new Date(2026, 7, 30, 10, 42, 17)
    const writer = createActivityHistoryWriter(userDataPath, { now: () => timestamp })

    await writer.appendEntry({
      category: 'quotation',
      context: 'Quotation Q-2026-0042',
      message: 'Created quotation',
    })
    await writer.appendEntry({
      category: 'quotation',
      context: 'Quotation Q-2026-0042',
      message: 'Saved quotation',
    })

    const folderPath = path.join(userDataPath, ACTIVITY_HISTORY_FOLDER_NAME)
    const filePath = path.join(folderPath, createActivityHistoryFileName(timestamp))
    const content = await readFile(filePath, 'utf8')

    expect(content.match(/Temporary and safe to delete/g)).toHaveLength(1)
    expect(content).toContain('[Quotation Q-2026-0042] Created quotation')
    expect(content).toContain('[Quotation Q-2026-0042] Saved quotation')
  })

  it('rotates by local month and keeps concurrent appends ordered', async () => {
    const userDataPath = await createTemporaryUserDataFolder()
    let timestamp = new Date(2026, 6, 31, 23, 59, 59)
    const writer = createActivityHistoryWriter(userDataPath, { now: () => timestamp })

    const julyWrites = Promise.all(['first', 'second', 'third'].map((message) => writer.appendEntry({
      category: 'quotation',
      context: 'Quotation Q-1',
      message,
    })))
    timestamp = new Date(2026, 7, 1, 0, 0, 1)
    const augustWrite = writer.appendEntry({
      category: 'quotation',
      context: 'Quotation Q-1',
      message: 'August',
    })
    await Promise.all([julyWrites, augustWrite])

    const folderPath = writer.folderPath
    const july = await readFile(path.join(folderPath, 'quotation-activity-2026-07.log'), 'utf8')
    const files = await readdir(folderPath)

    expect(july.indexOf('first')).toBeLessThan(july.indexOf('second'))
    expect(july.indexOf('second')).toBeLessThan(july.indexOf('third'))
    expect(files).toEqual([
      'quotation-activity-2026-07.log',
      'quotation-activity-2026-08.log',
    ])
  })

  it('collapses controls and truncates context and messages', () => {
    const line = formatActivityHistoryLine({
      category: 'quotation',
      context: `Quotation\n${'Q'.repeat(250)}`,
      message: `Changed\t${'x'.repeat(1_100)}`,
    }, new Date(2026, 7, 30, 10, 42, 17))

    expect(line).not.toContain('\t')
    expect(line).not.toContain('\nChanged')
    expect(line).toContain('Quotation Q')
    expect(line.length).toBeLessThan(1_260)
    expect(line).toContain('…')
  })

  it('recreates a user-deleted folder on the next entry', async () => {
    const userDataPath = await createTemporaryUserDataFolder()
    const writer = createActivityHistoryWriter(userDataPath, {
      now: () => new Date(2026, 7, 30, 10, 42, 17),
    })
    await writer.appendEntry({ category: 'quotation', context: 'Quotation Q-1', message: 'First' })
    await rm(writer.folderPath, { recursive: true })

    await writer.appendEntry({ category: 'quotation', context: 'Quotation Q-1', message: 'Second' })

    await expect(readFile(
      path.join(writer.folderPath, 'quotation-activity-2026-08.log'),
      'utf8',
    )).resolves.toContain('Second')
  })

  it('removes only the oldest completed managed files when over the limit', async () => {
    const userDataPath = await createTemporaryUserDataFolder()
    const writer = createActivityHistoryWriter(userDataPath, {
      maxTotalBytes: 500,
      now: () => new Date(2026, 7, 30, 10, 42, 17),
    })
    await mkdir(writer.folderPath, { recursive: true })
    await writeFile(path.join(writer.folderPath, 'quotation-activity-2026-06.log'), 'x'.repeat(300))
    await writeFile(path.join(writer.folderPath, 'quotation-activity-2026-07.log'), 'x'.repeat(300))
    await writeFile(path.join(writer.folderPath, 'quotation-activity-2026-08.log'), 'current')
    await writeFile(path.join(writer.folderPath, 'quotation-activity-2026-09.log'), 'future')
    await writeFile(path.join(writer.folderPath, 'notes.txt'), 'unrelated')

    await writer.appendEntry({ category: 'quotation', context: 'Quotation Q-1', message: 'Current action' })

    const files = await readdir(writer.folderPath)
    expect(files).not.toContain('quotation-activity-2026-06.log')
    expect(files).toContain('quotation-activity-2026-08.log')
    expect(files).toContain('quotation-activity-2026-09.log')
    expect(files).toContain('notes.txt')
  })
})
