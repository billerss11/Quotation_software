# Line Item Summary Mode Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a per-card `Totals | Unit` summary mode switch to root line item cards so users can quickly change between rolled-up totals and unit-level pricing.

**Architecture:** Keep the change local to `LineItemCard.vue`. Reuse existing pricing calculations: `calculateMajorItemSummary(...)` for totals mode and `getQuotationItemPricingDisplay(...)` for unit mode. Add a local UI-only mode state per card and render the switch in both collapsed and expanded summary regions.

**Tech Stack:** Vue 3 `<script setup>`, TypeScript, PrimeVue-adjacent button styling, vue-i18n, Vitest, Vue Test Utils.

---

### Task 1: Add failing summary-mode tests

**Files:**
- Modify: `src/features/quotations/components/LineItemCard.summaryMetrics.test.ts`

**Step 1: Write the failing test**

Add a test asserting that:
- `Totals` mode is the default.
- The card renders a `Totals | Unit` switch.
- Clicking `Unit` swaps summary labels from total-style labels to unit-style labels.

**Step 2: Run test to verify it fails**

Run: `npm test -- LineItemCard.summaryMetrics.test.ts`

Expected: FAIL because the switch and unit summary labels do not exist yet.

### Task 2: Implement the per-card summary switch

**Files:**
- Modify: `src/features/quotations/components/LineItemCard.vue`

**Step 1: Add local summary mode state**

Use a local `ref<'totals' | 'unit'>('totals')`.

**Step 2: Reuse existing pricing data**

Build shared summary metric arrays from:
- `summary`
- root `pricingDisplay`
- tax visibility helpers

**Step 3: Render the switch in both summary blocks**

Update:
- collapsed `card-header-summary`
- expanded `item-metrics-bar`

**Step 4: Rename total labels for clarity**

Use explicit total labels so totals are clearly not unit values.

### Task 3: Add i18n strings

**Files:**
- Modify: `src/shared/i18n/messages.ts`

**Step 1: Add English and Chinese keys**

Add keys for:
- summary modes
- explicit total labels
- unit labels

### Task 4: Verify

**Files:**
- Test: `src/features/quotations/components/LineItemCard.summaryMetrics.test.ts`

**Step 1: Run focused test**

Run: `npm test -- LineItemCard.summaryMetrics.test.ts`

Expected: PASS

**Step 2: Run typecheck**

Run: `npm run typecheck`

Expected: PASS
