// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'

import { createAppI18n } from '@/shared/i18n/createAppI18n'
import type { SupportedLocale } from '@/shared/i18n/locale'
import { messages } from '@/shared/i18n/messages'

import type { LineItemsImportReport } from '../composables/useQuotationFileActions'
import LineItemsImportDialog from './LineItemsImportDialog.vue'

describe('LineItemsImportDialog', () => {
  it.each([
    ['en-US', 'Three steps', 'Problems? See all filling rules'],
    ['zh-CN', '只要三步', '遇到问题？查看完整填表规则'],
  ] as const)('shows a short three-step guide in %s', (locale, title, advancedTitle) => {
    const wrapper = mountDialog(locale)

    expect(wrapper.text()).toContain(title)
    expect(wrapper.get('ol').findAll('li')).toHaveLength(3)
    expect(wrapper.text()).toContain('item_code')
    expect(wrapper.text()).not.toMatch(/叶子行|leaf row/i)

    const details = wrapper.get('details')
    expect(details.attributes('open')).toBeUndefined()
    expect(details.get('summary').text()).toBe(advancedTitle)
  })

  it('keeps the Excel and CSV actions wired to their existing events', async () => {
    const wrapper = mountDialog('en-US')

    await findButton(wrapper, 'Download Excel template').trigger('click')
    await findButton(wrapper, 'Import Excel').trigger('click')
    await findButton(wrapper, 'Download CSV template').trigger('click')
    await findButton(wrapper, 'Import CSV').trigger('click')

    expect(wrapper.emitted('downloadExcelTemplate')).toHaveLength(1)
    expect(wrapper.emitted('chooseXlsxFile')).toHaveLength(1)
    expect(wrapper.emitted('downloadTemplate')).toHaveLength(1)
    expect(wrapper.emitted('chooseCsvFile')).toHaveLength(1)
  })

  it('shows the checked rows and allows a pending import to be confirmed', async () => {
    const wrapper = mountDialog('en-US', {
      report: createReport(),
      hasPendingImport: true,
    })

    expect(wrapper.text()).toContain('items.csv: checked 2 row(s). 1 warning(s).')
    expect(wrapper.text()).toContain('item_name, qty, manual_unit_price')
    expect(wrapper.text()).toContain('extra field')

    const confirmButton = findButton(wrapper, 'Import these items')
    expect(confirmButton.attributes('disabled')).toBeUndefined()

    await confirmButton.trigger('click')
    expect(wrapper.emitted('confirm')).toHaveLength(1)
  })

  it('disables confirmation when the checked import is no longer pending', () => {
    const wrapper = mountDialog('en-US', {
      report: createReport(),
      hasPendingImport: false,
    })

    expect(findButton(wrapper, 'Import these items').attributes('disabled')).toBeDefined()
  })

  it('keeps the close and cancel behavior wired to the existing events', async () => {
    const wrapper = mountDialog('en-US')

    await findButton(wrapper, 'Close').trigger('click')
    expect(wrapper.emitted('update:visible')).toEqual([[false]])

    wrapper.findComponent({ name: 'Dialog' }).vm.$emit('hide')
    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })

  it('keeps all import messages free of tree jargon', () => {
    const englishCopy = JSON.stringify({
      xlsx: messages['en-US'].quotations.xlsx,
      csv: messages['en-US'].quotations.csv,
      statuses: messages['en-US'].quotations.statuses,
    })
    const chineseCopy = JSON.stringify({
      xlsx: messages['zh-CN'].quotations.xlsx,
      csv: messages['zh-CN'].quotations.csv,
      statuses: messages['zh-CN'].quotations.statuses,
    })

    expect(englishCopy).not.toMatch(/leaf row/i)
    expect(chineseCopy).not.toContain('叶子行')
  })
})

function mountDialog(
  locale: SupportedLocale,
  overrides: Partial<InstanceType<typeof LineItemsImportDialog>['$props']> = {},
) {
  return mount(LineItemsImportDialog, {
    props: {
      visible: true,
      report: null,
      hasPendingImport: false,
      'onUpdate:visible': () => {},
      ...overrides,
    },
    global: {
      plugins: [createAppI18n(locale)],
      stubs: {
        Dialog: defineComponent({
          name: 'Dialog',
          props: { visible: Boolean },
          emits: ['hide'],
          template: '<section v-if="visible"><slot /></section>',
        }),
        Button: defineComponent({
          props: { label: String, disabled: Boolean },
          emits: ['click'],
          template: '<button type="button" :disabled="disabled" @click="$emit(\'click\')">{{ label }}</button>',
        }),
      },
    },
  })
}

function createReport(): LineItemsImportReport {
  return {
    fileName: 'items.csv',
    ok: true,
    status: 'ready',
    rowCount: 2,
    recognizedColumns: ['item_name', 'qty', 'manual_unit_price'],
    ignoredColumns: ['extra field'],
    agentMessages: ['Unknown header skipped'],
    entries: [{
      severity: 'warning',
      row: 1,
      column: 'extra field',
      message: 'The unknown extra field column was skipped.',
    }],
  }
}

function findButton(wrapper: ReturnType<typeof mountDialog>, label: string) {
  const button = wrapper.findAll('button').find(candidate => candidate.text() === label)
  if (!button) throw new Error(`Button not found: ${label}`)
  return button
}
