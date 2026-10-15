import Aura from '@primevue/themes/aura'
import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import Tooltip from 'primevue/tooltip'
import { describe, expect, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import '@/assets/main.css'
import { createAppI18n } from '@/shared/i18n/createAppI18n'

import { createInitialQuotation } from '../utils/quotationDraft'
import QuotationCommandBar from './QuotationCommandBar.vue'

describe('QuotationCommandBar tooltips', () => {
  it.each(['en-US', 'zh-CN'] as const)('keeps the viewport stable while showing %s action tooltips', async (locale) => {
    await page.viewport(1440, 900)
    const host = document.createElement('div')
    host.style.cssText = 'height: 100vh; padding: 10px 12px 0 88px; overflow: hidden;'
    document.body.appendChild(host)
    const i18n = createAppI18n(locale)
    const wrapper = mount(QuotationCommandBar, {
      attachTo: host,
      props: {
        header: createInitialQuotation([], locale).header,
        statusMessage: '',
        currentFilePath: '',
        hasNativeFileDialogs: false,
        supportsDirectPdfExport: false,
        workspaceMode: 'editor',
        hasImportReport: false,
        importReportIssueCount: 0,
        importReportHasErrors: false,
        hasGoodsReceiptItems: true,
      },
      global: {
        plugins: [i18n, [PrimeVue, { theme: { preset: Aura } }]],
        directives: { tooltip: Tooltip },
      },
    })
    const pageSize = () => ({
      width: document.documentElement.clientWidth,
      height: document.documentElement.scrollHeight,
      commandBarWidth: wrapper.element.getBoundingClientRect().width,
    })
    const baseline = pageSize()
    const insertionSizes: ReturnType<typeof pageSize>[] = []
    const appendChild = document.body.appendChild.bind(document.body)
    const appendSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => {
      const result = appendChild(node)
      if (node instanceof HTMLElement && node.classList.contains('p-tooltip')) {
        // Sample insertion too: the temporary overflow is gone by the next frame.
        insertionSizes.push(pageSize())
      }
      return result
    })
    try {
      for (const key of ['download', 'preview']) {
        const name = i18n.global.t(`quotations.commandBar.${key}`)
        await userEvent.hover(page.getByRole('button', { name, exact: true }))
        await vi.waitFor(() => expect(document.querySelector('[role="tooltip"]')).not.toBeNull())
        expect(pageSize()).toEqual(baseline)
        const tooltip = document.querySelector<HTMLElement>('[role="tooltip"]')!
        const button = wrapper.findAll('button').find(button => button.text() === name)!.element
        expect(tooltip.textContent).toContain(name)
        expect(Math.abs(tooltip.getBoundingClientRect().top - button.getBoundingClientRect().bottom)).toBeLessThanOrEqual(1)
        await userEvent.hover(page.getByText(i18n.global.t('quotations.commandBar.untitled'), { exact: true }))
        await vi.waitFor(() => expect(document.querySelector('[role="tooltip"]')).toBeNull())
        expect(pageSize()).toEqual(baseline)
      }
      expect(insertionSizes).toHaveLength(2)
      for (const size of insertionSizes) expect(size).toEqual(baseline)
    } finally {
      appendSpy.mockRestore()
      wrapper.unmount()
      host.remove()
    }
  })
})
