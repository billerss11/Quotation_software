import Aura from '@primevue/themes/aura'
import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import { describe, expect, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import '@/assets/main.css'
import { createAppI18n } from '@/shared/i18n/createAppI18n'

import { createInitialQuotation } from '../utils/quotationDraft'
import { createQuotationItem } from '../utils/quotationItems'
import { proposeQuotationRevision } from '../utils/quotationRevisions'
import QuotationRevisionsDialog from './QuotationRevisionsDialog.vue'

describe('QuotationRevisionsDialog real controls', () => {
  it.each(['en-US', 'zh-CN'] as const)('keeps %s archive actions and confirmation usable for 404-item snapshots', async locale => {
    await page.viewport(1000, 900)
    const quotation = createInitialQuotation([], locale, { quotationNumber: 'QA-404' })
    quotation.majorItems = Array.from({ length: 404 }, (_, index) => createQuotationItem('USD', {
      name: `Item ${index + 1}`, unitCost: 25,
    }))
    let document = proposeQuotationRevision({ quotation, revisions: [] })
    document = proposeQuotationRevision(document)
    const host = window.document.createElement('div')
    window.document.body.appendChild(host)
    const i18n = createAppI18n(locale)
    const t = i18n.global.t
    const wrapper = mount(QuotationRevisionsDialog, {
      attachTo: host,
      props: {
        visible: true, revisions: document.revisions, currentRevisionNumber: 3,
        canMutate: true, canExportPdf: true, busy: false, historyUnavailable: false,
      },
      global: {
        plugins: [i18n, [PrimeVue, { theme: { preset: Aura } }]],
        stubs: { transition: false },
      },
    })
    const action = (key: string) => page.getByRole('button', { name: t(`quotations.revisions.${key}`, { number: 2 }), exact: true })
    try {
      await expect.element(page.getByRole('dialog')).toBeVisible()
      await vi.waitFor(() => {
        const bounds = window.document.querySelector('.p-dialog')!.getBoundingClientRect()
        expect(bounds.left).toBeGreaterThanOrEqual(0)
        expect(bounds.right).toBeLessThanOrEqual(window.innerWidth)
        expect(bounds.top).toBeGreaterThanOrEqual(0)
        expect(bounds.bottom).toBeLessThanOrEqual(window.innerHeight)
      })
      await page.getByRole('textbox', { name: t('quotations.revisions.note'), exact: true }).fill('  Issued offer  ')
      await userEvent.keyboard('{Enter}')
      expect(wrapper.emitted('create')).toEqual([['Issued offer']])
      for (const [key, event] of [['previewAria', 'preview'], ['exportPdfAria', 'exportPdf'], ['restoreAria', 'restore']] as const) {
        await action(key).click()
        expect(wrapper.emitted(event)).toEqual([[document.revisions[1]!.id]])
      }
      await action('deleteAria').click()
      await expect.element(page.getByRole('alert')).toBeVisible()
      await action('cancelDelete').click()
      expect(wrapper.emitted('delete')).toBeUndefined()
      await action('deleteAria').click()
      await action('confirmDeleteAction').click()
      expect(wrapper.emitted('delete')).toEqual([[document.revisions[1]!.id]])

      await wrapper.setProps({ busy: true })
      for (const button of window.document.querySelectorAll<HTMLButtonElement>('.p-dialog button')) expect(button.disabled).toBe(true)
      await userEvent.keyboard('{Escape}')
      expect(wrapper.emitted('update:visible')).toBeUndefined()
      await wrapper.setProps({ busy: false, canMutate: false, canExportPdf: false })
      await expect.element(action('previewAria')).toBeEnabled()
      for (const key of ['exportPdfAria', 'restoreAria', 'deleteAria', 'create']) await expect.element(action(key)).toBeDisabled()
      await wrapper.setProps({ historyUnavailable: true })
      await expect.element(page.getByRole('textbox', { name: t('quotations.revisions.note'), exact: true })).toBeDisabled()
      await action('close').last().click()
      expect(wrapper.emitted('update:visible')).toEqual([[false]])
      expect(document.revisions).toHaveLength(2)
      expect(document.revisions[1]!.quotation.majorItems).toHaveLength(404)
    } finally {
      wrapper.unmount()
      host.remove()
    }
  })
})
