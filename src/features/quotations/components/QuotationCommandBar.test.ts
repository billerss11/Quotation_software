// @vitest-environment jsdom

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PrimeVue from 'primevue/config'
import Menu from 'primevue/menu'
import Select from 'primevue/select'
import { createI18n } from 'vue-i18n'

import { enUsCommand, zhCnCommand } from '@/shared/i18n/commandMessages'
import { messages } from '@/shared/i18n/messages'
import type { SupportedLocale } from '@/shared/i18n/locale'

import QuotationCommandBar from './QuotationCommandBar.vue'
import { createInitialQuotation } from '../utils/quotationDraft'
import { proposeQuotationRevision } from '../utils/quotationRevisions'

const mounted: VueWrapper[] = []

function mountToolbar(overrides: Partial<InstanceType<typeof QuotationCommandBar>['$props']> = {}, locale: SupportedLocale = 'en-US') {
  const quotation = createInitialQuotation([], locale, { quotationNumber: 'QUO-2026-001' })
  quotation.header.projectName = 'Pump maintenance'
  quotation.header.customerCompany = 'Harbor Services'
  const wrapper = mount(QuotationCommandBar, {
    attachTo: document.body,
    props: {
      header: quotation.header,
      statusMessage: '',
      currentFilePath: 'C:\\Quotes\\pump-maintenance.json',
      hasNativeFileDialogs: true,
      supportsDirectPdfExport: true,
      workspaceMode: 'editor',
      hasImportReport: false,
      importReportIssueCount: 0,
      importReportHasErrors: false,
      hasGoodsReceiptItems: true,
      ...overrides,
    },
    global: {
      plugins: [PrimeVue, createI18n({
        legacy: false,
        locale,
        messages: {
          'en-US': { ...messages['en-US'], command: enUsCommand },
          'zh-CN': { ...messages['zh-CN'], command: zhCnCommand },
        },
      })],
      directives: { tooltip: {} },
    },
  })
  mounted.push(wrapper)
  return wrapper
}

function button(wrapper: VueWrapper, label: string) {
  const result = wrapper.findAll('button').find(entry => entry.text() === label)
  if (!result) throw new Error(`Button not found: ${label}`)
  return result
}

async function menuItem(wrapper: VueWrapper, menuLabel: string, itemLabel: string) {
  await button(wrapper, menuLabel).trigger('click')
  await flushPromises()
  const result = Array.from(document.querySelectorAll<HTMLElement>('.p-menu-item-link'))
    .find(entry => entry.textContent?.trim() === itemLabel)
  if (!result) throw new Error(`Menu item not found: ${itemLabel}`)
  return result
}

beforeEach(() => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })))
})

afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount()
  document.body.replaceChildren()
  vi.unstubAllGlobals()
})

