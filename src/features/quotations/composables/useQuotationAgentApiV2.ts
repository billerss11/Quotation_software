import type { Ref } from 'vue'

import type {
  AutomationIssue,
  AutomationResult,
  QuotationAgentApiV2,
  QuotationAutomationApiInfo,
  QuotationAutomationHost,
  QuotationAutomationSnapshot,
  QuotationValidationReport,
  SerializedQuotation,
} from '@/shared/contracts/quotationAutomation'
import { QUOTATION_AUTOMATION_API_VERSION } from '@/shared/contracts/quotationAutomation'
import { SUPPORTED_LOCALES } from '@/shared/i18n/locale'
import type { QuotationRuntime } from '@/shared/runtime/quotationRuntime'
import { cloneSerializable } from '@/shared/utils/clone'

import { QUOTATION_TEMPLATE_IDS } from '../templates/templateIds'
import type { MajorItemSummary, QuotationDraft, QuotationTotals } from '../types'
import { MIXED_TAX_DOCUMENT_COLUMNS } from '../utils/quotationDocumentColumns'
import {
  createQuotationFileContent,
  parseQuotationFileContent,
  QUOTATION_FILE_SCHEMA_VERSION,
  QuotationFileError,
  type QuotationFileErrorCode,
} from '../utils/quotationFile'

interface UseQuotationAgentApiV2Options {
  quotation: Ref<QuotationDraft>
  itemSummaries: Ref<MajorItemSummary[]>
  totals: Ref<QuotationTotals>
  currentFilePath: Ref<string>
  runtime: Pick<QuotationRuntime, 'capabilities' | 'getAppVersion'>
  host?: QuotationAutomationHost
}

const SUPPORTED_TAX_MODES = ['single', 'mixed'] as const

export function useQuotationAgentApiV2(options: UseQuotationAgentApiV2Options): QuotationAgentApiV2 {
  let revision = 0
  let quotationFingerprint = createQuotationFingerprint(options.quotation.value)

  function currentRevision() {
    const nextFingerprint = createQuotationFingerprint(options.quotation.value)
    if (nextFingerprint !== quotationFingerprint) {
      revision += 1
      quotationFingerprint = nextFingerprint
    }

    return revision
  }

  async function getApiInfo(): Promise<QuotationAutomationApiInfo> {
    return {
      apiVersion: QUOTATION_AUTOMATION_API_VERSION,
      appVersion: await getAppVersion(options.runtime),
      quotationSchemaVersion: QUOTATION_FILE_SCHEMA_VERSION,
      capabilities: createCapabilities(options),
      supportedTemplates: [...QUOTATION_TEMPLATE_IDS],
      supportedLocales: [...SUPPORTED_LOCALES],
      supportedTaxModes: [...SUPPORTED_TAX_MODES],
      supportedMixedTaxColumns: [...MIXED_TAX_DOCUMENT_COLUMNS],
    }
  }

  return {
    getApiInfo,
    waitUntilReady: getApiInfo,
    async getQuotationSnapshot() {
      const snapshotRevision = currentRevision()
      const snapshot: QuotationAutomationSnapshot = {
        schemaVersion: QUOTATION_FILE_SCHEMA_VERSION,
        revision: snapshotRevision,
        currentFilePath: options.currentFilePath.value,
        quotation: cloneSerializable(options.quotation.value),
        itemSummaries: cloneSerializable(options.itemSummaries.value),
        totals: cloneSerializable(options.totals.value),
      }

      return createSuccessResult(snapshot, snapshotRevision)
    },
    async serializeQuotation() {
      const serializationRevision = currentRevision()

      try {
        const quotation = cloneSerializable(options.quotation.value)
        const serialized: SerializedQuotation = {
          schemaVersion: QUOTATION_FILE_SCHEMA_VERSION,
          quotation,
          content: createQuotationFileContent(quotation),
          revision: serializationRevision,
        }

        return createSuccessResult(serialized, serializationRevision)
      } catch (error) {
        return createFailureResult('internal_error', 'Unable to serialize the active quotation.', serializationRevision, error)
      }
    },
    async validateQuotation() {
      const validationRevision = currentRevision()

      try {
        return createSuccessResult(
          validateQuotationFileContent(createQuotationFileContent(options.quotation.value)),
          validationRevision,
        )
      } catch (error) {
        return createFailureResult('internal_error', 'Unable to validate the active quotation.', validationRevision, error)
      }
    },
    async validateQuotationContent(content: string) {
      const validationRevision = currentRevision()
      if (typeof content !== 'string') {
        return createFailureResult(
          'invalid_argument',
          'Quotation content must be a string.',
          validationRevision,
          undefined,
          'content',
        )
      }

      return createSuccessResult(validateQuotationFileContent(content), validationRevision)
    },
  }
}

