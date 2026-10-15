import Aura from '@primevue/themes/aura'
import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import Tooltip from 'primevue/tooltip'
import { describe, expect, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import '@/assets/main.css'
import { createAppI18n } from '@/shared/i18n/createAppI18n'
import type { SupportedLocale } from '@/shared/i18n/locale'

import { createInitialQuotation } from '../utils/quotationDraft'
import { createQuotationItem } from '../utils/quotationItems'
import { proposeQuotationRevision } from '../utils/quotationRevisions'
import QuotationCommandBar from './QuotationCommandBar.vue'

function mountToolbar(locale: SupportedLocale = 'en-US', desktop = true) {
  const quotation = createInitialQuotation([], locale, { quotationNumber: 'QA-404' })
  quotation.header.projectName = 'Menu audit'
  quotation.majorItems = Array.from({ length: 404 }, (_, index) => createQuotationItem('USD', {
    name: `Item ${index + 1}`, unitCost: 25,
  }))
  const document = proposeQuotationRevision({ quotation, revisions: [] })
  const host = window.document.createElement('div')
  host.style.cssText = 'position:fixed;left:220px;top:20px;width:calc(100vw - 240px);height:180px;overflow:hidden;'
  window.document.body.appendChild(host)
  const i18n = createAppI18n(locale)
  const wrapper = mount(QuotationCommandBar, {
    attachTo: host,
    props: {
      header: document.quotation.header,
      revisions: document.revisions,
      workingRevisionNumber: 2,
      statusMessage: '',
      currentFilePath: '',
      hasNativeFileDialogs: desktop,
      supportsDirectPdfExport: desktop,
      workspaceMode: 'editor',
      hasImportReport: true,
      importReportIssueCount: 3,
      importReportHasErrors: false,
      hasGoodsReceiptItems: true,
    },
    global: {
      plugins: [i18n, [PrimeVue, { theme: { preset: Aura } }]],
      directives: { tooltip: Tooltip },
      stubs: { transition: false },
    },
  })
  return { wrapper, host, i18n, document }
}

describe('QuotationCommandBar real menu actions', () => {
  it.each(['en-US', 'zh-CN'] as const)('opens both %s menus beside their buttons and connects all document commands', async locale => {
    await page.viewport(1000, 900)
    const { wrapper, host, i18n, document: quotationDocument } = mountToolbar(locale)
    const t = i18n.global.t
    async function openMenu(kind: 'file' | 'tools') {
      const label = t(kind === 'file' ? 'command.fileMenu' : 'command.toolsMenu')
      await page.getByRole('button', { name: label, exact: true }).click()
      await vi.waitFor(() => {
        const menu = window.document.querySelector<HTMLElement>(`#quotation-${kind}-menu`)!
        expect(menu).not.toBeNull()
        const bounds = menu.getBoundingClientRect()
        const trigger = wrapper.findAll('button').find(button => button.text() === label)!.element.getBoundingClientRect()
        expect(Math.abs(bounds.top - trigger.bottom)).toBeLessThanOrEqual(4)
        expect(bounds.left).toBeGreaterThanOrEqual(0)
        expect(bounds.right).toBeLessThanOrEqual(window.innerWidth)
        expect(bounds.bottom).toBeLessThanOrEqual(window.innerHeight)
        for (const link of menu.querySelectorAll<HTMLElement>('.p-menu-item-link')) {
          const rect = link.getBoundingClientRect()
          expect(link.contains(window.document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2))).toBe(true)
        }
      })
    }

    try {
      await document.fonts.ready
      for (const [key, event] of [
        ['command.new', 'createNew'], ['command.open', 'importJson'],
        ['quotations.commandBar.save', 'save'], ['quotations.commandBar.preview', 'openPreview'],
        ['quotations.commandBar.exportPdf', 'exportPdf'], ['quotations.revisions.open', 'openRevisions'],
      ]) {
        await page.getByRole('button', { name: t(key!), exact: true }).click()
        expect(wrapper.emitted(event!)).toHaveLength(1)
      }
      await page.getByRole('button', { name: t('quotations.csv.report.openWithCount', { count: 3 }), exact: true }).click()
      expect(wrapper.emitted('openImportReport')).toHaveLength(1)

      for (const [kind, key, event] of [
        ['file', 'quotations.commandBar.menu.saveAs', 'saveAs'],
        ['file', 'quotations.commandBar.menu.loadLatest', 'loadLatest'],
        ['file', 'quotations.commandBar.menu.exportJson', 'exportJson'],
        ['tools', 'quotations.commandBar.menu.importLineItems', 'importLineItems'],
        ['tools', 'quotations.commandBar.menu.exportCsv', 'exportCsv'],
        ['tools', 'quotations.commandBar.menu.exportCsvTemplate', 'exportCsvTemplate'],
        ['tools', 'command.generateGoodsReceipt', 'generateGoodsReceipt'],
      ] as const) {
        await openMenu(kind)
        await page.getByRole('menuitem', { name: t(key), exact: true }).click()
        expect(wrapper.emitted(event)).toHaveLength(1)
      }

      const logoInput = wrapper.get<HTMLInputElement>('input[type="file"]').element
      const showPicker = vi.spyOn(logoInput, 'click').mockImplementation(() => {})
      await openMenu('file')
      await page.getByRole('menuitem', { name: t('quotations.commandBar.uploadLogo'), exact: true }).click()
      expect(showPicker).toHaveBeenCalledOnce()
      showPicker.mockRestore()
      await userEvent.upload(logoInput, new File(['<svg xmlns="http://www.w3.org/2000/svg"/>'], 'test-logo.svg', { type: 'image/svg+xml' }))
      expect(wrapper.emitted('logoSelected')).toHaveLength(1)

      await page.getByRole('combobox', { name: t('quotations.revisions.selectRevision'), exact: true }).click()
      await page.getByRole('option', { name: t('command.savedRevision', { number: 1 }), exact: true }).click()
      expect(wrapper.emitted('selectRevision')).toEqual([[quotationDocument.revisions[0]!.id]])
    } finally {
      wrapper.unmount()
      host.remove()
    }
  })

  it.each([true, false])('enforces saved-revision restrictions with desktop capabilities %s', async desktop => {
    await page.viewport(1440, 900)
    const { wrapper, host, i18n, document } = mountToolbar('en-US', desktop)
    const t = i18n.global.t
    try {
      await wrapper.setProps({ selectedRevisionId: document.revisions[0]!.id })
      for (const key of ['command.new', 'command.open', desktop ? 'quotations.commandBar.save' : 'quotations.commandBar.download']) {
        await expect.element(page.getByRole('button', { name: t(key), exact: true })).toBeDisabled()
      }
      for (const key of ['command.fileMenu', 'command.toolsMenu']) {
        await page.getByRole('button', { name: t(key), exact: true }).click()
        const items = page.getByRole('menuitem')
        await expect.element(items.first()).toHaveAttribute('aria-disabled', 'true')
        for (const item of window.document.querySelectorAll('[role="menuitem"]')) expect(item.getAttribute('aria-disabled')).toBe('true')
      }
      await userEvent.keyboard('{Escape}')
      await page.getByRole('button', { name: t('quotations.commandBar.preview'), exact: true }).click()
      expect(wrapper.emitted('openPreview')).toHaveLength(1)
      const output = page.getByRole('button', { name: t(desktop ? 'quotations.commandBar.exportPdf' : 'quotations.commandBar.print'), exact: true })
      if (desktop) {
        await output.click()
        expect(wrapper.emitted('exportPdf')).toHaveLength(1)
      } else {
        await expect.element(output).toBeDisabled()
      }
      await page.getByRole('combobox', { name: t('quotations.revisions.selectRevision'), exact: true }).click()
      await page.getByRole('option', { name: t('command.workingRevision', { number: 2 }), exact: true }).click()
      expect(wrapper.emitted('selectRevision')).toEqual([[null]])
    } finally {
      wrapper.unmount()
      host.remove()
    }
  })
})
