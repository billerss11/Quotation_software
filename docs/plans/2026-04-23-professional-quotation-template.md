# Professional Quotation Template Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the quotation preview into a professional commercial quotation document.

**Architecture:** Keep `QuotationPreview.vue` as the single output component. Add a pure row-building utility for item table rows so hierarchy and totals can be tested outside the Vue template.

**Tech Stack:** Vue 3 `<script setup lang="ts">`, TypeScript, Vitest.

---

Project rule override: do not create git commits. Verify with tests, typecheck, and build.

### Task 1: Preview Row Model

**Files:**
- Create: `src/features/quotations/utils/quotationPreviewRows.ts`
- Create: `src/features/quotations/utils/quotationPreviewRows.test.ts`

**Steps:**
1. Write a failing test for major rows, sub-item rows, and subtotal rows.
2. Implement a row builder that preserves major/sub-item hierarchy.
3. Run the focused test.

### Task 2: Quotation Preview Template

**Files:**
- Modify: `src/features/quotations/components/QuotationPreview.vue`

**Steps:**
1. Refactor the template into header, customer/project, item table, totals, notes, and footer sections.
2. Use the row builder for table rendering.
3. Keep customer-facing price calculations only.

### Task 3: Print/Floating Fit

**Files:**
- Modify: `src/features/quotations/components/FloatingPreviewWindow.vue`

**Steps:**
1. Keep the preview page at a readable fixed document width inside the resizable window.
2. Ensure print mode hides floating chrome and prints the document.

### Task 4: Verification

**Commands:**
- `npm test -- --run`
- `npm run typecheck`
- `npm run build`

**Expected:** all pass.
