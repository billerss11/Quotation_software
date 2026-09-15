import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))
const { version } = JSON.parse(await readFile(path.join(projectRoot, 'package.json'), 'utf8'))
const releaseRoot = path.join(projectRoot, 'release')
const setCurrent = process.argv.includes('--set-current')
const builderArgs = process.argv.slice(2).filter((arg) => arg !== '--set-current')
if (setCurrent && (builderArgs.join(' ') !== '--win portable')) {
  throw new Error('--set-current requires exactly --win portable.')
}
// UTC timestamp sorts builds chronologically; mkdtemp prevents directory reuse.
const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
await mkdir(releaseRoot, { recursive: true })
const outputDirectory = await mkdtemp(path.join(releaseRoot, `${version}-${timestamp}-`))

console.log(`[package] Output: ${outputDirectory}`)

const child = spawn(process.execPath, [
  '--require', path.join(projectRoot, 'scripts/electron-builder-rename-retry.cjs'),
  path.join(projectRoot, 'node_modules/electron-builder/out/cli/cli.js'),
  ...builderArgs,
  `--config.directories.output=${outputDirectory}`,
], {
  cwd: projectRoot,
  stdio: 'inherit',
  shell: false,
})

child.on('error', (error) => {
  console.error(`[package] Failed to start electron-builder: ${error.message}`)
  process.exitCode = 1
})

child.on('exit', async (code) => {
  process.exitCode = code ?? 1
  console.log(code === 0
    ? `[package] Build complete: ${outputDirectory}`
    : `[package] Build failed. Partial output: ${outputDirectory}`)
  if (code === 0 && setCurrent) {
    try {
      await setCurrentPortable()
    } catch (error) {
      console.error(`[package] Current version was not updated: ${error.message}`)
      process.exitCode = 1
    }
  }
})

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
