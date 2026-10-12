import { lstat, readFile, readdir, realpath, rm } from 'node:fs/promises'
import path from 'node:path'

// Only folders created by package-electron.mjs are eligible for removal.
const buildFolderPattern = /^\d+\.\d+\.\d+[^/\\]*-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-[A-Za-z0-9]{6}$/

function pathKey(directory) {
  const resolved = path.resolve(directory)
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved
}

async function checkBuildDirectory(releaseRoot, directory) {
  const root = path.resolve(releaseRoot)
  const target = path.resolve(directory)
  if (pathKey(path.dirname(target)) !== pathKey(root) || !buildFolderPattern.test(path.basename(target))) {
    throw new Error(`Refusing to remove a path outside the generated build folders: ${target}`)
  }
  if (pathKey(await realpath(root)) !== pathKey(root) || (await lstat(target)).isSymbolicLink()) {
    throw new Error(`Refusing to clean a linked release/build folder: ${target}`)
  }
  return target
}

export async function removeBuildDirectory(releaseRoot, directory) {
  const target = await checkBuildDirectory(releaseRoot, directory)
  await rm(target, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 })
}

export async function cleanReleaseOutput(releaseRoot, latestDirectory) {
  const root = path.resolve(releaseRoot)
  const latest = await checkBuildDirectory(root, latestDirectory)
  const keep = new Set([pathKey(latest)])
  let manifestContent
  try {
    manifestContent = await readFile(path.join(root, 'current-portable.json'), 'utf8')
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  if (manifestContent !== undefined) {
    // A broken record must stop cleanup before any deletion.
    const manifest = JSON.parse(manifestContent)
    if (typeof manifest.softwarePath !== 'string' || path.isAbsolute(manifest.softwarePath)
      || path.extname(manifest.softwarePath).toLowerCase() !== '.exe') {
      throw new Error('Current portable path must be a relative EXE path inside a generated build folder.')
    }
    // Installer builds must preserve the portable EXE used by the quotation skill.
    const current = path.resolve(root, manifest.softwarePath)
    const currentDirectory = await checkBuildDirectory(root, path.dirname(current))
    if (!(await lstat(current)).isFile()) {
      throw new Error('Current portable path must point to an existing regular EXE file.')
    }
    keep.add(pathKey(currentDirectory))
  }

  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || !buildFolderPattern.test(entry.name)) continue
    const directory = path.join(root, entry.name)
    if (!keep.has(pathKey(directory))) {
      await removeBuildDirectory(root, directory)
      console.log(`[package] Removed old build: ${directory}`)
      continue
    }

    await checkBuildDirectory(root, directory)
    const contents = await readdir(directory, { withFileTypes: true })
    // --dir builds need their unpacked app. Only remove it when a final EXE exists.
    if (!contents.some((file) => file.isFile() && file.name.toLowerCase().endsWith('.exe'))) continue
    for (const file of contents) {
      if (!file.isDirectory() || !/^win(?:-(?:ia32|arm64))?-unpacked$/.test(file.name)) continue
      const unpacked = path.resolve(directory, file.name)
      if (path.dirname(unpacked) !== directory) throw new Error(`Invalid unpacked path: ${unpacked}`)
      await rm(unpacked, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 })
      console.log(`[package] Removed unpacked working copy: ${unpacked}`)
    }
  }
}
