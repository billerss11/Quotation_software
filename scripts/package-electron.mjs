import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, open, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { cleanReleaseOutput, removeBuildDirectory } from './clean-release-output.mjs'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))
const { version } = JSON.parse(await readFile(path.join(projectRoot, 'package.json'), 'utf8'))
const releaseRoot = path.join(projectRoot, 'release')
const setCurrent = process.argv.includes('--set-current')
const builderArgs = process.argv.slice(2).filter((arg) => arg !== '--set-current')
if (setCurrent && (builderArgs.join(' ') !== '--win portable')) {
  throw new Error('--set-current requires exactly --win portable.')
}
await mkdir(releaseRoot, { recursive: true })
// Serialize packaging so cleanup cannot remove another build in progress.
const lockPath = path.join(releaseRoot, '.package.lock')
const lock = await open(lockPath, 'wx').catch((error) => {
  if (error.code === 'EEXIST') {
    throw new Error('Packaging is already running. If it was interrupted, remove release/.package.lock after confirming no build is running.')
  }
  throw error
})
let outputDirectory
let buildSucceeded = false
try {
  // Stage separately so a failed build never overwrites the last working EXE.
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  outputDirectory = await mkdtemp(path.join(releaseRoot, `${version}-${timestamp}-`))
  console.log(`[package] Output: ${outputDirectory}`)
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      '--require', path.join(projectRoot, 'scripts/electron-builder-rename-retry.cjs'),
      path.join(projectRoot, 'node_modules/electron-builder/out/cli/cli.js'),
      ...builderArgs,
      // Reuse the installed runtime to avoid Windows locks on archive staging folders.
      ...(process.platform === 'win32' && builderArgs.includes('--win')
        ? [`--config.electronDist=${path.join(projectRoot, 'node_modules/electron/dist')}`]
        : []),
      `--config.directories.output=${outputDirectory}`,
    ], {
      cwd: projectRoot,
      stdio: 'inherit',
      shell: false,
    })
    child.on('error', reject)
    child.on('close', (code) => code === 0
      ? resolve()
      : reject(new Error(`electron-builder failed (exit ${code}).`)))
  })
  if (setCurrent) await setCurrentPortable()
  buildSucceeded = true
  console.log(`[package] Build complete: ${outputDirectory}`)
  await cleanReleaseOutput(releaseRoot, outputDirectory)
} catch (error) {
  console.error(buildSucceeded
    ? `[package] Build succeeded, but cleanup failed: ${error.message}. Close apps using old build folders and retry.`
    : `[package] Build failed; the previous current version was kept: ${error.message}`)
  process.exitCode = 1
} finally {
  if (outputDirectory && !buildSucceeded) {
    await removeBuildDirectory(releaseRoot, outputDirectory).catch((error) => {
      console.error(`[package] Could not remove partial output ${outputDirectory}: ${error.message}`)
    })
  }
  await lock.close()
  await unlink(lockPath)
}

async function setCurrentPortable() {
  // Only this successful portable build's top-level artifact is eligible.
  const executables = (await readdir(outputDirectory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.exe'))
  if (executables.length !== 1) throw new Error('Expected exactly one portable EXE in the build output.')
  const executablePath = path.join(outputDirectory, executables[0].name)
  const probePath = path.join(outputDirectory, 'automation-api-info.json')
  await new Promise((resolve, reject) => {
    const probe = spawn(executablePath, ['--automation', 'api-info', '--result-json', probePath], {
      cwd: projectRoot,
      stdio: 'ignore',
      windowsHide: true,
      timeout: 60_000,
    })
    probe.on('error', reject)
    probe.on('close', (code) => code === 0
      ? resolve()
      : reject(new Error(`Automation API probe failed (exit ${code}).`)))
  })
  const apiInfo = JSON.parse(await readFile(probePath, 'utf8'))
  if (typeof apiInfo.apiVersion !== 'string' || !/^\d+\./.test(apiInfo.apiVersion)
    || Number(apiInfo.apiVersion.split('.')[0]) < 2 || apiInfo.appVersion !== version) {
    throw new Error('Portable EXE returned an incompatible API or unexpected application version.')
  }
  const manifestPath = path.join(releaseRoot, 'current-portable.json')
  const temporaryPath = `${manifestPath}.${path.basename(outputDirectory)}.tmp`
  try {
    await writeFile(temporaryPath, `${JSON.stringify({
      schemaVersion: 1,
      softwarePath: path.relative(releaseRoot, executablePath),
      appVersion: version,
      builtAt: new Date().toISOString(),
    }, null, 2)}\n`, 'utf8')
    await rename(temporaryPath, manifestPath)
  } finally {
    await unlink(temporaryPath).catch(() => undefined)
  }
  console.log(`[package] Current portable: ${executablePath}`)
  console.log(`[package] Version record: ${manifestPath}`)
}
