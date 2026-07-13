# Patch-Based Quotation History Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development and superpowers:verification-before-completion task-by-task.

**Goal:** Replace whole-document snapshot undo/redo with compact in-place reversible commands and verify worst-case performance using the supplied large CSV.

**Architecture:** `useQuotationEditor` owns all writes and records typed mutations in transactions. `useQuotationUndoHistory` stores at most 50 compact entries and replays them in place. Whole-document payloads are used only for New/Open/Import replacement commands.

**Tech Stack:** Vue 3 Composition API, TypeScript, Vitest, Electron programmatic API.

---

Do not create a branch, worktree, or commit. Preserve the user's existing `package-lock.json` change.

### Task 1: Build the command engine

**Files:**
- Create: `src/features/quotations/utils/quotationHistoryCommands.ts`
- Create: `src/features/quotations/utils/quotationHistoryCommands.test.ts`
- Modify: `src/features/quotations/composables/useQuotationUndoHistory.ts`
- Modify: `src/features/quotations/composables/useQuotationUndoHistory.test.ts`
- Modify: `src/features/quotations/composables/useQuotationUndoHistory.performance.test.ts`

1. Write failing tests for scalar set, optional property add/remove, item lookup by ID, collection insert/remove/move, ordered batches, and whole-document replacement.
2. Run the focused tests and confirm failures are caused by the missing command engine.
3. Implement the smallest typed mutation union and in-place applier needed by the tests.
4. Write failing history tests for immediate undo, batching, 50-entry limit, reset, redo invalidation, and ghost-entry prevention.
5. Replace snapshot stacks and serialization with command stacks.
6. Replace serialization-count tests with assertions that a small edit on a large quotation stores only small mutation payloads and never calls `JSON.stringify` or full-draft cloning.
7. Run the three focused test files.

### Task 2: Centralize editor mutations

**Files:**
- Modify: `src/features/quotations/composables/useQuotationEditor.ts`
- Create: `src/features/quotations/composables/useQuotationEditor.history.test.ts`
- Modify: `src/features/quotations/composables/useQuotationEditor.performance.test.ts`

1. Write parameterized failing round-trip tests for every existing editor action.
2. Add transactions and action-only mutation helpers to `useQuotationEditor`.
3. Move currency rebasing into one explicit transaction and remove the mutating currency watcher.
4. Cover nested edits, section titles, add/remove/duplicate, root moves, reparenting, line-item replacement, exchange rates, branding, customer/profile selection, pricing-method conversion, tax-mode conversion, and full draft replacement.
5. Assert no-op actions create no history and unaffected object identities survive undo and redo.
6. Run editor history, editor behavior, and editor performance tests.

### Task 3: Remove direct UI writes

**Files:**
- Modify: `src/features/quotations/components/QuoteInfoPanel.vue`
- Modify: `src/features/quotations/components/QuoteCustomerPanel.vue`
- Modify: `src/features/quotations/components/PricingPanel.vue`
- Modify: `src/features/quotations/components/QuotationEditor.vue`
- Modify the corresponding component tests.

1. Write failing component tests that expect typed change events instead of prop mutation.
2. Convert quote/customer fields to props-down, events-up.
3. Convert pricing/tax/extra-charge operations to typed events.
4. Route template, output detail, global goal seek, and batch item goal seek through editor transactions.
5. Preserve 160 ms buffered field behavior and flush-before-undo behavior.
6. Run the affected component tests and `npm run typecheck`.

### Task 4: Route the programmatic API through actions

**Files:**
- Modify: `src/features/quotations/composables/useQuotationAgentApi.ts`
- Modify: `src/features/quotations/composables/useQuotationAgentApi.test.ts`
- Modify: `src/features/quotations/components/QuotationEditor.vue`

1. Write failing tests proving agent currency, rates, output detail, and mixed-tax column changes create one undoable editor transaction.
2. Replace direct agent writes with explicit editor actions.
3. Preserve save/status/result behavior.
4. Run agent API and editor history tests.

### Task 5: Verify behavior and performance

**Files:**
- Modify tests only if verification exposes a real uncovered defect; add a failing regression test first.

1. Run all quotation history/editor/component tests.
2. Run `npm run typecheck`.
3. Run `npm test -- --run`.
4. Start the Electron app.
5. Import `file/Q-2026-049-Hydrogen-Electrolyzer-Plant-complex-template.csv` through `window.quotationAgent.importLineItemsCsvFile(...)`.
6. Expand all root cards and verify they remain expanded.
7. Capture repeatable worst-case timings for import, expand-all, one representative edit, undo, and redo.
8. Inspect memory/long-task evidence available from the running app and record the observed results.
9. Review `git diff` and confirm no snapshot serialization path, direct production mutation bypass, untranslated UI text, unrelated file change, or untested public editor action remains.
