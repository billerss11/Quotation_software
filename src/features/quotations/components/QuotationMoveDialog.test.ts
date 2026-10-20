// @vitest-environment jsdom

import { enableAutoUnmount, mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import Select from 'primevue/select'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createAppI18n } from '@/shared/i18n/createAppI18n'
import type { QuotationItem, QuotationRootItem } from '../types'
import QuotationMoveDialog from './QuotationMoveDialog.vue'

enableAutoUnmount(afterEach)

describe('QuotationMoveDialog', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {} })))
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it.each([
    ['root-start', 0],
    ['root-end', 3],
  ])('moves a nested item to %s', async (destination, index) => {
    const wrapper = mountDialog('leaf')
    await wrapper.getComponent(Select).vm.$emit('update:modelValue', destination)
    await wrapper.vm.$nextTick()
    expect(wrapper.get('[data-move-confirm]').attributes('disabled')).toBeUndefined()
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('move')).toEqual([['leaf', null, index, 'before']])
  })

  it.each([
    ['before', 'root', 0],
    ['inside', 'group', 1],
    ['after', 'root', 1],
  ])('moves relative to a nested destination using %s', async (mode, parentId, index) => {
    const wrapper = mountDialog('loose')
    await chooseDestination(wrapper, 'group', mode)
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('move')).toEqual([['loose', parentId, index, mode]])
  })

  it.each([
    ['root', 'group', 'inside', 'itself or its descendants'],
    ['loose', 'leaf', 'inside', 'three levels'],
    ['section', 'group', 'before', 'top level'],
    ['leaf', 'leaf', 'before', 'already in this position'],
  ])('blocks invalid %s to %s moves', async (source, destination, position, message) => {
    const wrapper = mountDialog(source)
    await chooseDestination(wrapper, destination, position)
    expect(wrapper.get('[data-move-confirm]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[role="status"]').text()).toContain(message)
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('move')).toBeUndefined()
  })

  it('includes all nested rows and section headers and disallows inside a section', async () => {
    const wrapper = mountDialog('loose')
    expect(wrapper.getComponent(Select).props('options')!.map((entry: { label: string }) => entry.label)).toEqual([
      'Start of quotation', '1 Root', '1.1 Group', '1.1.1 Leaf', 'Section', '2 Loose', 'End of quotation',
    ])
    await chooseDestination(wrapper, 'section', 'before')
    const positions = wrapper.findAllComponents(Select)[1]!.props('options') as { value: string; disabled: boolean }[]
    expect(positions.find((entry) => entry.value === 'inside')!.disabled).toBe(true)
  })

  it('cancels without requesting a move', async () => {
    const wrapper = mountDialog('loose')
    await wrapper.get('button[type="button"]').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
    expect(wrapper.emitted('move')).toBeUndefined()
  })

  it('lets the keyboard choose the end of the quotation', async () => {
    const wrapper = mountDialog('leaf')
    const destination = wrapper.get('[role="combobox"]')
    await destination.trigger('keydown', { key: ' ', code: 'Space' })
    await destination.trigger('keydown', { key: 'End', code: 'End' })
    await destination.trigger('keydown', { key: 'Enter', code: 'Enter' })
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('move')).toEqual([['leaf', null, 3, 'before']])
  })
})

function item(id: string, name: string, children: QuotationItem[] = []): QuotationItem {
  return { id, name, description: '', quantity: 1, quantityUnit: 'pc', unitCost: 1, costCurrency: 'USD', children }
}

function mountDialog(itemId: string) {
  const items: QuotationRootItem[] = [
    item('root', 'Root', [item('group', 'Group', [item('leaf', 'Leaf')])]),
    { id: 'section', kind: 'section_header', title: 'Section' },
    item('loose', 'Loose'),
  ]
  return mount(QuotationMoveDialog, {
    props: { items, itemId },
    global: {
      plugins: [createAppI18n('en-US'), PrimeVue],
      stubs: { Dialog: { template: '<section><slot /></section>' } },
    },
    attachTo: document.body,
  })
}

async function chooseDestination(wrapper: ReturnType<typeof mountDialog>, itemId: string, mode: string) {
  await wrapper.getComponent(Select).vm.$emit('update:modelValue', `item:${itemId}`)
  await wrapper.vm.$nextTick()
  await wrapper.findAllComponents(Select)[1]!.vm.$emit('update:modelValue', mode)
  await wrapper.vm.$nextTick()
}
