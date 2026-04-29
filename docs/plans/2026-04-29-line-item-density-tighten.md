# Dense Typography Pass Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Tighten the line-item workbench through smaller typography and more compact controls while preserving all fields and calculations.

**Architecture:** Keep the work localized to `LineItemsTable.vue`. Adjust scoped styles for parent cards and child table rows so the same component structure renders more densely without changing data flow.

**Tech Stack:** Vue 3 `<script setup lang="ts">`, PrimeVue, TypeScript.

---

### Task 1: Dense Parent Card Styles

**Files:**
- Modify: `src/features/quotations/components/LineItemsTable.vue`

**Steps:**
1. Reduce heading, label, metric, and input sizes in the parent item card.
2. Reduce metric tile padding and warning row spacing.
3. Keep totals legible and visually primary.

### Task 2: Dense Child Row Styles

**Files:**
- Modify: `src/features/quotations/components/LineItemsTable.vue`

**Steps:**
1. Reduce child row font sizes, padding, and minimum heights.
2. Tighten column widths and action button sizes.
3. Keep names readable and money columns strong.

### Task 3: Verification

**Commands:**
- `npm run typecheck`
- `npm run build`

**Expected:** both commands pass.
