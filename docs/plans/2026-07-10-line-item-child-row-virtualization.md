# Line Item Child Row Virtualization Plan

**Current repo status:** Planned.

**Goal:** Improve editing performance for huge expanded quotations by virtualizing the editable child rows inside each expanded line item card first.

**Blunt recommendation:** Do not start with a full flattened quotation editor. That is a bigger rewrite and has more risk. Start by virtualizing `LineItemChildTable.vue`, because the current worst case is one expanded root item rendering hundreds or thousands of child inputs at once.

**Architecture:** Keep the existing root card model. Keep `LineItemsTable.vue` rendering root rows and `LineItemCard.vue` owning root-card expansion. Reuse the existing flat child-row data from `buildChildRows(...)`, then render only visible child rows through a virtual scroller when the child row count is large.

**Tech stack:** Vue 3 `<script setup>`, TypeScript, PrimeVue, vue-i18n, Vitest, `@tanstack/vue-virtual`.

---

## Non-goals

- Do not virtualize the whole quotation page in the first pass.
- Do not rewrite the quotation data model.
- Do not change pricing, totals, tax, markup, import, export, or print behavior.
- Do not virtualize print/export/document preview. Those views must still render the full document.
- Do not build a full flattened editor unless the smaller child-row virtualization is measured and still not enough.

## Component Map

- `LineItemsTable.vue`: keeps root rows, root expand/collapse, add/remove/move root actions, and focus reveal entry point.
- `LineItemCard.vue`: keeps one root item card, nested expansion state, pricing helpers, buffered field updates, and child table wiring.
- `LineItemChildTable.vue`: renders child rows. This is the first virtualization target.
- New `VirtualLineItemChildRows.vue` or internal child component: renders only the visible `ChildRow` items using `@tanstack/vue-virtual`.
- `lineItemChildRows.ts`: stays the source for flattened child row metadata.

## Phase 1: Virtualize Large Child Tables

### Task 1: Add focused tests for current child row rendering

**Files:**
- Modify or create: `src/features/quotations/components/LineItemChildTable.virtualization.test.ts`
- Existing coverage to keep passing:
  - `src/features/quotations/components/LineItemChildTable.costSales.test.ts`
  - `src/features/quotations/components/LineItemCostInputFormatting.test.ts`

**Steps:**
1. Add a test fixture with more than the virtualization threshold, for example 150 child rows.
2. Assert row actions still emit the same events by item id.
3. Assert edited text/number fields still flush through the existing emit contract.
4. Keep the test focused on behavior, not exact DOM count, because virtual DOM count can vary by viewport.

### Task 2: Add the virtualization dependency

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

**Steps:**
1. Install `@tanstack/vue-virtual`.
2. Do not add more virtualization libraries.
3. Keep the dependency local to the editor implementation.

### Task 3: Split child row markup if needed

**Files:**
- Modify: `src/features/quotations/components/LineItemChildTable.vue`
- Create if useful: `src/features/quotations/components/LineItemChildRow.vue`

**Steps:**
1. Extract the repeated child row markup only if it makes virtualization simpler.
2. Keep props and emits explicit.
3. Keep all edits flowing through the existing event names:
   - `setText`
   - `setNumber`
   - `setOptionalNumber`
   - `setPricingMethod`
   - `setCurrency`
   - `setTaxClass`
   - `flushField`
   - `addChildItem`
   - `removeItem`
   - `requestGoalSeek`
4. Do not move pricing formulas into the component.

### Task 4: Add virtual rendering behind a threshold

**Files:**
- Modify: `src/features/quotations/components/LineItemChildTable.vue`
- Create if useful: `src/features/quotations/components/VirtualLineItemChildRows.vue`

**Steps:**
1. Add a simple threshold, for example `VIRTUAL_CHILD_ROW_THRESHOLD = 100`.
2. For small child tables, keep the current normal rendering path.
3. For large child tables, render `props.rows` through `useVirtualizer`.
4. Use stable keys based on `row.item.id`.
5. Use an estimated row height and allow measurement if row heights vary.
6. Keep overscan small, for example 5 to 10 rows.
7. Preserve `data-item-id` and `data-history-target` attributes so focus reveal and undo/redo highlighting still work.

### Task 5: Preserve focus and reveal behavior

**Files:**
- Modify: `src/features/quotations/components/LineItemCard.vue`
- Modify if needed: `src/features/quotations/components/LineItemChildTable.vue`

**Steps:**
1. When a focused child item is inside a virtual child table, scroll the virtualizer to that row by item id.
2. Keep the existing root expansion behavior in `LineItemsTable.vue`.
3. Keep nested expansion state controlled by item id, not row index.
4. Make sure undo/redo history reveal still scrolls to the changed item.

### Task 6: Verify Phase 1

**Commands:**
- `npm test -- LineItemChildTable`
- `npm test -- LineItemCostInputFormatting`
- `npm run typecheck`

**Manual performance check:**
1. Open or generate a quotation with one root item containing 500+ child rows.
2. Expand that root item.
3. Scroll through the child table.
4. Edit text, quantity, unit cost, currency, markup, and pricing method fields.
5. Test undo/redo after edits.
6. Test focus reveal from the navigator/history target.

**Expected result:** Huge child tables should scroll and edit more smoothly because only visible child row UI is mounted.

## Phase 2: Measure Before Doing More

Only continue if Phase 1 is not enough.

**Check these before adding more architecture:**
- Is the browser still slow when one root item has many children?
- Is the browser slow only when many root cards are expanded?
- Is the bottleneck DOM mounting, pricing recomputation, or deep undo serialization?

If many expanded root cards are the remaining problem, consider root-row virtualization in `LineItemsTable.vue`. If one deep mixed tree remains the problem after child-row virtualization, then consider the full flattened editor.

## Phase 3: Full Flattened Editor, Only If Needed

This is the long-term option, not the first implementation.

**Possible design:**
- Build one flat visible editor row list:
  - root item rows
  - child item rows
  - section header rows
  - optional summary/subtotal rows
- Render that list through one virtual scroller.
- Store expansion, focus, and scroll targets by item id.
- Keep document preview, print, and export on the current full render path.

**Risk:** Medium/high. This touches core editor structure, focus behavior, nested expansion, row actions, and undo/redo reveal. Do not do this until the smaller fix has been tested with real large quotations.

## Done Criteria

- Large expanded child tables no longer mount every child row at once.
- Existing line item edit behavior still works.
- Undo/redo still works and reveals the changed item.
- Nested expand/collapse still works.
- Print/export/document preview behavior is unchanged.
- Focused tests and `npm run typecheck` pass.
