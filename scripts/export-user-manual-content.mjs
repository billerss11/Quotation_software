// Document authoring only. Run with Node 24 and the bundled workspace packages.
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { manualSections } from '../src/features/user-manual/manualSections.ts'
import { enUsUserManual, zhCnUserManual } from '../src/shared/i18n/userManualMessages.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
const [packageDirectory, outputFile] = process.argv.slice(2)
if (!packageDirectory || !outputFile) {
  throw new Error('Usage: node scripts/export-user-manual-content.mjs <workspace-node-modules> <output.json>')
}
const require = createRequire(path.join(path.resolve(packageDirectory), 'package.json'))
const { marked } = require('marked')
const locales = {}
for (const [locale, messages, filename] of [
  ['en-US', enUsUserManual, 'user-manual.md'],
  ['zh-CN', zhCnUserManual, 'user-manual.zh-CN.md'],
]) {
  let markdown
  try {
    markdown = await readFile(path.join(root, 'docs', filename), 'utf8')
  } catch (error) {
    if (error.code === 'ENOENT' && locale === 'zh-CN') continue
    throw error
  }
  const tokens = marked.lexer(markdown)
  const firstSection = tokens.findIndex(token => token.type === 'heading' && token.depth === 2 && /^1[.\s、]/.test(token.text))
  if (firstSection < 0) throw new Error(`Missing numbered reference sections: ${filename}`)
  locales[locale] = { messages, reference: tokens.slice(firstSection), source: `docs/${filename}` }
}
await mkdir(path.dirname(path.resolve(outputFile)), { recursive: true })
await writeFile(outputFile, JSON.stringify({ root, sections: manualSections, locales }, null, 2))
console.log(`Exported document content for ${Object.keys(locales).join(', ')}`)
