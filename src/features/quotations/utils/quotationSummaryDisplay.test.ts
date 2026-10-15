import { describe, expect, it } from 'vitest'

import type { QuotationOutputSettings } from '../types'
import { calculateMajorItemSummary, calculateQuotationTotals } from './quotationCalculations'
import { createInitialQuotation } from './quotationDraft'
import { createQuotationItem, createQuotationSectionHeader, getQuotationRootItems } from './quotationItems'
import { normalizeQuotationOutputSettings } from './quotationOutputSettings'
import { getQuotationSections, getQuotationSubtotalLabel, getQuotationSummaryItems, resolveQuotationInformationalTotals } from './quotationSummaryDisplay'

describe('quotation summary display', () => {
  it.each(['', '   ', ' First line\nSecond line \n '])('preserves explicit informational note text %j without adding it to old settings', (note) => {
    expect(normalizeQuotationOutputSettings({ itemDetailLevel: 1, informationalTotalsNote: note })).toEqual({ itemDetailLevel: 1, informationalTotalsNote: note })
    expect(normalizeQuotationOutputSettings({ itemDetailLevel: 1 })).toEqual({ itemDetailLevel: 1 })
  })

  it('builds numbered full-quotation item contributions with ancestor quantities, inherited markup, FX, and manual prices', () => {
    const quotation = createInitialQuotation([], 'en-US')
    quotation.exchangeRates = { USD: 1, EUR: 1.2 }
    quotation.majorItems = [
      createQuotationSectionHeader('en-US', { id: 'header' }),
      createQuotationItem('USD', {
        id: 'package', quantity: 2, markupRate: 25,
        children: [createQuotationItem('USD', {
          id: 'assembly', quantity: 3,
          children: [
            createQuotationItem('EUR', { id: 'fx', name: 'Imported part', quantity: 2, unitCost: 10 }),
            createQuotationItem('USD', { id: 'manual', name: 'Manual part', pricingMethod: 'manual_price', manualUnitPrice: 7 }),
          ],
        })],
      }),
      createQuotationSectionHeader('en-US', { id: 'second-header' }),
      createQuotationItem('USD', { id: 'second', unitCost: 5, quantity: 3 }),
    ]
    const summaries = getQuotationRootItems(quotation.majorItems).map((item) =>
      calculateMajorItemSummary(item, quotation.totalsConfig, quotation.exchangeRates),
    )
    const items = getQuotationSummaryItems(quotation, summaries)

    expect(items.map(({ id, itemNumber, depth, ancestorIds, subtotal }) => ({ id, itemNumber, depth, ancestorIds, subtotal }))).toEqual([
      { id: 'package', itemNumber: '1', depth: 1, ancestorIds: [], subtotal: 222 },
      { id: 'assembly', itemNumber: '1.1', depth: 2, ancestorIds: ['package'], subtotal: 222 },
      { id: 'fx', itemNumber: '1.1.1', depth: 3, ancestorIds: ['package', 'assembly'], subtotal: 180 },
      { id: 'manual', itemNumber: '1.1.2', depth: 3, ancestorIds: ['package', 'assembly'], subtotal: 42 },
      { id: 'second', itemNumber: '2', depth: 1, ancestorIds: [], subtotal: 16.5 },
    ])
    expect(items.find((item) => item.id === 'fx')).toMatchObject({ name: 'Imported part', description: '' })
    const settings: QuotationOutputSettings = {
      itemDetailLevel: 1, showInformationalTotals: true,
      informationalTotals: [{ id: 'selected', label: '', source: 'items', sectionIds: ['deleted-inactive-section'], itemIds: ['fx', 'fx', 'manual'], visible: true }],
    }
    expect(resolveQuotationInformationalTotals(settings, [], items)[0]).toMatchObject({ amount: 222, label: 'Imported part + Manual part', missingSectionIds: [], missingItemIds: [] })
    settings.informationalTotals![0]!.itemIds = ['fx', 'package', 'assembly', 'manual']
    expect(resolveQuotationInformationalTotals(settings, [], items)[0]!.amount).toBe(222)
    settings.informationalTotals![0]!.itemIds = ['fx']
    expect(resolveQuotationInformationalTotals(settings, [], items)[0]!.amount).toBe(180)
  })

  it('retains hierarchy rounding through two fractional ancestor multipliers', () => {
    const quotation = createInitialQuotation([], 'en-US')
    quotation.majorItems = [createQuotationItem('USD', {
      id: 'root', quantity: 1.25, children: [createQuotationItem('USD', {
        id: 'group', quantity: 1.25, children: [
          createQuotationItem('USD', { id: 'a', pricingMethod: 'manual_price', manualUnitPrice: 0.01 }),
          createQuotationItem('USD', { id: 'b', pricingMethod: 'manual_price', manualUnitPrice: 0.03 }),
        ],
      })],
    })]
    const summary = calculateMajorItemSummary(getQuotationRootItems(quotation.majorItems)[0]!, quotation.totalsConfig, quotation.exchangeRates)
    const items = getQuotationSummaryItems(quotation, [summary])

    expect(items.map((item) => item.subtotal)).toEqual([0.06, 0.06, 0.01, 0.05])
    const settings: QuotationOutputSettings = {
      itemDetailLevel: 1, showInformationalTotals: true,
      informationalTotals: [{ id: 'leaves', label: '', source: 'items', sectionIds: [], itemIds: ['a', 'b'], visible: true }],
    }
    expect(resolveQuotationInformationalTotals(settings, [], items)[0]!.amount).toBe(summary.subtotal)
    settings.informationalTotals![0]!.itemIds = ['a']
    expect(resolveQuotationInformationalTotals(settings, [], items)[0]!.amount).toBe(0.01)
  })

  it('propagates a parent-assigned cent when every child initially scales to zero', () => {
    const quotation = createInitialQuotation([], 'en-US')
    quotation.majorItems = [createQuotationItem('USD', {
      id: 'root', quantity: 0.25, children: [
        createQuotationItem('USD', { id: 'first', pricingMethod: 'manual_price', manualUnitPrice: 0.01 }),
        createQuotationItem('USD', { id: 'group', quantity: 0.25, children: [
          createQuotationItem('USD', { id: 'a', pricingMethod: 'manual_price', manualUnitPrice: 0.01 }),
          createQuotationItem('USD', { id: 'b', pricingMethod: 'manual_price', manualUnitPrice: 0.01 }),
        ] }),
      ],
    })]
    const summary = calculateMajorItemSummary(getQuotationRootItems(quotation.majorItems)[0]!, quotation.totalsConfig, quotation.exchangeRates)
    const items = getQuotationSummaryItems(quotation, [summary])

    expect(summary.subtotal).toBe(0.01)
    expect(items.map((item) => item.subtotal)).toEqual([0.01, 0, 0.01, 0, 0.01])
    const settings: QuotationOutputSettings = {
      itemDetailLevel: 3, showInformationalTotals: true,
      informationalTotals: [{ id: 'leaves', label: '', source: 'items', sectionIds: [], itemIds: ['first', 'a', 'b'], visible: true }],
    }
    expect(resolveQuotationInformationalTotals(settings, [], items)[0]!.amount).toBe(summary.subtotal)
  })

  it('uses only the active source and reports missing item selections without partial amounts', () => {
    const settings: QuotationOutputSettings = {
      itemDetailLevel: 1, showInformationalTotals: true,
      informationalTotals: [{ id: 'row', label: '', sectionIds: ['section'], itemIds: ['deleted'], visible: true }],
    }
    const sections = [{ id: 'section', title: 'Equipment', itemCount: 1, subtotal: 100 }]
    expect(resolveQuotationInformationalTotals(settings, sections)[0]).toMatchObject({ amount: 100, label: 'Equipment', missingItemIds: [] })
    settings.informationalTotals![0]!.source = 'items'
    const items = [{ id: 'item', name: 'Part', description: '', itemNumber: '1', depth: 1, ancestorIds: [], subtotal: 100 }]
    settings.informationalTotals![0]!.itemIds = ['item', 'deleted', 'deleted']
    expect(resolveQuotationInformationalTotals(settings, sections, items)[0]).toMatchObject({ amount: null, missingItemIds: ['deleted'], missingSectionIds: [] })
    settings.informationalTotals![0]!.itemIds = []
    expect(resolveQuotationInformationalTotals(settings, sections, items)[0]).toMatchObject({ amount: null, missingItemIds: [] })
  })

  it('normalizes item source choices while retaining inactive section selections', () => {
    expect(normalizeQuotationOutputSettings({ itemDetailLevel: 1, informationalTotals: [
      { id: 'items', label: ' Typed ', sectionIds: ['old-section', 'old-section'], source: 'items', itemIds: ['deleted', 'deleted'], visible: true },
    ] })).toEqual({ itemDetailLevel: 1, informationalTotals: [
      { id: 'items', label: ' Typed ', sectionIds: ['old-section'], source: 'items', itemIds: ['deleted'], visible: true },
    ] })
  })

  it('uses canonical root rollups and ignores rows before the first section', () => {
    const quotation = createInitialQuotation([], 'en-US')
    quotation.exchangeRates = { USD: 1, EUR: 1.2 }
    quotation.majorItems = [
      createQuotationItem('USD', { id: 'unsectioned', unitCost: 999 }),
      createQuotationSectionHeader('en-US', { id: 'equipment', title: 'Equipment' }),
      createQuotationItem('USD', {
        id: 'package', quantity: 1.25, markupRate: 25,
        children: [
          createQuotationItem('EUR', { id: 'part', quantity: 3, unitCost: 10.01 }),
          createQuotationItem('USD', { id: 'manual', pricingMethod: 'manual_price', manualUnitPrice: 7.13 }),
        ],
      }),
      createQuotationSectionHeader('en-US', { id: 'piping', title: 'Piping' }),
      createQuotationItem('USD', { id: 'pipe', quantity: 3, unitCost: 0.1 }),
      createQuotationSectionHeader('en-US', { id: 'empty', title: 'Empty' }),
    ]
    const summaries = getQuotationRootItems(quotation.majorItems).map((item) =>
      calculateMajorItemSummary(item, quotation.totalsConfig, quotation.exchangeRates),
    )

    expect(getQuotationSections(quotation.majorItems, summaries)).toEqual([
      { id: 'equipment', title: 'Equipment', itemCount: 1, subtotal: summaries[1]!.subtotal },
      { id: 'piping', title: 'Piping', itemCount: 1, subtotal: 0.33 },
      { id: 'empty', title: 'Empty', itemCount: 0, subtotal: 0 },
    ])
  })

  it('tracks section membership by current position and retains IDs after renaming', () => {
    const first = createQuotationSectionHeader('en-US', { id: 'first', title: 'Original' })
    const second = createQuotationSectionHeader('en-US', { id: 'second', title: 'Second' })
    const a = createQuotationItem('USD', { id: 'a' })
    const b = createQuotationItem('USD', { id: 'b' })
    const summaries = [
      { itemId: 'a', baseSubtotal: 0, markupAmount: 0, subtotal: 1.01 },
      { itemId: 'b', baseSubtotal: 0, markupAmount: 0, subtotal: 2.02 },
    ]
    first.title = 'Renamed'

    expect(getQuotationSections([first, second, a, b], summaries)).toEqual([
      { id: 'first', title: 'Renamed', itemCount: 0, subtotal: 0 },
      { id: 'second', title: 'Second', itemCount: 2, subtotal: 3.03 },
    ])
  })

  it('deduplicates section selections within a row and preserves overlapping informational rows', () => {
    const sections = [
      { id: 'equipment', title: 'Equipment', itemCount: 1, subtotal: 1.01 },
      { id: 'piping', title: 'Piping', itemCount: 1, subtotal: 2.02 },
    ]
    const settings: QuotationOutputSettings = {
      itemDetailLevel: 1, showInformationalTotals: true,
      informationalTotals: [
        { id: 'all', label: ' ', sectionIds: ['equipment', 'piping', 'equipment'], visible: true },
        { id: 'equipment', label: ' Equipment price ', sectionIds: ['equipment'], visible: false },
      ],
    }

    expect(resolveQuotationInformationalTotals(settings, sections)).toEqual([
      { id: 'all', label: 'Equipment + Piping', sectionIds: ['equipment', 'piping'], visible: true, isVisible: true, amount: 3.03, missingSectionIds: [], missingItemIds: [] },
      { id: 'equipment', label: 'Equipment price', sectionIds: ['equipment'], visible: false, isVisible: false, amount: 1.01, missingSectionIds: [], missingItemIds: [] },
    ])
    settings.showInformationalTotals = false
    expect(resolveQuotationInformationalTotals(settings, sections).every((row) => !row.isVisible)).toBe(true)
  })

  it('reports empty and missing selections without displaying partial amounts', () => {
    const settings: QuotationOutputSettings = {
      itemDetailLevel: 3, showInformationalTotals: true,
      informationalTotals: [
        { id: 'missing', label: 'Materials', sectionIds: ['existing', 'deleted', 'deleted'], visible: true },
        { id: 'empty', label: '', sectionIds: [], visible: true },
      ],
    }
    const rows = resolveQuotationInformationalTotals(settings, [
      { id: 'existing', title: 'Equipment', itemCount: 1, subtotal: 100 },
    ])

    expect(rows[0]).toMatchObject({ amount: null, missingSectionIds: ['deleted'] })
    expect(rows[1]).toMatchObject({ amount: null, missingSectionIds: [] })
  })

  it('normalizes optional settings without legacy churn, losing hidden references, or trimming typed labels', () => {
    expect(normalizeQuotationOutputSettings(undefined)).toEqual({ itemDetailLevel: 3 })
    expect(normalizeQuotationOutputSettings({ itemDetailLevel: 1 })).toEqual({ itemDetailLevel: 1 })
    const normalized = normalizeQuotationOutputSettings({
      itemDetailLevel: 2, subtotalLabel: ' Materials subtotal ', showInformationalTotals: false,
      informationalTotals: [{ id: 'hidden', label: ' Equipment ', sectionIds: ['deleted', 'deleted'], visible: false }],
    })

    expect(normalized).toEqual({
      itemDetailLevel: 2, subtotalLabel: ' Materials subtotal ', showInformationalTotals: false,
      informationalTotals: [{ id: 'hidden', label: ' Equipment ', sectionIds: ['deleted'], visible: false }],
    })
    expect(getQuotationSubtotalLabel(normalized, 'Subtotal')).toBe('Materials subtotal')
    expect(getQuotationSubtotalLabel({ itemDetailLevel: 1, subtotalLabel: '  ' }, 'Subtotal')).toBe('Subtotal')
    expect(normalized.subtotalLabel).toBe(' Materials subtotal ')
  })

  it('leaves quotation financial totals unchanged', () => {
    const quotation = createInitialQuotation([], 'en-US')
    quotation.majorItems = [
      createQuotationSectionHeader('en-US', { id: 'equipment' }),
      createQuotationItem('USD', { unitCost: 100 }),
    ]
    quotation.totalsConfig.extraCharges = [{ id: 'installation', label: 'Installation', amount: 200 }]
    const before = calculateQuotationTotals(quotation.majorItems, quotation.totalsConfig, quotation.exchangeRates)
    quotation.outputSettings = {
      itemDetailLevel: 1, subtotalLabel: 'Materials subtotal', showInformationalTotals: true,
      informationalTotals: [{ id: 'equipment', label: 'Equipment', sectionIds: ['equipment'], visible: true }],
    }

    expect(calculateQuotationTotals(quotation.majorItems, quotation.totalsConfig, quotation.exchangeRates)).toEqual(before)
  })
})
