// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'

import { createAppI18n } from '@/shared/i18n/createAppI18n'
import type { SupportedLocale } from '@/shared/i18n/locale'
import { messages } from '@/shared/i18n/messages'

import type { QuotationRevision } from '../types'
import { createInitialQuotation } from '../utils/quotationDraft'
import QuotationRevisionsDialog from './QuotationRevisionsDialog.vue'

describe('QuotationRevisionsDialog', () => {
  it.each([
    ['en-US', 'Working revision 3', 'Saved revisions'],
    ['zh-CN', '当前工作稿 · 修订 3', '已保存的修订'],
  ] as const)('shows the working draft and read-only archive in %s', (locale, workingLabel, savedLabel) => {
    const wrapper = mountDialog({}, locale)

    expect(wrapper.text()).toContain(workingLabel)
    expect(wrapper.text()).toContain(savedLabel)
    expect(wrapper.findAll('li').map(entry => entry.find('strong').text())).toEqual(
      locale === 'en-US' ? ['Revision 2', 'Revision 1'] : ['修订 2', '修订 1'],
    )
    expect(wrapper.get('time').attributes('datetime')).toBe('2026-10-12T10:30:00.000Z')
    expect(wrapper.text()).toContain('Sent to customer')
    expect(wrapper.findAll('input')).toHaveLength(1)
  })

  it('emits the note and selected revision without editing archived data', async () => {
    const wrapper = mountDialog()

    await wrapper.get('input').setValue('  Customer requested new terms  ')
    await wrapper.get('form').trigger('submit')
    await findButton(wrapper, 'View revision 2').trigger('click')
    await findButton(wrapper, 'Export revision 2 as PDF').trigger('click')
    await findButton(wrapper, 'Restore revision 2 as a new revision').trigger('click')

    expect(wrapper.emitted('create')).toEqual([['Customer requested new terms']])
    expect(wrapper.emitted('preview')).toEqual([['revision-2']])
    expect(wrapper.emitted('exportPdf')).toEqual([['revision-2']])
    expect(wrapper.emitted('restore')).toEqual([['revision-2']])
    expect(wrapper.props('revisions')[1]?.note).toBe('Sent to customer')

    await wrapper.setProps({ currentRevisionNumber: 4 })
    expect(wrapper.get('input').element.value).toBe('')
  })

  it('allows browser preview but disables mutation and native PDF export', async () => {
    const wrapper = mountDialog({ canMutate: false, canExportPdf: false })

    expect(wrapper.text()).toContain('Create, restore, and delete revisions in the desktop app.')
    expect(findButton(wrapper, 'Create revision').attributes('disabled')).toBeDefined()
    expect(findButton(wrapper, 'Restore revision 2 as a new revision').attributes('disabled')).toBeDefined()
    expect(findButton(wrapper, 'Export revision 2 as PDF').attributes('disabled')).toBeDefined()
    expect(findButton(wrapper, 'Delete revision 2').attributes('disabled')).toBeDefined()
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('create')).toBeUndefined()
    await findButton(wrapper, 'View revision 2').trigger('click')
    expect(wrapper.emitted('preview')).toEqual([['revision-2']])
  })

  it('asks to reopen the original file when history is unavailable', async () => {
    const statusMessage = messages['en-US'].quotations.revisions.historyUnavailable
    const wrapper = mountDialog({ historyUnavailable: true, statusMessage })

    expect(wrapper.text()).toContain('Reopen the original quotation JSON file with Import Quotation')
    expect(wrapper.findAll('[role="status"]').filter(status => status.text() === statusMessage)).toHaveLength(1)
    expect(findButton(wrapper, 'Create revision').attributes('disabled')).toBeDefined()
    expect(findButton(wrapper, 'Restore revision 2 as a new revision').attributes('disabled')).toBeDefined()
    expect(findButton(wrapper, 'Delete revision 2').attributes('disabled')).toBeDefined()
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('create')).toBeUndefined()
    await wrapper.setProps({ revisions: [] })
    expect(wrapper.text()).not.toContain('No saved revisions yet.')
  })

  it('blocks repeated actions and closing while an operation is running', async () => {
    const wrapper = mountDialog({ busy: true })
    const dialog = wrapper.findComponent({ name: 'Dialog' })

    expect(wrapper.findAll('button').every(button => button.attributes('disabled') !== undefined)).toBe(true)
    expect(dialog.props('closable')).toBe(false)
    expect(dialog.props('closeOnEscape')).toBe(false)
    await wrapper.get('form').trigger('submit')
    dialog.vm.$emit('update:visible', false)
    expect(wrapper.emitted('create')).toBeUndefined()
    expect(wrapper.emitted('update:visible')).toBeUndefined()

    await wrapper.setProps({ busy: false, statusMessage: 'The revision could not be saved.' })
    expect(wrapper.get('[role="status"]').text()).toBe('The revision could not be saved.')
    await findButton(wrapper, 'Close').trigger('click')
    expect(wrapper.emitted('update:visible')).toEqual([[false]])
  })

  it.each(['en-US', 'zh-CN'] as const)('requires explicit confirmation before deleting a saved revision in %s', async (locale) => {
    const wrapper = mountDialog({}, locale)
    const copy = messages[locale].quotations.revisions
    const deleteLabel = copy.deleteAria.replace('{number}', '2')

    await findButton(wrapper, deleteLabel).trigger('click')
    expect(wrapper.emitted('delete')).toBeUndefined()
    expect(wrapper.get('[role="alert"]').text()).toContain(copy.confirmDelete.replace('{number}', '2'))
    expect(wrapper.get('[role="alert"]').text()).toContain(copy.deleteWarning)

    await findButton(wrapper, copy.cancelDelete).trigger('click')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.emitted('delete')).toBeUndefined()

    await findButton(wrapper, deleteLabel).trigger('click')
    await findButton(wrapper, copy.confirmDeleteAction).trigger('click')
    expect(wrapper.emitted('delete')).toEqual([['revision-2']])
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.props('revisions')).toHaveLength(2)
    expect(wrapper.findAll('button').some(button => button.attributes('aria-label') === copy.deleteAria.replace('{number}', '3'))).toBe(false)
  })

  it.each([
    { busy: true },
    { canMutate: false },
    { historyUnavailable: true },
  ])('blocks a pending delete when access changes to %o', async (restriction) => {
    const wrapper = mountDialog()
    await findButton(wrapper, 'Delete revision 2').trigger('click')
    await wrapper.setProps(restriction)

    const confirmButton = findButton(wrapper, 'Delete saved revision')
    expect(confirmButton.attributes('disabled')).toBeDefined()
    await confirmButton.trigger('click')
    expect(wrapper.emitted('delete')).toBeUndefined()
  })
})

