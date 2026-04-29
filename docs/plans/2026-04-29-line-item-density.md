# Compact Line Item Density Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the line-item editor more compact while hiding `Source total` unless a grouped item has a real mismatch.

**Architecture:** Keep calculation behavior in quotation utilities and localize the UI changes to `LineItemsTable.vue`. Add a small validation helper so mismatch-driven visibility is explicit and testable, then restyle the parent and child row layout around that behavior.

**Tech Stack:** Vue 3 `<script setup lang="ts">`, PrimeVue, TypeScript, Vitest.

---

Project rule override: do not create git commits. Verify with targeted Vitest coverage and `npm run typecheck`.

### Task 1: Expected Total Visibility Rule

**Files:**
- Modify: `src/features/quotations/utils/quotationItemValidation.ts`
- Modify: `src/features/quotations/utils/quotationItemValidation.test.ts`

**Steps:**
1. Add a failing test for the new `Source total` visibility rule.
2. Run the focused Vitest command and confirm the new test fails.
3. Add the minimal helper that returns `true` only when a grouped item has a mismatch.
4. Re-run the focused Vitest command and confirm it passes.

### Task 2: Compact Parent Item Layout

**Files:**
- Modify: `src/features/quotations/components/LineItemsTable.vue`
- Modify: `src/shared/i18n/messages.ts`

**Steps:**
1. Restructure the expanded major-item layout into a denser control grid plus compact metric tiles.
2. Keep tax-class editing visible only in mixed tax mode.
3. Remove the default `Source total` row and show it only when the new helper says it is needed.
4. Add any small i18n labels needed for the compact metrics and mismatch presentation.

### Task 3: Verification

**Commands:**
- `npm test -- quotationItemValidation.test.ts --run`
- `npm run typecheck`

**Expected:** both commands pass.
