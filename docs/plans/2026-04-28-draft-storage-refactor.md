# Draft Storage Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make quotation draft persistence resilient to storage limits and avoid rewriting the full draft history on every save.

**Architecture:** Keep draft persistence behind `localQuotationStorage`, but migrate from one large `localStorage` array to a small draft index plus one record per draft. Surface explicit storage errors so the editor can show localized failure messages without mixing browser storage details into Vue components.

**Tech Stack:** Vue 3, TypeScript, Vitest, browser `localStorage`

---

### Task 1: Lock the new storage contract with tests

**Files:**
- Modify: `src/shared/services/localQuotationStorage.test.ts`
- Modify: `src/features/quotations/composables/useQuotationEditor.test.ts`

**Step 1: Write failing tests**

- Add a storage test proving a draft is written to a per-draft key plus a compact index key.
- Add a storage test proving legacy array storage still loads.
- Add a storage test proving quota failures throw a typed storage error.
- Add an editor test proving the saved draft list is updated after a successful save.

**Step 2: Run tests to verify they fail**

Run: `npm test -- src/shared/services/localQuotationStorage.test.ts src/features/quotations/composables/useQuotationEditor.test.ts`

**Step 3: Implement the minimal production code**

- Update the storage service to satisfy the new contract without changing unrelated editor behavior.

**Step 4: Re-run the focused tests**

Run: `npm test -- src/shared/services/localQuotationStorage.test.ts src/features/quotations/composables/useQuotationEditor.test.ts`

### Task 2: Refactor the quotation draft storage service

**Files:**
- Modify: `src/shared/services/localQuotationStorage.ts`

**Step 1: Implement per-draft persistence**

- Add an index key and per-draft key prefix.
- Save only the changed draft plus the updated id list.
- Keep draft order stable so “latest draft” still works.

**Step 2: Preserve compatibility**

- Read the new format first.
- Fallback to the legacy array key when needed.

**Step 3: Surface actionable errors**

- Add a typed storage error for quota and generic persistence failures.

**Step 4: Re-run focused storage tests**

Run: `npm test -- src/shared/services/localQuotationStorage.test.ts`

### Task 3: Update the editor to consume the new storage API cleanly

**Files:**
- Modify: `src/features/quotations/composables/useQuotationEditor.ts`
- Modify: `src/features/quotations/components/QuotationEditor.vue`
- Modify: `src/shared/i18n/messages.ts`

**Step 1: Keep editor state in sync without a full reload**

- Update `savedDrafts` locally after a successful save.
- Keep revision creation using the same save path.

**Step 2: Add localized failure messages**

- Map quota and generic storage failures to bilingual status strings.

**Step 3: Re-run relevant tests**

Run: `npm test -- src/features/quotations/composables/useQuotationEditor.test.ts`

### Task 4: Verify the full change

**Files:**
- No additional files

**Step 1: Run targeted tests**

Run: `npm test -- src/shared/services/localQuotationStorage.test.ts src/features/quotations/composables/useQuotationEditor.test.ts`

**Step 2: Run type checking**

Run: `npm run typecheck`
