// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import { describe, expect, it } from 'vitest'

import { createAppI18n } from '@/shared/i18n/createAppI18n'
import CompanyProfileLibraryEditor from './CompanyProfileLibraryEditor.vue'

describe('CompanyProfileLibraryEditor', () => {
  it('describes required-name and optional-email validation in Chinese', async () => {
    const wrapper = mount(CompanyProfileLibraryEditor, {
      props: {
        modelValue: { id: 'company-1', updatedAt: '', companyName: '', phone: '', email: 'bad' },
        mode: 'create',
        canDelete: false,
        isDirty: true,
        validationErrors: ['missing_company_name', 'invalid_email'],
      },
      global: { plugins: [PrimeVue, createAppI18n('zh-CN')] },
    })

    await wrapper.findAll('button').find((button) => button.text().includes('保存资料'))!.trigger('click')

    expect(wrapper.get('#company-name-error').text()).toBe('公司名称为必填项。')
    expect(wrapper.get('#company-email-error').text()).toBe('请输入有效的电子邮箱。')
    expect(wrapper.get('input[type="email"]').attributes('aria-describedby')).toBe('company-email-error')
  })
})
