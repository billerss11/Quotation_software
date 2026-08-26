import path from 'node:path'

export const AUTOMATION_CLI_EXIT_CODES = {
  success: 0,
  usage: 2,
  input: 3,
  network: 4,
  filesystem: 5,
  render: 6,
  internal: 7,
} as const

export type AutomationCliExitCode = typeof AUTOMATION_CLI_EXIT_CODES[keyof typeof AUTOMATION_CLI_EXIT_CODES]

export interface AutomationJobOptions {
  command: 'validate' | 'render'
  inputFile: string
  quotationPdf?: string
  goodsReceiptPdf?: string
  outputJson?: string
  resultJson?: string
  progressJson?: string
  cancelFile?: string
  refreshExchangeRates?: true
  noNetwork?: true
  force?: true
  timeoutMs: number
}

export interface AutomationBatchOptions {
  command: 'batch'
  manifestFile: string
  resultJson?: string
  progressJson?: string
  cancelFile?: string
  noNetwork?: true
  force?: true
  timeoutMs: number
}

export type AutomationCliInvocation =
  | { kind: 'help' }
  | { kind: 'version' }
  | { kind: 'api-info'; resultJson?: string }
  | { kind: 'job'; options: AutomationJobOptions }
  | { kind: 'batch'; options: AutomationBatchOptions }

export interface AutomationBatchPathConflict {
  label: string
  previousLabel: string
  filePath: string
}

const DEFAULT_TIMEOUT_MS = 30_000
const AUTOMATION_FLAG = '--automation'
const LEGACY_HEADLESS_FLAG = '--headless-export'

const VALUE_FLAGS = new Set([
  '--input',
  '--manifest',
  '--quotation-pdf',
  '--goods-receipt-pdf',
  '--output-json',
  '--result-json',
  '--progress-json',
  '--cancel-file',
  '--timeout-ms',
])

const BOOLEAN_FLAGS = new Set([
  '--refresh-exchange-rates',
  '--no-network',
  '--force',
  '--overwrite',
  '--validate-only',
])

interface ParsedFlags {
  values: Map<string, string>
  booleans: Set<string>
}

export function parseAutomationCliArguments(args: readonly string[]): AutomationCliInvocation | null {
  const automationIndexes = findArgumentIndexes(args, AUTOMATION_FLAG)
  const legacyIndexes = findArgumentIndexes(args, LEGACY_HEADLESS_FLAG)
  const informationFlags = ['--help', '--version', '--api-info'].filter(flag => args.includes(flag))

  if (automationIndexes.length > 1) throw new Error('Duplicate --automation flag.')
  if (legacyIndexes.length > 1) throw new Error('Duplicate --headless-export flag.')
  if (automationIndexes.length && legacyIndexes.length) {
    throw new Error('Use --automation or --headless-export, not both.')
  }

  if (!automationIndexes.length && !legacyIndexes.length) {
    if (informationFlags.length === 0) return null
    if (informationFlags.length > 1) throw new Error('Use only one of --help, --version, or --api-info.')
    return parseInformationInvocation(informationFlags[0]!)
  }

  if (informationFlags.length > 0) {
    throw new Error('Place help, version, or API information directly after --automation.')
  }

  if (legacyIndexes.length) {
    const flags = parseFlags(args.slice(legacyIndexes[0]! + 1))
    const command = flags.booleans.has('--validate-only') ? 'validate' : 'render'
    return { kind: 'job', options: createJobOptions(command, flags, true) }
  }

  const automationIndex = automationIndexes[0]!
  const command = args[automationIndex + 1]
  if (!command || command.startsWith('--')) {
    if (command === '--help') return { kind: 'help' }
    throw new Error('--automation requires validate, render, batch, help, version, or api-info.')
  }

  if (command === 'help') return assertNoTrailingArguments(args, automationIndex + 2, { kind: 'help' })
  if (command === 'version') return assertNoTrailingArguments(args, automationIndex + 2, { kind: 'version' })
  if (command === 'api-info') {
    const flags = parseFlags(args.slice(automationIndex + 2))
    assertAllowedFlags(flags, ['--result-json'])
    const resultJson = flags.values.get('--result-json')
    return { kind: 'api-info', ...(resultJson ? { resultJson } : {}) }
  }
  if (command !== 'validate' && command !== 'render' && command !== 'batch') {
    throw new Error(`Unknown automation command: ${command}.`)
  }

  const flags = parseFlags(args.slice(automationIndex + 2))
  if (command === 'batch') {
    return { kind: 'batch', options: createBatchOptions(flags) }
  }
  return { kind: 'job', options: createJobOptions(command, flags, false) }
}

