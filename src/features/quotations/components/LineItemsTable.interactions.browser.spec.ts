import Aura from '@primevue/themes/aura'
import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import { defineComponent, h, shallowRef } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import '@/assets/main.css'
import { createAppI18n } from '@/shared/i18n/createAppI18n'

import { useQuotationEditor } from '../composables/useQuotationEditor'
import type { QuotationItem } from '../types'
import { createQuotationItem, isQuotationItem } from '../utils/quotationItems'
import LineItemsTable from './LineItemsTable.vue'
import QuotationNavigator from './QuotationNavigator.vue'

describe('large quotation item interactions', () => {
  it('moves, duplicates, adds and deletes rows using the scrolled editor controls', async () => {
    const workspace = await mountWorkspace()
    try {
      await workspace.select('Root 351')
      const root = page
      const moveButton = document.querySelector<HTMLElement>('[aria-label="Move item 351 up"]')!
      const moveBounds = moveButton.getBoundingClientRect()
      expect(moveBounds.top, JSON.stringify(moveBounds.toJSON())).toBeGreaterThanOrEqual(0)
      expect(moveBounds.bottom, JSON.stringify(moveBounds.toJSON())).toBeLessThanOrEqual(window.innerHeight)
      expect(moveBounds.right, JSON.stringify(moveBounds.toJSON())).toBeLessThanOrEqual(window.innerWidth)
      await root.getByRole('button', { name: workspace.t('quotations.lineItems.moveItemUpAria', { index: 351 }), exact: true }).click()
      expect(workspace.editor.quotation.value.majorItems[349]?.id).toBe('root-350')
      await root.getByRole('button', { name: workspace.t('quotations.lineItems.moveItemDownAria', { index: 350 }), exact: true }).click()
      expect(workspace.editor.quotation.value.majorItems[350]?.id).toBe('root-350')

      await root.getByRole('button', { name: workspace.t('quotations.lineItems.duplicateItemAria', { index: 351 }), exact: true }).click()
      const duplicate = workspace.editor.quotation.value.majorItems[351]!
      expect(duplicate.id).not.toBe('root-350')
      expect(isQuotationItem(duplicate) && duplicate.children).toHaveLength(1)
      await vi.waitFor(() => expect(workspace.focusedId.value).toBe(duplicate.id))
      await vi.waitFor(() => expect(document.querySelector(`.item-card[data-item-id="${duplicate.id}"]`)).not.toBeNull())
      await page.getByRole('button', { name: workspace.t('quotations.lineItems.deleteItemAria', { index: 352 }), exact: true }).click()
      expect(workspace.editor.quotation.value.majorItems.some(item => item.id === duplicate.id)).toBe(false)

      workspace.focus('root-350')
      await vi.waitFor(() => expect(document.querySelector('.item-card[data-item-id="root-350"] .item-card-panel')).not.toBeNull())
      await page.getByRole('button', { name: workspace.t('quotations.lineItems.addChildItemAria', { index: 351 }), exact: true }).click()
      const parent = workspace.item('root-350')
      expect(parent.children).toHaveLength(2)
      await vi.waitFor(() => expect(workspace.focusedId.value).toBe(parent.children[1]!.id))
      await page.getByRole('button', { name: workspace.t('quotations.lineItems.deleteLineItemAria', { itemNumber: '351.2' }), exact: true }).click()
      expect(parent.children).toHaveLength(1)

      await page.getByRole('button', { name: workspace.t('quotations.lineItems.addRootAria'), exact: true }).click()
      expect(workspace.editor.quotation.value.majorItems).toHaveLength(364)
      const addedRoot = workspace.editor.quotation.value.majorItems.at(-1)!
      await vi.waitFor(() => {
        expect(workspace.focusedId.value).toBe(addedRoot.id)
        expect(document.querySelector(`.item-card[data-item-id="${addedRoot.id}"]`)).not.toBeNull()
      })
      await page.getByRole('button', { name: workspace.t('quotations.lineItems.addSectionHeaderAria'), exact: true }).click()
      expect(workspace.editor.quotation.value.majorItems.at(-1)).toMatchObject({ kind: 'section_header' })
      const addedSection = workspace.editor.quotation.value.majorItems.at(-1)!
      await vi.waitFor(() => {
        expect(workspace.focusedId.value).toBe(addedSection.id)
        const section = document.querySelector<HTMLElement>(`.section-header-row[data-item-id="${addedSection.id}"]`)
        expect(section).not.toBeNull()
        expect(section!.getBoundingClientRect().bottom).toBeLessThanOrEqual(workspace.editorScroll.getBoundingClientRect().bottom)
      })
    } finally { workspace.cleanup() }
  })

  it('reveals searched virtual children and keeps row edits when the root leaves the viewport', async () => {
    const workspace = await mountWorkspace()
    try {
      await workspace.select('Detail 36')
      await vi.waitFor(() => expect(document.querySelector('.ct-row[data-item-id="detail-35"]')).not.toBeNull())
      const name = page.getByRole('textbox', { name: workspace.t('quotations.lineItems.lineItemNameAria', { itemNumber: '351.1.36' }), exact: true })
      await name.fill('Edited before scrolling')
      workspace.editorScroll.scrollTop = 0
      workspace.editorScroll.dispatchEvent(new Event('scroll'))
      await vi.waitFor(() => expect(document.querySelector('.item-card[data-item-id="root-350"]')).toBeNull())
      expect(workspace.item('detail-35').name).toBe('Edited before scrolling')

      await workspace.select('Root 352')
      const root = page
      const cost = root.getByRole('spinbutton', { name: workspace.t('quotations.lineItems.itemUnitCostAria', { index: 352 }), exact: true })
      await cost.fill('250')
      await root.getByRole('combobox', { name: workspace.t('quotations.lineItems.itemPricingBasisAria', { index: 352 }), exact: true }).click()
      await page.getByRole('option', { name: workspace.t('quotations.lineItems.pricingBasisOptions.manualPrice'), exact: true }).click()
      expect(workspace.item('root-351').unitCost).toBe(250)
      expect(workspace.item('root-351').pricingMethod).toBe('manual_price')
      expect(workspace.item('root-351').manualUnitPrice).toBe(275)
    } finally { workspace.cleanup() }
  })

  it('applies and cancels the description dialog and opens item calculations after scrolling', async () => {
    const workspace = await mountWorkspace()
    try {
      await workspace.select('Root 352')
      const root = page
      const openDescription = () => root.getByRole('button', { name: workspace.t('quotations.lineItems.descriptionEditor.openAria', { itemNumber: '352' }), exact: true }).click()
      await openDescription()
      await page.getByRole('dialog').getByRole('textbox').fill('Description applied from dialog')
      await page.getByRole('dialog').getByRole('button', { name: workspace.t('quotations.textEditor.apply'), exact: true }).click()
      expect(workspace.item('root-351').description).toBe('Description applied from dialog')
      await openDescription()
      await page.getByRole('dialog').getByRole('textbox').fill('Discard this change')
      await page.getByRole('dialog').getByRole('button', { name: workspace.t('quotations.textEditor.cancel'), exact: true }).click()
      expect(workspace.item('root-351').description).toBe('Description applied from dialog')

      await root.getByRole('button', { name: workspace.t('quotations.lineItems.calculationExplanation.openAria', { itemNumber: 352 }), exact: true }).click()
      await expect.element(page.getByRole('dialog')).toBeVisible()
      await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click()
      await root.getByRole('button', { name: workspace.t('quotations.lineItems.calculationSheet.openAria', { itemNumber: 352 }), exact: true }).click()
      await expect.element(page.getByRole('dialog')).toHaveTextContent('Calculation Sheet')
    } finally { workspace.cleanup() }
  })

  it('jumps to the exact incomplete child inside a folded virtualized group', async () => {
    const workspace = await mountWorkspace()
    try {
      await page.getByRole('button', { name: workspace.t('quotations.lineItems.jumpToIncomplete'), exact: true }).click()
      await vi.waitFor(() => {
        const child = document.querySelector<HTMLElement>('.ct-row[data-item-id="detail-35"]')
        expect(child, 'the incomplete detail row must be mounted and revealed').not.toBeNull()
        const bounds = child!.getBoundingClientRect()
        const panel = workspace.editorScroll.getBoundingClientRect()
        expect(bounds.top).toBeGreaterThanOrEqual(panel.top)
        expect(bounds.bottom).toBeLessThanOrEqual(panel.bottom)
      })
    } finally { workspace.cleanup() }
  })

  it('collapses and expands root and nested levels without losing the selected item', async () => {
    const workspace = await mountWorkspace()
    try {
      await workspace.select('Root 351')
      await page.getByRole('button', { name: workspace.t('quotations.lineItems.expandItemLevelsAria', { index: 351 }), exact: true }).click()
      await page.getByRole('button', { name: workspace.t('quotations.lineItems.collapseItemLevelsAria', { index: 351 }), exact: true }).click()
      expect(document.querySelector('.item-card[data-item-id="root-350"] .item-card-panel')).toBeNull()
      await page.getByRole('button', { name: workspace.t('quotations.lineItems.expandItemLevelsAria', { index: 351 }), exact: true }).click()
      await vi.waitFor(() => expect(document.querySelector('.ct-row[data-item-id="detail-0"]')).not.toBeNull())
      const toggle = () => page.elementLocator(document.querySelector<HTMLElement>('.ct-row[data-item-id="nested-group"] .ct-section-toggle')!)
      await toggle().click()
      expect(document.querySelector('.ct-row[data-item-id="detail-0"]')).toBeNull()
      await toggle().click()
      await vi.waitFor(() => expect(document.querySelector('.ct-row[data-item-id="detail-0"]')).not.toBeNull())
    } finally { workspace.cleanup() }
  })

  it('keeps outline context actions clickable and selects the created row', async () => {
    const workspace = await mountWorkspace()
    const openContext = async (id: string) => {
      await page.elementLocator(document.querySelector<HTMLElement>(`[data-nav-row-id="${id}"] .nav-entry`)!).click({ button: 'right' })
      await vi.waitFor(() => {
        const menu = document.querySelector<HTMLElement>('.navigator-context-menu')!
        expect(menu).not.toBeNull()
        for (const action of menu.querySelectorAll<HTMLElement>('[role="menuitem"]')) {
          const bounds = action.getBoundingClientRect()
          const hit = document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2)
          expect(hit && action.contains(hit), action.textContent ?? '').toBe(true)
        }
      })
    }
    try {
      await workspace.select('Root 351')
      await openContext('root-350')
      await page.getByRole('menuitem', { name: workspace.t('quotations.lineItems.addChildItem'), exact: true }).click()
      const child = workspace.item('root-350').children[1]!
      await vi.waitFor(() => expect(workspace.focusedId.value).toBe(child.id))
      await openContext('root-350')
      await page.getByRole('menuitem', { name: workspace.t('quotations.lineItems.duplicate'), exact: true }).click()
      const duplicate = workspace.editor.quotation.value.majorItems[351]!
      await vi.waitFor(() => expect(workspace.focusedId.value).toBe(duplicate.id))
      await openContext(duplicate.id)
      await page.getByRole('menuitem', { name: workspace.t('quotations.lineItems.delete'), exact: true }).click()
      expect(workspace.editor.quotation.value.majorItems.some(item => item.id === duplicate.id)).toBe(false)
    } finally { workspace.cleanup() }
  })

  it('disables outline dragging while searching and reorders roots after clearing search', async () => {
    const workspace = await mountWorkspace()
    try {
      await workspace.select('Root 351')
      expect(document.querySelector<HTMLButtonElement>('[data-nav-row-id="root-350"] .nav-drag-handle')?.disabled).toBe(true)
      await page.getByRole('button', { name: workspace.t('quotations.lineItems.navigator.clearSearch'), exact: true }).click()
      const outline = document.querySelector<HTMLElement>('aside.items-outline')!
      outline.scrollTop = 0
      const handle = page.getByRole('button', { name: workspace.t('quotations.lineItems.navigator.dragHandleAria', { label: 'Root 1' }), exact: true })
      const dropzone = page.elementLocator(document.querySelector<HTMLElement>('[data-dropzone-index="2"]')!)
      await userEvent.dragAndDrop(handle, dropzone)
      expect(workspace.editor.quotation.value.majorItems[0]?.id).toBe('root-1')
      expect(workspace.editor.quotation.value.majorItems[1]?.id).toBe('root-0')
      await userEvent.dragAndDrop(handle, page.elementLocator(document.querySelector<HTMLElement>('[data-nav-row-id="root-1"] .nav-entry')!))
      expect(workspace.item('root-1').children[0]?.id).toBe('root-0')
      expect(workspace.editor.quotation.value.majorItems.some(item => item.id === 'root-0')).toBe(false)
      await page.elementLocator(document.querySelector<HTMLElement>('[data-nav-row-id="root-1"] .nav-toggle')!).click()
      await userEvent.dragAndDrop(handle, page.elementLocator(document.querySelector<HTMLElement>('[data-dropzone-index="1"]')!))
      expect(workspace.item('root-1').children).toHaveLength(0)
      expect(workspace.editor.quotation.value.majorItems[1]?.id).toBe('root-0')
    } finally { workspace.cleanup() }
  })

  it('auto-scrolls the outline scroll surface when dragging near its bottom edge', async () => {
    const workspace = await mountWorkspace()
    const outline = document.querySelector<HTMLElement>('aside.items-outline')!
    const handle = outline.querySelector<HTMLElement>('.nav-drag-handle')!
    try {
      const transfer = new DataTransfer()
      handle.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: transfer }))
      const bounds = outline.getBoundingClientRect()
      const target = document.elementFromPoint(bounds.left + bounds.width / 2, bounds.bottom - 10)!.closest<HTMLElement>('.nav-row')!
      target.dispatchEvent(new DragEvent('dragover', {
        bubbles: true, cancelable: true, dataTransfer: transfer,
        clientX: bounds.left + bounds.width / 2, clientY: bounds.bottom - 10,
      }))
      await vi.waitFor(() => expect(outline.scrollTop).toBeGreaterThan(0), { timeout: 500 })
    } finally {
      handle.dispatchEvent(new DragEvent('dragend', { bubbles: true }))
      workspace.cleanup()
    }
  })
})

