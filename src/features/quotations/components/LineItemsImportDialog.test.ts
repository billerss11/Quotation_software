// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'

import { createAppI18n } from '@/shared/i18n/createAppI18n'

import type { LineItemsImportReport } from '../composables/useQuotationFileActions'
import LineItemsImportDialog from './LineItemsImportDialog.vue'

describe('LineItemsImportDialog', () => {
  it('shows the import rules and emits file and template actions', async () => {
    const wrapper = mountDialog('en-US')

    expect(wrapper.text()).toContain('Confirming import replaces every current item and section row')
    expect(wrapper.text()).toContain('15 and 15% both mean 15%')
    expect(wrapper.text()).toContain('manual_unit_price and unit_price may both appear only when their values are equal')
    expect(wrapper.text()).toContain('Cost-plus leaf')

    expect(wrapper.text()).toContain('Download CSV template')
    expect(wrapper.text()).toContain('Download Excel template')
    expect(wrapper.text()).toContain('keep the exact Import Data sheet name')
    expect(wrapper.text()).toContain('Choose Excel')

    await wrapper.get('[data-test="download-csv-template"]').trigger('click')
    await wrapper.get('[data-test="download-excel-template"]').trigger('click')
    await wrapper.get('[data-test="choose-csv-file"]').trigger('click')
    await wrapper.get('[data-test="choose-xlsx-file"]').trigger('click')

    expect(wrapper.emitted('downloadTemplate')).toHaveLength(1)
    expect(wrapper.emitted('downloadExcelTemplate')).toHaveLength(1)
    expect(wrapper.emitted('chooseCsvFile')).toHaveLength(1)
    expect(wrapper.emitted('chooseXlsxFile')).toHaveLength(1)
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
    expect(wrapper.text()).toContain('下载 CSV 模板')
    expect(wrapper.text()).toContain('下载 Excel 模板')
    expect(wrapper.text()).toContain('名称完全为 Import Data 的工作表')
    expect(wrapper.text()).toContain('选择 Excel')
  })
})

function mountDialog(
  locale: 'en-US' | 'zh-CN',
  overrides: Partial<InstanceType<typeof LineItemsImportDialog>['$props']> = {},
) {
  return mount(LineItemsImportDialog, {
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
              :data-test="label === 'Download CSV template' || label === '下载 CSV 模板'
                ? 'download-csv-template'
                : label === 'Download Excel template' || label === '下载 Excel 模板'
                  ? 'download-excel-template'
                  : label === 'Choose CSV' || label === '重新选择 CSV' || label === '选择 CSV' || label === 'Choose another CSV'
                  ? 'choose-csv-file'
                  : label === 'Choose Excel' || label === 'Choose another Excel file' || label === '选择 Excel' || label === '重新选择 Excel 文件'
                    ? 'choose-xlsx-file'
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

function createReport(): LineItemsImportReport {
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