export function getAutomationCliHelp() {
  return [
    'Quotation Software automation CLI',
    '',
    'Usage:',
    '  Quotation Software.exe --automation validate --input <quotation.json> [options]',
    '  Quotation Software.exe --automation render --input <quotation.json> [outputs] [options]',
    '  Quotation Software.exe --automation batch --manifest <jobs.json> [options]',
    '  Quotation Software.exe --automation api-info [--result-json <path>]',
    '',
    'Outputs:',
    '  --quotation-pdf <path>       Export the quotation PDF.',
    '  --goods-receipt-pdf <path>   Export the pending goods-receipt PDF.',
    '  --output-json <path>          Save the normalized quotation JSON.',
    '  --result-json <path>          Save the execution report JSON.',
    '  --progress-json <path>        Atomically update machine-readable progress JSON.',
    '',
    'Options:',
    '  --refresh-exchange-rates     Refresh rates before validation/export.',
    '  --no-network                 Disable network-dependent phases.',
    '  --force, --overwrite         Allow replacing existing output files.',
    '  --timeout-ms <milliseconds>  Per-phase timeout (default: 30000).',
    '  --cancel-file <path>         Cancel safely when this file exists between phases.',
    '  --help                       Show this help.',
    '  --version                    Print the app version.',
    '  --api-info                   Print machine-readable API information.',
    '',
    'Legacy:',
    '  --headless-export remains an alias for --automation render.',
  ].join('\n')
}

export function findAutomationBatchPathConflict(
  controlPaths: {
    manifestFile: string
    resultJson?: string
    progressJson?: string
    cancelFile?: string
  },
  jobs: ReadonlyArray<{ id: string; options: AutomationJobOptions }>,
): AutomationBatchPathConflict | null {
  const protectedPaths = new Map<string, { label: string; sharedInput: boolean }>()

  const addProtectedPath = (label: string, filePath: string, sharedInput = false) => {
    const normalizedPath = normalizeAutomationPath(filePath)
    const previous = protectedPaths.get(normalizedPath)
    if (previous && !(previous.sharedInput && sharedInput)) {
      return { label, previousLabel: previous.label, filePath }
    }
    if (!previous) protectedPaths.set(normalizedPath, { label, sharedInput })
    return null
  }

  const manifestConflict = addProtectedPath('batch manifest', controlPaths.manifestFile)
  if (manifestConflict) return manifestConflict
  if (controlPaths.cancelFile) {
    const conflict = addProtectedPath('batch cancel file', controlPaths.cancelFile)
    if (conflict) return conflict
  }
  for (const job of jobs) {
    const conflict = addProtectedPath(`job ${job.id} input JSON`, job.options.inputFile, true)
    if (conflict) return conflict
  }

  const outputPaths = [
    ...(controlPaths.resultJson ? [{ label: 'batch result JSON', filePath: controlPaths.resultJson }] : []),
    ...(controlPaths.progressJson ? [{ label: 'batch progress JSON', filePath: controlPaths.progressJson }] : []),
    ...jobs.flatMap(({ id, options }) => [
      ...(options.quotationPdf ? [{ label: `job ${id} quotation PDF`, filePath: options.quotationPdf }] : []),
      ...(options.goodsReceiptPdf ? [{ label: `job ${id} goods-receipt PDF`, filePath: options.goodsReceiptPdf }] : []),
      ...(options.outputJson ? [{ label: `job ${id} output JSON`, filePath: options.outputJson }] : []),
    ]),
  ]
  const observedOutputs = new Map<string, string>()

  for (const output of outputPaths) {
    const normalizedPath = normalizeAutomationPath(output.filePath)
    const protectedPath = protectedPaths.get(normalizedPath)
    if (protectedPath) {
      return {
        label: output.label,
        previousLabel: protectedPath.label,
        filePath: output.filePath,
      }
    }
    const previousLabel = observedOutputs.get(normalizedPath)
    if (previousLabel) {
      return { label: output.label, previousLabel, filePath: output.filePath }
    }
    observedOutputs.set(normalizedPath, output.label)
  }

  return null
}

function normalizeAutomationPath(filePath: string) {
  return path.resolve(filePath).toLocaleLowerCase()
}

function parseInformationInvocation(flag: string): AutomationCliInvocation {
  if (flag === '--help') return { kind: 'help' }
  if (flag === '--version') return { kind: 'version' }
  return { kind: 'api-info' }
}

function parseFlags(args: readonly string[]): ParsedFlags {
  const values = new Map<string, string>()
  const booleans = new Set<string>()

  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index]!
    if (!flag.startsWith('--')) throw new Error(`Unexpected positional argument: ${flag}.`)
    if (!VALUE_FLAGS.has(flag) && !BOOLEAN_FLAGS.has(flag)) throw new Error(`Unknown automation flag: ${flag}.`)

    const logicalFlag = flag === '--overwrite' ? '--force' : flag
    if (values.has(logicalFlag) || booleans.has(logicalFlag)) throw new Error(`Duplicate automation flag: ${flag}.`)

    if (VALUE_FLAGS.has(flag)) {
      const value = args[index + 1]
      if (!value || value.startsWith('--')) throw new Error(`${flag} requires a value.`)
      values.set(logicalFlag, value)
      index += 1
    } else {
      booleans.add(logicalFlag)
    }
  }

  return { values, booleans }
}