function createCapabilities(options: UseQuotationAgentApiV2Options) {
  const { capabilities } = options.runtime

  return {
    host: options.host ?? resolveAutomationHost(capabilities.isDesktop),
    pathImport: capabilities.isDesktop,
    pathExport: capabilities.isDesktop,
    directPdfExport: capabilities.supportsDirectPdfExport,
    browserPrint: capabilities.supportsBrowserPrint,
    exchangeRateRefresh: true,
    goodsReceipt: true,
    batchOperations: false,
  }
}

function resolveAutomationHost(isDesktop: boolean): QuotationAutomationHost {
  if (!isDesktop) {
    return 'web-ui'
  }

  const locationHref = typeof window === 'undefined' ? '' : window.location?.href ?? ''
  if (locationHref) {
    const mode = new URL(locationHref).searchParams.get('mode')
    if (mode === 'automation') {
      return 'headless'
    }
  }

  return 'desktop-ui'
}

async function getAppVersion(runtime: UseQuotationAgentApiV2Options['runtime']) {
  try {
    return await runtime.getAppVersion()
  } catch {
    return 'unknown'
  }
}

function createQuotationFingerprint(quotation: QuotationDraft) {
  return JSON.stringify(quotation)
}

function validateQuotationFileContent(content: string): QuotationValidationReport {
  try {
    parseQuotationFileContent(content)
    return {
      valid: true,
      schemaVersion: QUOTATION_FILE_SCHEMA_VERSION,
      issues: [],
    }
  } catch (error) {
    if (!(error instanceof QuotationFileError)) {
      throw error
    }

    return {
      valid: false,
      schemaVersion: QUOTATION_FILE_SCHEMA_VERSION,
      issues: [createQuotationFileIssue(error.code)],
    }
  }
}

function createQuotationFileIssue(code: QuotationFileErrorCode): AutomationIssue {
  const issueDetails: Record<QuotationFileErrorCode, { message: string; fieldPath: string }> = {
    invalid_envelope: {
      message: 'The quotation file envelope is invalid.',
      fieldPath: '$',
    },
    unsupported_schema: {
      message: 'The quotation file schema version is not supported.',
      fieldPath: 'schemaVersion',
    },
    missing_quotation: {
      message: 'The quotation payload is missing.',
      fieldPath: 'quotation',
    },
    invalid_quotation: {
      message: 'The quotation payload is invalid.',
      fieldPath: 'quotation',
    },
    unsupported_currency: {
      message: 'The quotation currency is not supported.',
      fieldPath: 'quotation.header.currency',
    },
    not_object: {
      message: 'The quotation content must contain a JSON object.',
      fieldPath: '$',
    },
    invalid_json: {
      message: 'The quotation content is not valid JSON.',
      fieldPath: '$',
    },
  }
  const details = issueDetails[code]

  return {
    code,
    severity: 'error',
    message: details.message,
    fieldPath: details.fieldPath,
  }
}

function createSuccessResult<T>(data: T, revision: number): AutomationResult<T> {
  return {
    ok: true,
    data,
    meta: createMeta(revision),
  }
}

function createFailureResult<T>(
  code: string,
  message: string,
  revision: number,
  cause?: unknown,
  fieldPath?: string,
): AutomationResult<T> {
  return {
    ok: false,
    error: {
      code,
      message,
      ...(fieldPath ? { fieldPath } : {}),
      ...(cause ? { details: { cause: getErrorMessage(cause) } } : {}),
    },
    meta: createMeta(revision),
  }
}

function createMeta(revision: number) {
  return {
    requestId: crypto.randomUUID(),
    apiVersion: QUOTATION_AUTOMATION_API_VERSION,
    revision,
    warnings: [],
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}
