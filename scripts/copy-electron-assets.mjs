import { mkdir, copyFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const source = path.join(projectRoot, 'electron', 'preload.cjs')
const targetDirectory = path.join(projectRoot, 'dist-electron', 'electron')
const target = path.join(targetDirectory, 'preload.cjs')

await mkdir(targetDirectory, { recursive: true })
await copyFile(source, target)