function createJobOptions(
  command: 'validate' | 'render',
  flags: ParsedFlags,
  legacy: boolean,
): AutomationJobOptions {
  assertAllowedFlags(flags, command === 'render'
    ? [
        '--input', '--quotation-pdf', '--goods-receipt-pdf', '--output-json', '--result-json',
        '--progress-json', '--cancel-file', '--timeout-ms', '--refresh-exchange-rates', '--no-network', '--force',
        ...(legacy ? ['--validate-only'] : []),
      ]
    : [
        '--input', '--output-json', '--result-json', '--progress-json', '--cancel-file', '--timeout-ms', '--no-network', '--force',
        ...(legacy ? ['--validate-only'] : []),
      ])

  const inputFile = requireValue(flags, '--input')
  const quotationPdf = flags.values.get('--quotation-pdf')
  const goodsReceiptPdf = flags.values.get('--goods-receipt-pdf')
  const outputJson = flags.values.get('--output-json')
  const resultJson = flags.values.get('--result-json')
  const progressJson = flags.values.get('--progress-json')
  const cancelFile = flags.values.get('--cancel-file')
  const refreshExchangeRates = flags.booleans.has('--refresh-exchange-rates')
  const noNetwork = flags.booleans.has('--no-network')

  if (refreshExchangeRates && noNetwork) {
    throw new Error('--refresh-exchange-rates cannot be used with --no-network.')
  }
  if (command === 'render' && !quotationPdf && !goodsReceiptPdf && !outputJson) {
    throw new Error('Render requires --quotation-pdf, --goods-receipt-pdf, --output-json, or a combination.')
  }

  return {
    command,
    inputFile,
    ...(quotationPdf ? { quotationPdf } : {}),
    ...(goodsReceiptPdf ? { goodsReceiptPdf } : {}),
    ...(outputJson ? { outputJson } : {}),
    ...(resultJson ? { resultJson } : {}),
    ...(progressJson ? { progressJson } : {}),
    ...(cancelFile ? { cancelFile } : {}),
    ...(refreshExchangeRates ? { refreshExchangeRates: true as const } : {}),
    ...(noNetwork ? { noNetwork: true as const } : {}),
    ...(flags.booleans.has('--force') ? { force: true as const } : {}),
    timeoutMs: parseTimeout(flags.values.get('--timeout-ms')),
  }
}

function createBatchOptions(flags: ParsedFlags): AutomationBatchOptions {
  assertAllowedFlags(flags, [
    '--manifest', '--result-json', '--progress-json', '--cancel-file', '--timeout-ms', '--no-network', '--force',
  ])
  return {
    command: 'batch',
    manifestFile: requireValue(flags, '--manifest'),
    ...(flags.values.get('--result-json') ? { resultJson: flags.values.get('--result-json')! } : {}),
    ...(flags.values.get('--progress-json') ? { progressJson: flags.values.get('--progress-json')! } : {}),
    ...(flags.values.get('--cancel-file') ? { cancelFile: flags.values.get('--cancel-file')! } : {}),
    ...(flags.booleans.has('--no-network') ? { noNetwork: true as const } : {}),
    ...(flags.booleans.has('--force') ? { force: true as const } : {}),
    timeoutMs: parseTimeout(flags.values.get('--timeout-ms')),
  }
}

function assertAllowedFlags(flags: ParsedFlags, allowedFlags: readonly string[]) {
  for (const flag of [...flags.values.keys(), ...flags.booleans]) {
    if (!allowedFlags.includes(flag)) throw new Error(`${flag} is not valid for this automation command.`)
  }
}

function requireValue(flags: ParsedFlags, flag: string) {
  const value = flags.values.get(flag)
  if (!value) throw new Error(`Automation command requires ${flag} <path>.`)
  return value
}

function parseTimeout(value: string | undefined) {
  if (value === undefined) return DEFAULT_TIMEOUT_MS
  if (!/^\d+$/.test(value) || Number(value) <= 0 || Number(value) > 600_000) {
    throw new Error('--timeout-ms must be an integer from 1 to 600000.')
  }
  return Number(value)
}

function findArgumentIndexes(args: readonly string[], value: string) {
  return args.flatMap((argument, index) => argument === value ? [index] : [])
}

function assertNoTrailingArguments<T extends AutomationCliInvocation>(
  args: readonly string[],
  startIndex: number,
  invocation: T,
) {
  if (args.length > startIndex) throw new Error(`Unexpected argument: ${args[startIndex]}.`)
  return invocation
}
