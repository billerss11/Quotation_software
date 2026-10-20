// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import { defineComponent, nextTick } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'

import { createAppI18n } from '@/shared/i18n/createAppI18n'
import type { SupportedLocale } from '@/shared/i18n/locale'

import QuotationFilesDialog from './QuotationFilesDialog.vue'

// Keep real buttons, but control the end of the dialog's hide transition.
const DialogStub = defineComponent({
  name: 'Dialog',
  props: ['visible', 'header'],
  emits: ['update:visible', 'after-hide'],
  template: '<div role="dialog" :aria-label="header"><slot /></div>',
})

type DialogProps = InstanceType<typeof QuotationFilesDialog>['$props']

describe('QuotationFilesDialog', () => {
  const wrappers: Array<{ unmount: () => void }> = []

  afterEach(() => {
    wrappers.forEach(wrapper => wrapper.unmount())
    wrappers.length = 0
  })

  function mountFiles(props: Partial<DialogProps> = {}, locale: SupportedLocale = 'en-US') {
    const i18n = createAppI18n(locale)
    const wrapper = mount(QuotationFilesDialog, {
      props: {
        visible: true,
        quotationNumber: 'QT-2026-001',
        currentFilePath: '',
        hasNativeFileDialogs: false,
        supportsDirectPdfExport: false,
        viewingSavedRevision: false,
        hasSavedDrafts: true,
        hasGoodsReceiptItems: true,
        busy: false,
        ...props,
      },
      global: {
        plugins: [i18n, [PrimeVue, { unstyled: true }]],
        stubs: { Dialog: DialogStub },
      },
    })
    wrappers.push(wrapper)
    const action = (id: string) => wrapper.get(`[data-testid="file-action-${id}"]`)
    const finishHiding = async () => {
      wrapper.getComponent(DialogStub).vm.$emit('after-hide')
      await nextTick()
    }
    return { wrapper, action, finishHiding, t: i18n.global.t }
  }

  it('downloads an editable file in the browser', async () => {
    const { wrapper, action } = mountFiles()
    expect(wrapper.find('[data-testid="file-action-saveAs"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="file-action-exportCopy"]').exists()).toBe(false)
    await action('downloadQuotation').trigger('click')
    expect(wrapper.emitted('saveAs')).toHaveLength(1)
    expect(wrapper.emitted('save')).toBeUndefined()
    expect(wrapper.emitted('update:visible')).toEqual([[false]])
  })

  it.each([
    ['saveQuotation', 'save'],
    ['saveAs', 'saveAs'],
    ['exportCopy', 'exportJson'],
  ])('dispatches desktop %s immediately', async (id, event) => {
    const { wrapper, action } = mountFiles({ hasNativeFileDialogs: true })
    expect(wrapper.find('[data-testid="file-action-downloadQuotation"]').exists()).toBe(false)
    await action(id).trigger('click')
    expect(wrapper.emitted(event)).toHaveLength(1)
    expect(wrapper.emitted('update:visible')).toEqual([[false]])
  })

  it.each([
    ['openQuotation', 'importJson'],
    ['exportCsv', 'exportCsv'],
  ])('dispatches %s without waiting for the dialog transition', async (id, event) => {
    const { wrapper, action } = mountFiles()
    await action(id).trigger('click')
    expect(wrapper.emitted(event)).toHaveLength(1)
    expect(wrapper.emitted('update:visible')).toEqual([[false]])
  })

  it.each([
    ['importLineItems', 'importLineItems'],
    ['exportExcel', 'exportExcel'],
    ['goodsReceipt', 'generateGoodsReceipt'],
  ])('opens %s only after Files has finished hiding', async (id, event) => {
    const { wrapper, action, finishHiding } = mountFiles()
    await action(id).trigger('click')
    expect(wrapper.emitted('update:visible')).toEqual([[false]])
    expect(wrapper.emitted(event)).toBeUndefined()
    await finishHiding()
    expect(wrapper.emitted(event)).toHaveLength(1)
    await finishHiding()
    expect(wrapper.emitted(event)).toHaveLength(1)
  })

  it('protects saved revisions while allowing desktop PDF and Excel exports', async () => {
    const { wrapper, action, finishHiding, t } = mountFiles({
      hasNativeFileDialogs: true,
      supportsDirectPdfExport: true,
      viewingSavedRevision: true,
    })
    expect(wrapper.get('[role="status"]').text()).toContain(t('quotations.files.savedRevisionHint'))
    for (const id of ['openQuotation', 'importLineItems', 'recoverDraft', 'saveQuotation', 'saveAs', 'exportCopy', 'exportCsv', 'goodsReceipt', 'newQuotation']) {
      expect(action(id).attributes('disabled'), id).toBeDefined()
      await action(id).trigger('click')
    }
    expect(wrapper.get(`button[aria-label="${t('quotations.files.actions.logo.label')}"]`).attributes('disabled')).toBeDefined()
    expect(wrapper.emitted('update:visible')).toBeUndefined()
    expect(action('exportPdf').attributes('disabled')).toBeUndefined()
    expect(action('exportExcel').attributes('disabled')).toBeUndefined()
    await action('exportPdf').trigger('click')
    expect(wrapper.emitted('exportPdf')).toHaveLength(1)
    await action('exportExcel').trigger('click')
    await finishHiding()
    expect(wrapper.emitted('exportExcel')).toHaveLength(1)
  })

  it('disables browser printing and saving for saved revisions', () => {
    const { action } = mountFiles({ viewingSavedRevision: true })
    expect(action('print').attributes('disabled')).toBeDefined()
    expect(action('downloadQuotation').attributes('disabled')).toBeDefined()
    expect(action('exportExcel').attributes('disabled')).toBeUndefined()
  })

  it.each(['en-US', 'zh-CN'] as const)('explains unavailable recovery and goods receipts in %s', locale => {
    const { action, t } = mountFiles({ hasSavedDrafts: false, hasGoodsReceiptItems: false }, locale)
    expect(action('recoverDraft').attributes('disabled')).toBeDefined()
    expect(action('recoverDraft').text()).toContain(t('quotations.files.noSavedDraft'))
    expect(action('goodsReceipt').attributes('disabled')).toBeDefined()
    expect(action('goodsReceipt').text()).toContain(t('quotations.files.noReceiptItems'))
  })

  it('disables all file actions while busy and cancels a pending dialog action', async () => {
    const { wrapper, action, finishHiding } = mountFiles({ hasNativeFileDialogs: true, supportsDirectPdfExport: true })
    await action('exportExcel').trigger('click')
    await wrapper.setProps({ busy: true })
    for (const button of wrapper.findAll('button')) {
      expect(button.attributes('disabled')).toBeDefined()
      await button.trigger('click')
    }
    await finishHiding()
    expect(wrapper.emitted('exportExcel')).toBeUndefined()
    expect(wrapper.emitted('save')).toBeUndefined()
    expect(wrapper.emitted('importJson')).toBeUndefined()
  })
})
