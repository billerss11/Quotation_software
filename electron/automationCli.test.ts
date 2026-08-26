import { describe, expect, it } from 'vitest'

import {
  findAutomationBatchPathConflict,
  getAutomationCliHelp,
  parseAutomationCliArguments,
} from './automationCli'

describe('parseAutomationCliArguments', () => {
  it('returns null for a normal desktop launch', () => {
    expect(parseAutomationCliArguments(['Quotation Software.exe'])).toBeNull()
  })

  it('parses validate and render commands', () => {
    expect(parseAutomationCliArguments([
      'Quotation Software.exe',
      '--automation',
      'validate',
      '--input',
      'quotation.json',
      '--result-json',
      'validation.json',
      '--progress-json',
      'validation-progress.json',
      '--cancel-file',
      'stop.cancel',
    ])).toEqual({
      kind: 'job',
      options: {
        command: 'validate',
        inputFile: 'quotation.json',
        resultJson: 'validation.json',
        progressJson: 'validation-progress.json',
        cancelFile: 'stop.cancel',
        timeoutMs: 30_000,
      },
    })

    expect(parseAutomationCliArguments([
      '--automation',
      'render',
      '--input',
      'quotation.json',
      '--quotation-pdf',
      'quotation.pdf',
      '--output-json',
      'normalized.json',
      '--refresh-exchange-rates',
      '--force',
      '--timeout-ms',
      '45000',
    ])).toEqual({
      kind: 'job',
      options: {
        command: 'render',
        inputFile: 'quotation.json',
        quotationPdf: 'quotation.pdf',
        outputJson: 'normalized.json',
        refreshExchangeRates: true,
        force: true,
        timeoutMs: 45_000,
      },
    })
  })

  it('parses batch and legacy headless export commands', () => {
    expect(parseAutomationCliArguments([
      '--automation', 'batch', '--manifest', 'jobs.json', '--no-network',
      '--progress-json', 'progress.json', '--cancel-file', 'stop.cancel',
    ])).toEqual({
      kind: 'batch',
      options: {
        command: 'batch',
        manifestFile: 'jobs.json',
        progressJson: 'progress.json',
        cancelFile: 'stop.cancel',
        noNetwork: true,
        timeoutMs: 30_000,
      },
    })

    expect(parseAutomationCliArguments([
      '--headless-export',
      '--input', 'quotation.json',
      '--goods-receipt-pdf', 'receipt.pdf',
    ])).toEqual({
      kind: 'job',
      options: {
        command: 'render',
        inputFile: 'quotation.json',
        goodsReceiptPdf: 'receipt.pdf',
        timeoutMs: 30_000,
      },
    })
  })

  it('supports help, version, and machine API information modes', () => {
    expect(parseAutomationCliArguments(['--help'])).toEqual({ kind: 'help' })
    expect(parseAutomationCliArguments(['--automation', 'version'])).toEqual({ kind: 'version' })
    expect(parseAutomationCliArguments(['--api-info'])).toEqual({ kind: 'api-info' })
    expect(parseAutomationCliArguments([
      '--automation', 'api-info', '--result-json', 'api-info.json',
    ])).toEqual({ kind: 'api-info', resultJson: 'api-info.json' })
    expect(getAutomationCliHelp()).toContain('--automation validate')
  })

  it('rejects unknown, duplicate, conflicting, and incomplete arguments', () => {
    expect(() => parseAutomationCliArguments([
      '--automation', 'validate', '--input', 'a.json', '--input', 'b.json',
    ])).toThrow('Duplicate automation flag')
    expect(() => parseAutomationCliArguments([
      '--automation', 'render', '--input', 'a.json', '--wat', 'x',
    ])).toThrow('Unknown automation flag')
    expect(() => parseAutomationCliArguments([
      '--automation', 'render', '--input', 'a.json', '--output-json', 'a-out.json',
      '--refresh-exchange-rates', '--no-network',
    ])).toThrow('cannot be used with')
    expect(() => parseAutomationCliArguments([
      '--automation', 'render', '--input', 'a.json',
    ])).toThrow('Render requires')
    expect(() => parseAutomationCliArguments([
      '--automation', 'batch', '--manifest', 'jobs.json', '--quotation-pdf', 'out.pdf',
    ])).toThrow('not valid for this automation command')
  })
})

describe('findAutomationBatchPathConflict', () => {
  const job = (id: string, inputFile: string, outputJson?: string) => ({
    id,
    options: {
      command: 'render' as const,
      inputFile,
      ...(outputJson ? { outputJson } : {}),
      timeoutMs: 30_000,
    },
  })

  it('allows jobs to reuse a read-only input path', () => {
    expect(findAutomationBatchPathConflict(
      { manifestFile: 'batch/manifest.json', resultJson: 'batch/result.json' },
      [job('one', 'input/quote.json', 'output/one.json'), job('two', 'input/quote.json', 'output/two.json')],
    )).toBeNull()
  })

  it('rejects duplicate outputs and outputs that overlap protected paths', () => {
    expect(findAutomationBatchPathConflict(
      { manifestFile: 'batch/manifest.json' },
      [job('one', 'input/one.json', 'output/shared.json'), job('two', 'input/two.json', 'output/shared.json')],
    )).toMatchObject({
      label: 'job two output JSON',
      previousLabel: 'job one output JSON',
    })

    expect(findAutomationBatchPathConflict(
      { manifestFile: 'batch/manifest.json', progressJson: 'input/two.json' },
      [job('two', 'input/two.json', 'output/two.json')],
    )).toMatchObject({
      label: 'batch progress JSON',
      previousLabel: 'job two input JSON',
    })
  })
})
