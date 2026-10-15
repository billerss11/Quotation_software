// Read-only source verification; outputs are created exclusively in a caller-selected folder.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createServer } from 'vite'

const [inputPath, skillPath, outputPath] = process.argv.slice(2)
if (!inputPath || !skillPath || !outputPath) {
  throw new Error('Usage: node scripts/verify-shared-image-migration.mjs <legacy.json> <skill-folder> <output-folder>')
}
const root = fileURLToPath(new URL('..', import.meta.url))
const sourcePath = path.resolve(inputPath)
const outputDirectory = path.resolve(outputPath)
const raw = await readFile(sourcePath)
const digest = (value) => createHash('sha256').update(value).digest('hex')
const sourceHash = digest(raw)
const legacy = JSON.parse(raw.toString('utf8'))
assert.equal(legacy.schemaVersion, 3, 'This migration regression requires a schema-3 file with history')
const skill = await import(pathToFileURL(path.resolve(skillPath, 'scripts/quotation-json.mjs')).href)
const server = await createServer({ root, server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' })

try {
  const { createQuotationFileContent: serialize, parseQuotationDocumentContent: parse } =
    await server.ssrLoadModule('/src/features/quotations/utils/quotationFile.ts')
  const { proposeQuotationRevision } = await server.ssrLoadModule('/src/features/quotations/utils/quotationRevisions.ts')
  const original = parse(raw.toString('utf8'))
  const persistedWorkingQuotation = JSON.parse(JSON.stringify(original.quotation))
  assert.deepEqual(original.revisions, legacy.revisions, 'Import must preserve every raw archived snapshot')
  const content = serialize(original.quotation, original.revisions)
  const optimized = JSON.parse(content)
  assert.equal(optimized.schemaVersion, 4)
  assert.deepEqual(parse(content), original, 'App save and reopen must preserve the complete document')
  assert.deepEqual(skill.validateQuotationEnvelope(optimized).errors, [], 'Skill must accept app output')
  const decoded = skill.decodeQuotationEnvelope(optimized)
  assert.deepEqual(decoded.revisions, legacy.revisions, 'Skill must resolve original archived images and values')
  assert.deepEqual(decoded.quotation, persistedWorkingQuotation, 'Skill must resolve all persisted working quotation values')

  const built = skill.buildQuotationEnvelope(legacy, new Date(legacy.exportedAt))
  assert.deepEqual(skill.validateQuotationEnvelope(built.envelope).errors, [])
  assert.deepEqual(parse(JSON.stringify(built.envelope)), original, 'App must read skill conversion without data loss')
  assert.deepEqual(skill.summarizeQuotationEnvelope(optimized), skill.summarizeQuotationEnvelope(legacy), 'Totals must not change')

  const snapshots = [original.quotation, ...original.revisions.map(revision => revision.quotation)]
  const uniqueLogos = new Set(snapshots.map(quotation => quotation.branding.logoDataUrl).filter(Boolean))
  assert.deepEqual(new Set(Object.values(optimized.images)), uniqueLogos, 'Exactly one copy of each original logo')
  for (const quotation of [optimized.quotation, ...optimized.revisions.map(revision => revision.quotation)]) {
    assert.ok(!('logoDataUrl' in quotation.branding), 'No inline logo in persisted v4 snapshots')
    assert.ok(quotation.branding.logoImageId === null || Object.hasOwn(optimized.images, quotation.branding.logoImageId))
  }

  const now = new Date().toISOString()
  const created = proposeQuotationRevision(original, { note: 'Migration verification' }, now)
  assert.deepEqual(JSON.parse(JSON.stringify(parse(serialize(created.quotation, created.revisions)))), created)
  assert.deepEqual(created.revisions.slice(0, -1), original.revisions)
  assert.deepEqual(created.revisions.at(-1).quotation, persistedWorkingQuotation, 'App must archive all persisted working values')
  const skillCreated = skill.createQuotationRevisionInEnvelope(optimized, { note: 'Migration verification' }, new Date(now))
  const skillCreatedDocument = parse(JSON.stringify(skillCreated.envelope))
  assert.deepEqual(skillCreatedDocument.revisions.slice(0, -1), original.revisions)
  assert.deepEqual(skillCreatedDocument.revisions.at(-1).quotation, persistedWorkingQuotation, 'Skill must archive all persisted working values')

  let restoredCount = 0
  for (const revision of original.revisions) {
    const restored = proposeQuotationRevision(original, { restoreRevisionId: revision.id }, now)
    const reopened = parse(serialize(restored.quotation, restored.revisions))
    assert.deepEqual(JSON.parse(JSON.stringify(reopened)), restored, `App restoration roundtrip: ${revision.id}`)
    assert.equal(reopened.quotation.branding.logoDataUrl, revision.quotation.branding.logoDataUrl)
    assert.deepEqual(reopened.revisions.slice(0, -1), original.revisions)
    const skillRestored = skill.restoreQuotationRevisionInEnvelope(optimized, revision.id, new Date(now))
    const skillReopened = parse(JSON.stringify(skillRestored.envelope))
    // Generated archive IDs differ; all quotation content and existing history must agree.
    assert.deepEqual(skillReopened.quotation, reopened.quotation)
    assert.deepEqual(skillReopened.revisions.slice(0, -1), original.revisions)
    const deleted = skill.deleteQuotationRevisionFromEnvelope(optimized, revision.id, new Date(now))
    const deletedDocument = parse(JSON.stringify(deleted.envelope))
    const expectedAfterDelete = structuredClone(original.quotation)
    expectedAfterDelete.metadata.updatedAt = now
    assert.deepEqual(deletedDocument.quotation, expectedAfterDelete)
    assert.deepEqual(deletedDocument.revisions, original.revisions.filter(entry => entry.id !== revision.id))
    restoredCount++
  }
  assert.equal(digest(await readFile(sourcePath)), sourceHash, 'Source file must remain byte-for-byte unchanged')
  const report = {
    ok: true,
    sourcePath,
    sourceSha256: sourceHash,
    sourceUnchanged: true,
    sourceBytes: raw.length,
    optimizedBytes: Buffer.byteLength(content),
    reductionPercent: Number(((1 - Buffer.byteLength(content) / raw.length) * 100).toFixed(2)),
    archivedRevisions: original.revisions.length,
    restoredAndDeletedRevisionsChecked: restoredCount,
    uniqueImages: uniqueLogos.size,
    checks: ['legacy history preserved exactly', 'app and skill cross-import', 'all revision restorations', 'revision deletion', 'unchanged totals', 'exact logo bytes', 'source unchanged'],
    builderWarnings: built.warnings,
  }
  await mkdir(outputDirectory, { recursive: true })
  await writeFile(path.join(outputDirectory, 'quotation.optimized.json'), content, { flag: 'wx' })
  await writeFile(path.join(outputDirectory, 'quotation.skill.json'), `${JSON.stringify(built.envelope, null, 2)}\n`, { flag: 'wx' })
  await writeFile(path.join(outputDirectory, 'migration-report.json'), `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' })
  console.log(JSON.stringify(report, null, 2))
} catch (error) {
  // Avoid dumping customer quotation data or multi-megabyte images on a failed assertion.
  if (error instanceof assert.AssertionError) {
    const location = error.stack.split('\n').filter(line => line.trim().startsWith('at ')).slice(0,2).join('\n')
    throw new Error(`${error.message.split('\n')[0]}\n${location}`)
  }
  throw error
} finally {
  await server.close()
}