function mountDialog(
  overrides: Partial<InstanceType<typeof QuotationRevisionsDialog>['$props']> = {},
  locale: SupportedLocale = 'en-US',
) {
  return mount(QuotationRevisionsDialog, {
    props: {
      visible: true,
      revisions: [createRevision(1), createRevision(2)],
      currentRevisionNumber: 3,
      canMutate: true,
      canExportPdf: true,
      busy: false,
      historyUnavailable: false,
      ...overrides,
    },
    global: {
      plugins: [createAppI18n(locale)],
      stubs: {
        Dialog: defineComponent({
          name: 'Dialog',
          props: { visible: Boolean, closable: Boolean, closeOnEscape: Boolean },
          emits: ['update:visible'],
          template: '<section v-if="visible"><slot /><slot name="footer" /></section>',
        }),
        Button: defineComponent({
          props: { label: String, disabled: Boolean, type: { type: String, default: 'button' } },
          emits: ['click'],
          template: '<button :type="type" :disabled="disabled" @click="$emit(\'click\')">{{ label }}</button>',
        }),
        InputText: defineComponent({
          props: { modelValue: String, disabled: Boolean },
          emits: ['update:modelValue'],
          template: '<input :value="modelValue" :disabled="disabled" @input="$emit(\'update:modelValue\', $event.target.value)" />',
        }),
      },
    },
  })
}

function createRevision(revisionNumber: number): QuotationRevision {
  const quotation = createInitialQuotation([], 'en-US')
  quotation.header.revisionNumber = revisionNumber
  return {
    id: `revision-${revisionNumber}`,
    revisionNumber,
    createdAt: '2026-10-12T10:30:00.000Z',
    note: 'Sent to customer',
    quotation,
  }
}

function findButton(wrapper: ReturnType<typeof mountDialog>, label: string) {
  const button = wrapper.findAll('button')
    .find(candidate => (candidate.attributes('aria-label') || candidate.text()) === label)
  if (!button) throw new Error(`Button not found: ${label}`)
  return button
}
