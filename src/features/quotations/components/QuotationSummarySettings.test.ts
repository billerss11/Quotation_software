// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import Checkbox from 'primevue/checkbox'
import MultiSelect from 'primevue/multiselect'
import Select from 'primevue/select'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAppI18n } from '@/shared/i18n/createAppI18n'
import type { QuotationOutputSettings } from '../types'
import QuotationSummarySettings from './QuotationSummarySettings.vue'

const sections = [
  { id: 'equipment', title: 'Equipment', itemCount: 2, subtotal: 125 },
  { id: 'piping', title: 'Piping', itemCount: 3, subtotal: 250 },
]
const items = [
  { id: 'package', name: 'Equipment package', description: '', itemNumber: '1', depth: 1, ancestorIds: [], subtotal: 125 },
  { id: 'valve', name: 'Valve', description: 'Gate valve', itemNumber: '1.1', depth: 2, ancestorIds: ['package'], subtotal: 75 },
  { id: 'pipe', name: 'Pipe', description: '', itemNumber: '2', depth: 1, ancestorIds: [], subtotal: 250 },
]

function mountSettings(settings: QuotationOutputSettings) {
  return mount(QuotationSummarySettings, {
    props: { settings, sections, items, currency: 'USD', documentLocale: 'en-US' },
    global: { plugins: [createAppI18n('en-US'), [PrimeVue, { unstyled: true }]] },
  })
}