async function mountWorkspace() {
  await page.viewport(1440, 1000)
  const host = document.createElement('div')
  host.style.cssText = 'position: fixed; inset: 20px;'
  document.body.appendChild(host)
  const i18n = createAppI18n('en-US')
  let editor!: ReturnType<typeof useQuotationEditor>
  const focusedId = shallowRef('')
  const focusedKey = shallowRef(0)
  const scrollRef = shallowRef<HTMLElement | null>(null)
  function focus(itemId: string) { focusedId.value = itemId; focusedKey.value++ }
  const Harness = defineComponent({
    setup() {
      editor = useQuotationEditor(shallowRef('en-US'))
      editor.quotation.value.header.currency = 'USD'
      editor.quotation.value.exchangeRates = { USD: 1, CNY: 0.14 }
      editor.quotation.value.totalsConfig = { globalMarkupRate: 10, taxMode: 'single', defaultTaxClassId: 'standard', taxClasses: [{ id: 'standard', label: 'Standard 13%', rate: 13 }] }
      editor.replaceLineItems(createItems())
      return () => h('div', { style: 'display: grid; grid-template-columns: 240px minmax(0, 1fr); gap: 16px; height: calc(100vh - 40px); overflow: hidden;' }, [
        h('aside', { class: 'items-outline', style: 'overflow: auto; min-height: 0; padding: 12px;' }, [h(QuotationNavigator, {
          items: editor.quotation.value.majorItems, selectedItemId: focusedId.value,
          onSelectItem: focus, onAddChildItem: editor.addChildItem, onRemoveItem: editor.removeItem,
          onDuplicateRootItem: editor.duplicateRootItem, onMoveRootRowToIndex: editor.moveRootRowToIndex,
          onMoveQuotationTreeRow: editor.moveQuotationTreeRow,
        })]),
        h('div', { ref: (element) => { scrollRef.value = element as HTMLElement }, style: 'overflow: auto; min-height: 0; padding: 12px 14px 0;' }, [h(LineItemsTable, {
          items: editor.quotation.value.majorItems, itemSummaries: editor.itemSummaries.value,
          currency: 'USD', grandTotal: editor.totals.value.grandTotal, globalMarkupRate: 10,
          totalsConfig: editor.quotation.value.totalsConfig, exchangeRates: editor.quotation.value.exchangeRates,
          costCurrencyOptions: ['USD', 'CNY'], quotationCurrencyOptions: ['USD', 'CNY'], scrollContainer: scrollRef.value,
          focusedItemId: focusedId.value, focusedItemRequestKey: focusedKey.value,
          onAddRootItem: editor.addRootItem, onAddSectionHeader: editor.addSectionHeader,
          onAddChildItem: editor.addChildItem, onRemoveItem: editor.removeItem,
          onDuplicateRootItem: editor.duplicateRootItem, onMoveRootItem: editor.moveRootItem,
          onUpdateItemField: editor.updateItemField, onSetItemPricingMethod: editor.setItemPricingMethod,
          onUpdateSectionHeaderTitle: editor.updateSectionHeaderTitle,
          onRequestFocusItem: focus,
        })]),
      ])
    },
  })
  const wrapper = mount(Harness, {
    attachTo: host,
    global: { plugins: [i18n, [PrimeVue, { theme: { preset: Aura } }]], directives: { tooltip: {} }, stubs: { transition: false } },
  })
  await document.fonts.ready
  return {
    editor, focus, focusedId, t: i18n.global.t, editorScroll: scrollRef.value!,
    item: (id: string): QuotationItem => {
      const find = (items: QuotationItem[]): QuotationItem | undefined => items.find(item => item.id === id) ?? items.flatMap(item => find(item.children) ?? []).at(0)
      const item = find(editor.quotation.value.majorItems.filter(isQuotationItem))
      if (!item) throw new Error(`Missing synthetic item ${id}`)
      return item
    },
    select: async (query: string) => {
      const search = page.getByRole('searchbox', { name: i18n.global.t('quotations.lineItems.navigator.searchAria'), exact: true })
      await search.fill(query)
      await userEvent.keyboard('{Enter}')
      await vi.waitFor(() => {
        const target = document.querySelector<HTMLElement>(`[data-item-focus-anchor="${focusedId.value}"]`)
          ?? document.querySelector<HTMLElement>(`.ct-row[data-item-id="${focusedId.value}"]`)
        expect(target, focusedId.value).not.toBeNull()
        const bounds = target!.getBoundingClientRect()
        expect(bounds.top, JSON.stringify(bounds.toJSON())).toBeGreaterThanOrEqual(scrollRef.value!.getBoundingClientRect().top)
        expect(bounds.bottom, JSON.stringify(bounds.toJSON())).toBeLessThanOrEqual(scrollRef.value!.getBoundingClientRect().bottom)
        expect(bounds.right, JSON.stringify(bounds.toJSON())).toBeLessThanOrEqual(window.innerWidth)
      })
    },
    cleanup: () => { wrapper.unmount(); host.remove() },
  }
}

function createItems() {
  const items = Array.from({ length: 363 }, (_, index) => createQuotationItem('USD', {
    id: `root-${index}`, name: `Root ${index + 1}`, quantityUnit: 'piece', unitCost: 100,
  }))
  items[350]!.children = [createQuotationItem('USD', {
    id: 'nested-group', name: 'Nested assembly', quantityUnit: 'set',
    children: Array.from({ length: 40 }, (_, index) => createQuotationItem('USD', {
      id: `detail-${index}`, name: `Detail ${index + 1}`, quantityUnit: 'piece', unitCost: index === 35 ? 0 : 100,
    })),
  })]
  return items
}
