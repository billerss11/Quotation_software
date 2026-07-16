// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'

import { createAppI18n } from '@/shared/i18n/createAppI18n'

import type { CsvImportReport } from '../composables/useQuotationFileActions'
import CsvImportDialog from './CsvImportDialog.vue'

describe('CsvImportDialog', () => {
  it('shows the import rules and emits file and template actions', async () => {
    const wrapper = mountDialog('en-US')

    expect(wrapper.text()).toContain('Confirming import replaces every current item and section row')
    expect(wrapper.text()).toContain('15 and 15% both mean 15%')
    expect(wrapper.text()).toContain('manual_unit_price and unit_price may both appear only when their values are equal')
    expect(wrapper.text()).toContain('Cost-plus leaf')

    await wrapper.get('[data-test="download-template"]').trigger('click')
    await wrapper.get('[data-test="choose-file"]').trigger('click')

    expect(wrapper.emitted('downloadTemplate')).toHaveLength(1)
    expect(wrapper.emitted('chooseFile')).toHaveLength(1)
  })

  it('shows preview metadata and allows warnings to be confirmed', async () => {
    const wrapper = mountDialog('en-US', {
      report: createReport(),
      hasPendingImport: true,
    })

    expect(wrapper.text()).toContain('items.csv: 2 row(s) validated with 1 warning(s)')
    expect(wrapper.text()).toContain('item_name, qty, manual_unit_price')
    expect(wrapper.text()).toContain('extra field')

    const confirmButton = wrapper.get('[data-test="confirm-import"]')
    expect(confirmButton.attributes('disabled')).toBeUndefined()

    await confirmButton.trigger('click')
    expect(wrapper.emitted('confirm')).toHaveLength(1)
  })

  it('disables confirmation when the validated import is no longer pending', () => {
    const wrapper = mountDialog('en-US', {
      report: createReport(),
      hasPendingImport: false,
    })

    expect(wrapper.get('[data-test="confirm-import"]').attributes('disabled')).toBeDefined()
  })

  it('renders the guide in Simplified Chinese', () => {
    const wrapper = mountDialog('zh-CN')

    expect(wrapper.text()).toContain('确认导入后会替换当前所有明细行和分区行')
    expect(wrapper.text()).toContain('选择 CSV')
  })
})

function mountDialog(
  locale: 'en-US' | 'zh-CN',
  overrides: Partial<InstanceType<typeof CsvImportDialog>['$props']> = {},
) {
  return mount(CsvImportDialog, {
    props: {
      visible: true,
      report: null,
      hasPendingImport: false,
      ...overrides,
    },
    global: {
      plugins: [createAppI18n(locale)],
      stubs: {
        Button: defineComponent({
          name: 'Button',
          inheritAttrs: false,
          props: {
            label: String,
            disabled: Boolean,
          },
          emits: ['click'],
          template: `
            <button
              v-bind="$attrs"
              :data-test="label === 'Download template' || label === '下载模板'
                ? 'download-template'
                : label === 'Choose CSV' || label === '重新选择 CSV' || label === '选择 CSV' || label === 'Choose another CSV'
                  ? 'choose-file'
                  : label === 'Confirm import' || label === '确认导入'
                    ? 'confirm-import'
                    : 'close'"
              :disabled="disabled"
              @click="$emit('click')"
            >{{ label }}</button>
          `,
        }),
        Dialog: defineComponent({
          name: 'Dialog',
          props: {
            visible: Boolean,
          },
          emits: ['update:visible', 'hide'],
          template: '<section v-if="visible"><slot /></section>',
        }),
      },
    },
  })
}

function createReport(): CsvImportReport {
  return {
    fileName: 'items.csv',
    ok: true,
    status: 'ready',
    rowCount: 2,
    recognizedColumns: ['item_name', 'qty', 'manual_unit_price'],
    ignoredColumns: ['extra field'],
    agentMessages: ['Unknown header ignored'],
    entries: [{
      severity: 'warning',
      row: 1,
      column: 'extra field',
      message: 'Unknown column extra field was ignored.',
    }],
  }
}
