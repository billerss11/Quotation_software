import { rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const electronOutputDirectory = path.join(projectRoot, 'dist-electron')

await rm(electronOutputDirectory, { force: true, recursive: true })