describe('QuotationCommandBar', () => {
  it.each(['en-US', 'zh-CN'] as const)('shows the document identity and explicit file controls in %s', locale => {
    const wrapper = mountToolbar({}, locale)
    const copy = locale === 'en-US' ? enUsCommand : zhCnCommand

    expect(wrapper.get('.quote-number').text()).toBe('QUO-2026-001')
    expect(wrapper.get('h1').text()).toBe('Pump maintenance')
    expect(wrapper.get('.quote-customer').text()).toBe('Harbor Services')
    expect(wrapper.get('.file-name').text()).toBe('pump-maintenance.json')
    expect(button(wrapper, copy.new).exists()).toBe(true)
    expect(button(wrapper, copy.open).exists()).toBe(true)
    expect(wrapper.find('[role="tablist"]').exists()).toBe(false)
    expect(wrapper.get('.output-actions').findAll('button')).toHaveLength(3)
  })

  it('keeps primary file and output commands connected to the existing events', async () => {
    const wrapper = mountToolbar()
    const copy = messages['en-US'].quotations.commandBar

    await button(wrapper, enUsCommand.new).trigger('click')
    await button(wrapper, enUsCommand.open).trigger('click')
    await button(wrapper, copy.save).trigger('click')
    await button(wrapper, copy.preview).trigger('click')
    await button(wrapper, copy.exportPdf).trigger('click')

    for (const event of ['createNew', 'importJson', 'save', 'openPreview', 'exportPdf']) {
      expect(wrapper.emitted(event)).toHaveLength(1)
    }
  })

  it('keeps import and goods receipt generation reachable through the tools menu', async () => {
    const wrapper = mountToolbar()
    const copy = messages['en-US'].quotations.commandBar

    const importItem = await menuItem(wrapper, enUsCommand.toolsMenu, copy.menu.importLineItems)
    importItem.click()
    await flushPromises()
    expect(wrapper.emitted('importLineItems')).toHaveLength(1)

    const receiptItem = await menuItem(wrapper, enUsCommand.toolsMenu, enUsCommand.generateGoodsReceipt)
    receiptItem.click()
    await flushPromises()
    expect(wrapper.emitted('generateGoodsReceipt')).toHaveLength(1)
  })

  it('preserves browser download and print capabilities without exposing desktop Save As', async () => {
    const wrapper = mountToolbar({ hasNativeFileDialogs: false, supportsDirectPdfExport: false })
    const copy = messages['en-US'].quotations.commandBar

    await button(wrapper, copy.download).trigger('click')
    await button(wrapper, copy.print).trigger('click')
    expect(wrapper.emitted('saveAs')).toHaveLength(1)
    expect(wrapper.emitted('exportPdf')).toHaveLength(1)
    expect(wrapper.findAll('button').some(entry => entry.text() === copy.save)).toBe(false)
    const fileItems = wrapper.findAllComponents(Menu)[0]!.props('model')!
    expect(fileItems.some(item => item.label === copy.menu.saveAs)).toBe(false)
    expect(button(wrapper, enUsCommand.open).exists()).toBe(true)
  })

  it('locks file mutations on saved revisions while retaining preview, direct PDF, and revision switching', async () => {
    const wrapper = mountToolbar({ selectedRevisionId: 'saved-1' })
    const copy = messages['en-US'].quotations.commandBar

    for (const label of [enUsCommand.new, enUsCommand.open, copy.save]) {
      expect(button(wrapper, label).attributes('disabled')).toBeDefined()
      await button(wrapper, label).trigger('click')
    }
    expect(wrapper.emitted('save')).toBeUndefined()
    expect(wrapper.emitted('createNew')).toBeUndefined()
    expect(wrapper.emitted('importJson')).toBeUndefined()
    for (const menu of wrapper.findAllComponents(Menu)) {
      expect(menu.props('model')!.filter(item => !item.separator).every(item => item.disabled)).toBe(true)
    }
    expect(button(wrapper, copy.preview).attributes('disabled')).toBeUndefined()
    expect(button(wrapper, copy.exportPdf).attributes('disabled')).toBeUndefined()
    expect(wrapper.findComponent(Select).props('disabled')).toBeFalsy()
    expect(wrapper.get('.read-only-label').text()).toBe(messages['en-US'].quotations.revisions.readOnlyBadge)

    await wrapper.setProps({ supportsDirectPdfExport: false })
    expect(button(wrapper, copy.print).attributes('disabled')).toBeDefined()
  })

  it('keeps unavailable goods receipts disabled and translates revision choices without mutating their order', async () => {
    const quotation = createInitialQuotation([], 'en-US')
    const first = proposeQuotationRevision({ quotation, revisions: [] }, { note: 'First' })
    const second = proposeQuotationRevision(first, { note: 'Second' })
    const revisions = [...second.revisions]
    const wrapper = mountToolbar({ revisions, workingRevisionNumber: 3, hasGoodsReceiptItems: false })
    const receiptItem = wrapper.findAllComponents(Menu)[1]!.props('model')!
      .find(item => item.label === enUsCommand.generateGoodsReceipt)
    expect(receiptItem?.disabled).toBe(true)
    const selector = wrapper.findComponent(Select)
    expect(selector.props('options')!.map((entry: { value: string }) => entry.value)).toEqual([
      'working', `saved:${revisions[1]!.id}`, `saved:${revisions[0]!.id}`,
    ])
    expect(revisions.map(entry => entry.revisionNumber)).toEqual([1, 2])

    await selector.vm.$emit('update:modelValue', `saved:${revisions[1]!.id}`)
    await selector.vm.$emit('update:modelValue', 'working')
    expect(wrapper.emitted('selectRevision')).toEqual([[revisions[1]!.id], [null]])
    await wrapper.setProps({ revisionHistoryUnavailable: true })
    expect(selector.props('disabled')).toBe(true)
  })
})
