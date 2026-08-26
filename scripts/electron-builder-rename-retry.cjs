'use strict'

const fs = require('node:fs/promises')
const path = require('node:path')

const originalRename = fs.rename.bind(fs)
const retryableCodes = new Set(['EACCES', 'EBUSY', 'EPERM'])
const maxAttempts = 10

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

fs.rename = async function renameWithWindowsRetry(source, target) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await originalRename(source, target)
    } catch (error) {
      const sourcePath = String(source)
      const targetPath = String(target)
      const sourceName = path.basename(sourcePath)
      const targetName = path.basename(targetPath)
      const isBuilderStagingRename =
        path.dirname(sourcePath) === path.dirname(targetPath) &&
        sourceName.endsWith('.tmp') &&
        targetName === sourceName.slice(0, -4)
      const shouldRetry =
        process.platform === 'win32' &&
        isBuilderStagingRename &&
        retryableCodes.has(error?.code) &&
        attempt < maxAttempts

      if (!shouldRetry) {
        throw error
      }

      const delayMilliseconds = Math.min(250 * attempt, 2000)
      process.stderr.write(
        `[package] Windows temporarily blocked ${sourceName}; retrying in ${delayMilliseconds} ms (${attempt}/${maxAttempts - 1}).\n`,
      )
      await wait(delayMilliseconds)
    }
  }
}