describe('QuotationSummarySettings', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      unobserve() {}
      disconnect() {}
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('edits the document note as plain text and preserves an explicit blank', async () => {
    const settings: QuotationOutputSettings = { itemDetailLevel: 3, subtotalLabel: 'Material Cost', showInformationalTotals: true }
    const wrapper = mountSettings(settings)
    const note = wrapper.get<HTMLTextAreaElement>('textarea')
    expect(note.element.value).toBe('Already included in Material Cost.')
    const customNote = 'For information only.\nAmounts form part of this quotation.'
    await note.setValue(customNote)
    await note.trigger('blur')
    expect(wrapper.emitted('updateSettings')?.[0]).toEqual([{ informationalTotalsNote: customNote }])
    expect(wrapper.emitted('updateRow')).toBeUndefined()

    await wrapper.setProps({ settings: { ...settings, subtotalLabel: 'Supply price', informationalTotalsNote: customNote }, documentLocale: 'zh-CN' })
    expect(note.element.value).toBe(customNote)
    await note.setValue('')
    await note.trigger('blur')
    expect(wrapper.emitted('updateSettings')?.at(-1)).toEqual([{ informationalTotalsNote: '' }])
    await wrapper.setProps({ settings: { ...settings, informationalTotalsNote: '' } })
    expect(note.element.value).toBe('')
    wrapper.unmount()
  })

  it('shows the default note in the document language while keeping the editor language', async () => {
    const wrapper = mountSettings({ itemDetailLevel: 3, subtotalLabel: '材料费用', showInformationalTotals: true })
    await wrapper.setProps({ documentLocale: 'zh-CN' })
    expect(wrapper.get<HTMLTextAreaElement>('textarea').element.value).toBe('已包含在“材料费用”中。')
    expect(wrapper.text()).toContain('Breakdown note')
    wrapper.unmount()
  })

  it('switches to selected items while retaining section choices and custom wording', async () => {
    const row = { id: 'row-1', label: 'Valve and piping', source: 'sections' as const, sectionIds: ['equipment'], itemIds: ['valve', 'pipe'], visible: true }
    const settings: QuotationOutputSettings = { itemDetailLevel: 1, showInformationalTotals: true, informationalTotals: [row] }
    const wrapper = mountSettings(settings)
    wrapper.getComponent(Select).vm.$emit('update:modelValue', 'items')
    expect(wrapper.emitted('updateRow')?.[0]).toEqual(['row-1', { source: 'items' }])
    await wrapper.setProps({ settings: { ...settings, informationalTotals: [{ ...row, source: 'items' }] } })
    expect(wrapper.getComponent(MultiSelect).props('modelValue')).toEqual(['valve', 'pipe'])
    expect(wrapper.get('.calculated-amount').text()).toContain('325.00')
    expect(wrapper.getComponent(MultiSelect).props('filterFields')).toEqual(['label', 'description'])

    await wrapper.setProps({ settings: { ...settings, informationalTotals: [{ ...row, source: 'items', itemIds: ['package', 'valve', 'pipe'] }] } })
    expect(wrapper.get('.calculated-amount').text()).toContain('375.00')
    expect(wrapper.props('settings')?.informationalTotals?.[0]?.sectionIds).toEqual(['equipment'])
    wrapper.unmount()
  })

  it('allows adding item-based totals without section headers', async () => {
    const wrapper = mountSettings({ itemDetailLevel: 3, showInformationalTotals: true })
    await wrapper.setProps({ sections: [] })
    const addButton = wrapper.findAll('button').find(button => button.text() === 'Add breakdown row')!
    expect(addButton.attributes('disabled')).toBeUndefined()
    await addButton.trigger('click')
    expect(wrapper.emitted('addRow')?.[0]).toEqual([expect.objectContaining({ source: 'items', itemIds: [], sectionIds: [], visible: true })])
    wrapper.unmount()
  })

  it('flags removed items only when the item source is active', async () => {
    const row = { id: 'row-1', label: 'Materials', sectionIds: ['equipment'], itemIds: ['valve', 'deleted'], visible: true }
    const settings: QuotationOutputSettings = { itemDetailLevel: 3, showInformationalTotals: true, informationalTotals: [row] }
    const wrapper = mountSettings(settings)
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
    await wrapper.setProps({ settings: { ...settings, informationalTotals: [{ ...row, source: 'items' }] } })
    expect(wrapper.get('[role="status"]').text()).toContain('Item removed')
    expect(wrapper.get('.calculated-amount').text()).not.toContain('75.00')
    expect(wrapper.getComponent(MultiSelect).props('options')).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'deleted' })]))
    wrapper.unmount()
  })

  it.each(['subtotalLabel', 'informationalTotalsNote'])('keeps imported row ID %s separate from setting edit buffers', async (id) => {
    const wrapper = mountSettings({
      itemDetailLevel: 3,
      showInformationalTotals: true,
      informationalTotals: [{ id, label: 'Equipment', sectionIds: ['equipment'], visible: true }],
    })
    const input = wrapper.get(`[data-summary-row="${id}"] input[type="text"]`)
    await input.setValue('Equipment only')
    await input.trigger('blur')
    expect(wrapper.emitted('updateRow')).toEqual([[id, { label: 'Equipment only' }]])
    expect(wrapper.emitted('updateSettings')).toBeUndefined()
    wrapper.unmount()
  })

  it('edits wording and hides the breakdown without discarding rows', async () => {
    const settings: QuotationOutputSettings = {
      itemDetailLevel: 1,
      showInformationalTotals: true,
      informationalTotals: [{ id: 'row-1', label: '', sectionIds: ['equipment'], visible: true }],
    }
    const wrapper = mountSettings(settings)
    const input = wrapper.get('input[type="text"]')
    await input.setValue('Materials total')
    await input.trigger('blur')
    expect(wrapper.emitted('updateSettings')?.[0]).toEqual([{ subtotalLabel: 'Materials total' }])
    expect(wrapper.text()).toContain('125.00')

    wrapper.findAllComponents(Checkbox)[0]!.vm.$emit('update:modelValue', false)
    expect(wrapper.emitted('updateSettings')?.at(-1)).toEqual([{ showInformationalTotals: false }])
    await wrapper.setProps({ settings: { ...settings, showInformationalTotals: false } })
    expect(wrapper.find('[data-summary-row]').exists()).toBe(false)
    await wrapper.setProps({ settings })
    expect(wrapper.get('[data-summary-row="row-1"]').text()).toContain('125.00')
    wrapper.unmount()
  })

  it('shows a missing section instead of a misleading partial total and permits repair', async () => {
    const row = { id: 'row-1', label: 'Materials', sectionIds: ['equipment', 'deleted'], visible: true }
    const wrapper = mountSettings({ itemDetailLevel: 3, showInformationalTotals: true, informationalTotals: [row] })
    expect(wrapper.get('[role="status"]').text()).toContain('Section removed')
    expect(wrapper.get('.calculated-amount').text()).not.toContain('125.00')
    const picker = wrapper.getComponent(MultiSelect)
    expect(picker.props('options')).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'deleted' })]))
    picker.vm.$emit('update:modelValue', ['equipment', 'piping'])
    expect(wrapper.emitted('updateRow')?.[0]).toEqual(['row-1', { sectionIds: ['equipment', 'piping'] }])
    await wrapper.setProps({ settings: { itemDetailLevel: 3, showInformationalTotals: true, informationalTotals: [{ ...row, sectionIds: ['equipment', 'piping'] }] } })
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
    expect(wrapper.get('.calculated-amount').text()).toContain('375.00')
    wrapper.unmount()
  })
})
