// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'
import { createAppI18n } from '@/shared/i18n/createAppI18n'
import { messages } from '@/shared/i18n/messages'
import { createInitialQuotation } from '../utils/quotationDraft'
import QuotationExcelExportDialog from './QuotationExcelExportDialog.vue'

describe('QuotationExcelExportDialog', () => {
  it.each(['en-US', 'zh-CN'] as const)('defaults to customer and resets after an internal export in %s', async (locale) => {
    const wrapper = mount(QuotationExcelExportDialog, {
      props: { visible: true, header: createInitialQuotation([], locale).header, busy: false, error: '' },
      global: {
        plugins: [createAppI18n(locale)],
        stubs: {
          Dialog: defineComponent({ template: '<section><slot /><slot name="footer" /></section>' }),
          Button: defineComponent({ props: ['label', 'disabled'], template: '<button :disabled="disabled">{{ label }}</button>' }),
          RadioButton: defineComponent({
            props: ['modelValue', 'value', 'inputId', 'name', 'disabled'],
            emits: ['update:modelValue'],
            template: '<input type="radio" :id="inputId" :name="name" :value="value" :disabled="disabled" :checked="modelValue === value" @change="$emit(\'update:modelValue\', value)" />',
          }),
        },
      },
    })
    const exportButton = () => wrapper.findAll('button').find(button => button.text() === messages[locale].quotations.excel.export)!

    expect(wrapper.get<HTMLInputElement>('#excel-customer').element.checked).toBe(true)
    expect(wrapper.text()).toContain(messages[locale].quotations.excel.internalDescription)
    await exportButton().trigger('click')
    await wrapper.get('#excel-internal').setValue()
    await exportButton().trigger('click')
    expect(wrapper.emitted('export')).toEqual([['customer'], ['internal']])

    await wrapper.setProps({ visible: false })
    await wrapper.setProps({ visible: true })
    expect(wrapper.get<HTMLInputElement>('#excel-customer').element.checked).toBe(true)
    await wrapper.setProps({ busy: true })
    expect(exportButton().attributes('disabled')).toBeDefined()
    expect(wrapper.get('#excel-internal').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })
})
