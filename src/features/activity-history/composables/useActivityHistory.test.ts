// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createInitialQuotation } from '@/features/quotations/utils/quotationDraft'
import { createQuotationFieldChangeSummary } from '@/features/quotations/utils/quotationHistoryChangeSummary'
import { createAppI18n } from '@/shared/i18n/createAppI18n'
import type { QuotationRuntime } from '@/shared/runtime/quotationRuntime'

import { useActivityHistory } from './useActivityHistory'

describe('useActivityHistory', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('writes quotation summaries in English even when the interface is Chinese', async () => {
    const appendActivityHistoryEntry = vi.fn().mockResolvedValue({ ok: true, folderPath: 'history' })
    const quotation = createInitialQuotation([], 'en-US', { quotationNumber: 'Q-2026-0042' })
    const runtime = createRuntime(appendActivityHistoryEntry)

    mount(defineComponent({
      setup() {
        const activityHistory = useActivityHistory({ runtime })
        activityHistory.recordQuotationHistory({
          action: 'change',
          summary: createQuotationFieldChangeSummary(
            'header:projectName',
            'quotations.history.fields.projectName',
            'Old project',
            'New project',
          ),
        }, quotation)
        return () => null
      },
    }), {
      global: { plugins: [createAppI18n('zh-CN')] },
    })
    await Promise.resolve()

    expect(appendActivityHistoryEntry).toHaveBeenCalledWith({
      category: 'quotation',
      context: 'Quotation Q-2026-0042',
      message: 'Project name: Old project -> New project',
    })
  })

  it('ignores fallback summaries and all activity in web builds', () => {
    const desktopAppend = vi.fn()
    const webAppend = vi.fn()
    const quotation = createInitialQuotation([], 'en-US')

    mount(defineComponent({
      setup() {
        useActivityHistory({ runtime: createRuntime(desktopAppend) }).recordQuotationHistory({
          action: 'change',
          summary: { kind: 'fallback' },
        }, quotation)
        useActivityHistory({ runtime: createRuntime(webAppend, false) }).recordMessage(
          'quotation',
          'Quotation Q-1',
          'quotations.activityHistory.log.created',
        )
        return () => null
      },
    }), {
      global: { plugins: [createAppI18n('en-US')] },
    })

    expect(desktopAppend).not.toHaveBeenCalled()
    expect(webAppend).not.toHaveBeenCalled()
  })

  it('never lets a synchronous bridge failure escape into the business action', () => {
    const appendActivityHistoryEntry = vi.fn(() => {
      throw new Error('bridge unavailable')
    })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    expect(() => {
      mount(defineComponent({
        setup() {
          useActivityHistory({ runtime: createRuntime(appendActivityHistoryEntry) }).recordMessage(
            'quotation',
            'Quotation Q-1',
            'quotations.activityHistory.log.created',
          )
          return () => null
        },
      }), {
        global: { plugins: [createAppI18n('en-US')] },
      })
    }).not.toThrow()
    expect(warn).toHaveBeenCalledWith(
      'Could not write activity history.',
      expect.objectContaining({ message: 'bridge unavailable' }),
    )
  })
})

function createRuntime(appendActivityHistoryEntry: ReturnType<typeof vi.fn>, isDesktop = true) {
  return {
    capabilities: { isDesktop },
    appendActivityHistoryEntry,
    openActivityHistoryFolder: vi.fn(),
  } as unknown as QuotationRuntime
}
