import Aura from '@primevue/themes/aura'
import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import { describe, expect, it, vi } from 'vitest'
import { page } from 'vitest/browser'
import { nextTick, reactive } from 'vue'

import '@/assets/main.css'
import { createAppI18n } from '@/shared/i18n/createAppI18n'

import type { QuotationHeader } from '../types'
import { createInitialQuotation } from '../utils/quotationDraft'
import QuoteInfoPanel from './QuoteInfoPanel.vue'

async function settleLayout() {
  await nextTick()
  await document.fonts.ready
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
}

describe('Quote info notes and terms in the details workspace', () => {
  it.each(['en-US', 'zh-CN'] as const)('reveals compact fields and applies expanded editor changes in %s', async (locale) => {
    await page.viewport(1440, 1000)
    const host = document.createElement('div')
    host.style.cssText = 'position: fixed; top: 24px; right: 24px; width: 520px; height: 480px; overflow: auto; padding: 24px;'
    document.body.appendChild(host)
    const quotation = createInitialQuotation([], locale)
    quotation.header.notes = 'Scope notes stay editable.'
    quotation.header.terms = Array.from({ length: 24 }, (_, index) =>
      `Condition ${index + 1}: All supplied documentation and specifications must be accepted.`,
    ).join('\n')
    const header = reactive(quotation.header)
    const i18n = createAppI18n(locale)
    const wrapper = mount(QuoteInfoPanel, {
      attachTo: host,
      props: {
        header,
        quotationCurrencyOptions: ['USD'],
        onUpdateHeaderField: (field: keyof QuotationHeader, value: QuotationHeader[keyof QuotationHeader]) => {
          Object.assign(header, { [field]: value })
        },
      },
      global: {
        plugins: [i18n, [PrimeVue, { theme: { preset: Aura } }]],
        directives: { tooltip: {} },
        stubs: { transition: false },
      },
    })

    try {
      await settleLayout()
      const panelBody = host
      panelBody.scrollTop = panelBody.scrollHeight - panelBody.clientHeight
      await settleLayout()
      const toggle = wrapper.get('.extras-toggle').element.getBoundingClientRect()
      const panelBounds = panelBody.getBoundingClientRect()
      expect(toggle.bottom).toBeLessThanOrEqual(panelBounds.bottom)
      expect(toggle.top).toBeGreaterThanOrEqual(panelBounds.top)
      const collapsedScrollTop = panelBody.scrollTop
      const fields = ['notes', 'terms'] as const
      const labels = {
        notes: i18n.global.t('quotations.headerForm.notes'),
        terms: i18n.global.t('quotations.headerForm.termsAndConditions'),
      }
      const compactField = (field: typeof fields[number]) =>
        wrapper.get<HTMLTextAreaElement>(`[data-history-target="header:${field}"] textarea`).element
      const expectFieldsVisible = () => {
        const viewport = panelBody.getBoundingClientRect()
        for (const field of fields) {
          const bounds = compactField(field).getBoundingClientRect()
          expect(bounds.top).toBeGreaterThanOrEqual(viewport.top - 1)
          expect(bounds.bottom).toBeLessThanOrEqual(viewport.bottom + 1)
          expect(bounds.height).toBeLessThanOrEqual(180)
        }
      }

      await page.getByRole('button', { name: i18n.global.t('quotations.headerForm.showExtras'), exact: true }).click()
      await vi.waitFor(() => {
        expectFieldsVisible()
        expect(panelBody.scrollTop).toBeGreaterThan(collapsedScrollTop)
      })

      const editedValues = {
        notes: 'Edited scope notes.\nKeep this second line after reopening.',
        terms: `${header.terms}\nFinal condition: documentation accepted.`,
      }
      for (const field of fields) {
        const originalValue = header[field]
        const expandButton = page.getByRole('button', {
          name: i18n.global.t('quotations.textEditor.openAria', { label: labels[field] }), exact: true,
        })
        await expandButton.click()
        const dialog = page.getByRole('dialog', { name: labels[field], exact: true })
        const editor = dialog.getByRole('textbox', { name: labels[field], exact: true })
        await expect.element(dialog).toBeVisible()
        expect((editor.element() as HTMLTextAreaElement).value).toBe(originalValue)
        expect(editor.element().getBoundingClientRect().height).toBeGreaterThan(compactField(field).clientHeight * 2)
        await editor.fill('Discard this draft.\nThe saved text must stay unchanged.')
        expect(header[field]).toBe(originalValue)
        await dialog.getByRole('button', { name: i18n.global.t('quotations.textEditor.cancel'), exact: true }).click()
        await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull())
        expect(compactField(field).value).toBe(originalValue)

        await expandButton.click()
        await expect.element(dialog).toBeVisible()
        expect((editor.element() as HTMLTextAreaElement).value).toBe(originalValue)
        await editor.fill(editedValues[field])
        expect(header[field]).toBe(originalValue)
        await dialog.getByRole('button', { name: i18n.global.t('quotations.textEditor.apply'), exact: true }).click()
        await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull())
        expect(compactField(field).value).toBe(editedValues[field])
      }
      const terms = compactField('terms')
      expect(getComputedStyle(terms).overflowY).toBe('auto')
      expect(terms.scrollHeight).toBeGreaterThan(terms.clientHeight)
      terms.scrollTop = terms.scrollHeight
      await settleLayout()
      expect(Math.abs(terms.scrollHeight - terms.clientHeight - terms.scrollTop)).toBeLessThanOrEqual(1)
      expect(terms.value).toBe(editedValues.terms)

      await page.getByRole('button', { name: i18n.global.t('quotations.headerForm.hideExtras'), exact: true }).click()
      const collapsedNotes = wrapper.find('[data-history-target="header:notes"] textarea')
      expect(collapsedNotes.exists() && collapsedNotes.isVisible()).toBe(false)
      panelBody.scrollTop = panelBody.scrollHeight - panelBody.clientHeight
      await settleLayout()
      await page.getByRole('button', { name: i18n.global.t('quotations.headerForm.showExtras'), exact: true }).click()
      await vi.waitFor(() => {
        expectFieldsVisible()
        for (const field of fields) expect(compactField(field).value).toBe(editedValues[field])
      })
    } finally {
      wrapper.unmount()
      host.remove()
    }
  })
})
