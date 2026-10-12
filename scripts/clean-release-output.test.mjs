import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { cleanReleaseOutput, removeBuildDirectory } from './clean-release-output.mjs'

const oldName = '0.1.0-2026-09-16T02-00-23-381Z-XNSqAh'
const newName = '0.1.0-2026-10-12T02-00-23-381Z-NEW123'

async function setup(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'quotation-release-test-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const release = path.join(root, 'release')
  await mkdir(release)
  for (const name of [oldName, newName]) {
    await mkdir(path.join(release, name, 'win-unpacked'), { recursive: true })
    await writeFile(path.join(release, name, 'win-unpacked', 'runtime.dll'), 'working copy')
    await writeFile(path.join(release, name, 'app.exe'), 'packaged app')
  }
  return { root, release, latest: path.join(release, newName), old: path.join(release, oldName) }
}

async function selectPortable(release, folder) {
  await writeFile(path.join(release, 'current-portable.json'), JSON.stringify({
    softwarePath: path.join(folder, 'app.exe'),
  }))
}

test('keeps only the newly selected portable EXE and leaves unrelated files alone', async (t) => {
  const { release, latest } = await setup(t)
  await selectPortable(release, newName)
  await mkdir(path.join(release, 'manual-backup'))
  await writeFile(path.join(release, 'notes.txt'), 'keep')
  await cleanReleaseOutput(release, latest)
  assert.deepEqual((await readdir(release)).sort(), [newName, 'current-portable.json', 'manual-backup', 'notes.txt'].sort())
  assert.deepEqual(await readdir(latest), ['app.exe'])
  assert.equal(await readFile(path.join(latest, 'app.exe'), 'utf8'), 'packaged app')
  // Repeated cleanup is safe.
  await cleanReleaseOutput(release, latest)
})

test('installer cleanup preserves the current portable and drops its unpacked copy', async (t) => {
  const { release, latest, old } = await setup(t)
  await selectPortable(release, oldName)
  await cleanReleaseOutput(release, latest)
  assert.deepEqual(await readdir(old), ['app.exe'])
  assert.deepEqual(await readdir(latest), ['app.exe'])
})

test('preserves the selected portable with different Windows path casing', { skip: process.platform !== 'win32' }, async (t) => {
  const { release, latest, old } = await setup(t)
  await selectPortable(release, oldName.toUpperCase())
  await cleanReleaseOutput(release, latest)
  assert.deepEqual(await readdir(old), ['app.exe'])
})

test('a broken, missing-target, or out-of-bounds manifest stops cleanup before any deletion', async (t) => {
  const { release, latest, old } = await setup(t)
  const manifestPath = path.join(release, 'current-portable.json')
  const invalidPaths = ['../app.exe', 'app.exe', oldName, path.join(oldName, 'missing.exe')]
  for (const content of ['{broken', ...invalidPaths.map((softwarePath) => JSON.stringify({ softwarePath }))]) {
    await writeFile(manifestPath, content)
    await assert.rejects(cleanReleaseOutput(release, latest))
    assert.ok((await readdir(old)).includes('win-unpacked'))
    assert.ok((await readdir(latest)).includes('win-unpacked'))
  }
})

test('failed-build cleanup removes only its staging folder', async (t) => {
  const { release, latest, old } = await setup(t)
  await selectPortable(release, oldName)
  const manifestBefore = await readFile(path.join(release, 'current-portable.json'), 'utf8')
  await removeBuildDirectory(release, latest)
  assert.equal(await readFile(path.join(old, 'app.exe'), 'utf8'), 'packaged app')
  assert.equal(await readFile(path.join(release, 'current-portable.json'), 'utf8'), manifestBefore)
})

test('refuses deleting outside release, release itself, or a linked build folder', async (t) => {
  const { root, release, latest } = await setup(t)
  const outside = path.join(root, oldName)
  await mkdir(outside)
  await writeFile(path.join(outside, 'keep.txt'), 'keep')
  await assert.rejects(removeBuildDirectory(release, outside))
  await assert.rejects(removeBuildDirectory(release, release))
  const linked = path.join(release, '0.1.0-2026-09-01T02-00-23-381Z-LINK12')
  await symlink(outside, linked, process.platform === 'win32' ? 'junction' : 'dir')
  await assert.rejects(removeBuildDirectory(release, linked))
  await cleanReleaseOutput(release, latest)
  assert.equal(await readFile(path.join(outside, 'keep.txt'), 'utf8'), 'keep')
})
