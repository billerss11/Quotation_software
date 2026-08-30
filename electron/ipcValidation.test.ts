import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'

import { AUTOMATION_LIMITS } from '../src/shared/contracts/automationLimits.js'

import {
  isDevAutoImportQuotationFileName,
  parseActivityHistoryEntry,
  parseGoodsReceiptPdfOptions,
  isTrustedRendererUrl,
  parsePdfJobId,
  parseQuotationPdfOptions,
  parseSaveFileOptions,
  resolveAllowedFilePath,
} from './ipcValidation.js'

describe('Electron IPC validation', () => {
  it('accepts only well-formed activity history entries', () => {
    expect(parseActivityHistoryEntry({
      category: 'quotation',
      context: 'Quotation Q-1',
      message: 'Saved quotation',
    })).toEqual({
      category: 'quotation',
      context: 'Quotation Q-1',
      message: 'Saved quotation',
    })
    expect(() => parseActivityHistoryEntry({
      category: 'security',
      context: 'Quotation Q-1',
      message: 'Changed',
    })).toThrow(/invalid/i)
    expect(() => parseActivityHistoryEntry({
      category: 'quotation',
      context: '',
      message: 'Changed',
    })).toThrow(/context/i)
  })

  it('selects quotation JSON files for dev auto-import but excludes backups', () => {
    expect(isDevAutoImportQuotationFileName('Q-2026-048.json')).toBe(true)
    expect(isDevAutoImportQuotationFileName('Q-2026-048.JSON')).toBe(true)
    expect(isDevAutoImportQuotationFileName('Q-2026-048.backup.json')).toBe(false)
    expect(isDevAutoImportQuotationFileName('Q-2026-048.json.tmp')).toBe(false)
  })

  it('accepts bounded text saves with an allowed extension', () => {
    const result = parseSaveFileOptions({
      filePath: 'quotation.json',
      content: '{}',
    }, ['.json'])

    expect(result.filePath).toBe(path.resolve('quotation.json'))
    expect(result.content).toBe('{}')
  })

  it('rejects mismatched file extensions and invalid save payloads', () => {
    expect(() => parseSaveFileOptions({ filePath: 'quotation.exe', content: '{}' }, ['.json'])).toThrow(/extension/i)
    expect(() => parseSaveFileOptions({ filePath: 'quotation.json', content: 42 }, ['.json'])).toThrow(/invalid/i)
    expect(() => resolveAllowedFilePath('items.json', ['.csv'])).toThrow(/extension/i)
  })

  it('reports the configured text-file size limit', () => {
    expect(() => parseSaveFileOptions({
      filePath: 'quotation.json',
      content: 'x'.repeat(AUTOMATION_LIMITS.quotationJsonBytes + 1),
    }, ['.json'])).toThrow('10 MB limit')
  })

  it('allows only XLSX paths for the static Excel template', () => {
    expect(resolveAllowedFilePath('quotation-line-items-template.xlsx', ['.xlsx'])).toBe(
      path.resolve('quotation-line-items-template.xlsx'),
    )
    expect(() => resolveAllowedFilePath('quotation-line-items-template.xlsm', ['.xlsx'])).toThrow(/extension/i)
  })

  it('validates PDF job identifiers', () => {
    expect(parsePdfJobId('98c9939a-6f1c-4ff3-8b3c-e31f8ed1cc3c')).toBe('98c9939a-6f1c-4ff3-8b3c-e31f8ed1cc3c')
    expect(() => parsePdfJobId('../job')).toThrow(/invalid/i)
  })

  it('rejects incomplete PDF payloads before they reach the print window', () => {
    expect(() => parseQuotationPdfOptions({ defaultFileName: 'quote.pdf' })).toThrow(/invalid/i)
    expect(() => parseGoodsReceiptPdfOptions({ defaultFileName: 'receipt.pdf' })).toThrow(/invalid/i)
  })

  it('bounds the complete PDF IPC payload', () => {
    const oversizedText = 'x'.repeat(AUTOMATION_LIMITS.quotationJsonBytes * 2)

    expect(() => parseQuotationPdfOptions({
      quotation: { branding: { logoDataUrl: '' } },
      summaries: [{ oversizedText }],
      totals: {},
      exchangeRates: {},
      companyProfile: {},
      defaultFileName: 'quote.pdf',
    })).toThrow(/Quotation PDF payload exceeds/i)

    expect(() => parseGoodsReceiptPdfOptions({
      draft: {},
      branding: { logoDataUrl: '', oversizedText },
      defaultFileName: 'receipt.pdf',
    })).toThrow(/Goods-receipt PDF payload exceeds/i)
  })

  it('accepts only the configured renderer origin or packaged entry file', () => {
    const packagedEntryPath = path.resolve('dist/index.html')

    expect(isTrustedRendererUrl('http://127.0.0.1:5173/?mode=print', {
      devServerUrl: 'http://127.0.0.1:5173',
      packagedEntryPath,
    })).toBe(true)
    expect(isTrustedRendererUrl('https://example.com/', {
      devServerUrl: 'http://127.0.0.1:5173',
      packagedEntryPath,
    })).toBe(false)
    expect(isTrustedRendererUrl(`${pathToFileURL(packagedEntryPath).toString()}?mode=print`, {
      packagedEntryPath,
    })).toBe(true)
  })
})
