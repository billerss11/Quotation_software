import Aura from '@primevue/themes/aura'
import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import Select from 'primevue/select'
import { describe, expect, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { defineComponent, h, nextTick, ref, shallowRef } from 'vue'

import '@/assets/main.css'
import { createAppI18n } from '@/shared/i18n/createAppI18n'
import { useQuotationOutlineMoves } from '../composables/useQuotationOutlineMoves'
import { createInitialQuotation } from '../utils/quotationDraft'
import { createQuotationItem, moveQuotationTreeRow } from '../utils/quotationItems'
import QuotationMoveConfirmation from './QuotationMoveConfirmation.vue'
import QuotationNavigator from './QuotationNavigator.vue'

describe('outline move dialog focus', () => {
  it.each(['Cancel', 'Escape'] as const)('restores the source handle after %s closes pricing confirmation', async action => {
    const harness = mountHarness()
    try {
      const handle = await openPricingConfirmation(harness.wrapper)
      if (action === 'Escape') await userEvent.keyboard('{Escape}')
      else await userEvent.click(document.querySelector<HTMLButtonElement>('.p-dialog-footer button')!)

      await waitForDialogClose()
      expect(document.activeElement).toBe(handle)
      expect(harness.quotation.value.majorItems).toHaveLength(2)
    } finally {
      harness.wrapper.unmount()
    }
  })

  it('keeps focus on the revealed moved row after pricing confirmation finishes closing', async () => {
    const harness = mountHarness()
    try {
      await openPricingConfirmation(harness.wrapper)
      await page.getByRole('button', { name: 'Move', exact: true }).click()
      await waitForDialogClose()

      const movedEntry = harness.wrapper.get('[data-nav-row-id="source"] .nav-entry').element
      expect(document.activeElement).toBe(movedEntry)
      expect(harness.quotation.value.majorItems).toHaveLength(1)
      expect(harness.wrapper.get('[role="status"]').text()).toBe('Moved source')
    } finally {
      harness.wrapper.unmount()
    }
  })
})

function mountHarness() {
  const quotation = ref(createInitialQuotation([], 'en-US'))
  quotation.value.majorItems = ['target', 'source'].map(id => createQuotationItem('USD', { id, name: id, unitCost: 10 }))
  quotation.value.totalsConfig.globalMarkupRate = 0
  const navigator = shallowRef<InstanceType<typeof QuotationNavigator> | null>(null)
  const workflow = useQuotationOutlineMoves({
    quotation,
    canMove: () => true,
    flushPendingEdits() {},
    move(itemId, parentId, index, mode) {
      moveQuotationTreeRow(quotation.value.majorItems, itemId, parentId, index, mode)
      return true
    },
    async onMoved(itemId) {
      await nextTick()
      await navigator.value?.revealMovedItem(itemId)
    },
    onStale() {},
  })
  const Host = defineComponent({
    setup: () => () => h('div', [
      h(QuotationNavigator, { ref: navigator, items: quotation.value.majorItems, onMoveQuotationTreeRow: workflow.requestMove }),
      h(QuotationMoveConfirmation, {
        impact: workflow.pendingMove.value?.impact ?? null,
        currency: 'USD',
        disabled: false,
        onConfirm: workflow.confirmMove,
        onCancel: workflow.cancelMove,
      }),
    ]),
  })
  const wrapper = mount(Host, {
    attachTo: document.body,
    global: {
      plugins: [createAppI18n('en-US'), [PrimeVue, { theme: { preset: Aura } }]],
      stubs: { transition: false },
    },
  })
  return { wrapper, quotation }
}

async function openPricingConfirmation(wrapper: ReturnType<typeof mountHarness>['wrapper']) {
  const handle = wrapper.get('[data-nav-row-id="source"] .nav-drag-handle').element as HTMLButtonElement
  handle.focus()
  await userEvent.keyboard('{Enter}')
  await waitForDialogOpen('Move source')
  await wrapper.getComponent(Select).vm.$emit('update:modelValue', 'item:target')
  await wrapper.vm.$nextTick()
  await wrapper.findAllComponents(Select)[1]!.vm.$emit('update:modelValue', 'inside')
  await wrapper.vm.$nextTick()
  await page.getByRole('button', { name: 'Move', exact: true }).click()
  await waitForDialogOpen('Review pricing before moving')
  return handle
}

async function waitForDialogOpen(title: string) {
  await vi.waitFor(() => {
    expect(document.querySelector('.p-dialog-enter-active')).toBeNull()
    expect(document.querySelector('.p-dialog-header')?.textContent).toBe(title)
  })
}

async function waitForDialogClose() {
  await vi.waitFor(() => expect(document.querySelector('.p-dialog')).toBeNull())
}
