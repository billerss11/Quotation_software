# Patch-Based Quotation History Design

## Goal

Replace full-quotation undo snapshots with compact reversible commands while preserving current undo/redo behavior, Vue object identity, and file-backed workflows.

## Chosen approach

Use a typed command history applied in place. A history entry contains a small ordered list of forward mutations, inverse mutations, and a prepared user-facing change summary. Routine edits store only changed values. Structural edits store only the affected row or subtree. New, Open, and Import remain undoable and may store a full quotation because replacing an entire document cannot be reversed from less data.

Do not use before/after document diffing, recursive proxy interception, or immutable root replacement. Diffing still scans the whole quotation. Proxy interception is difficult to reason about for arrays and batching. Immutable replacement would invalidate quotation-wide Vue computations for unrelated edits and break the existing identity-preservation optimization.

## Data model

`useQuotationUndoHistory` will store a bounded stack of typed entries rather than serialized drafts.

- Value mutations address stable domain targets: quotation/header/totals fields, item IDs, section IDs, tax-class IDs, extra-charge IDs, and currency codes.
- Collection mutations describe insert, remove, and move operations using stable parent IDs and indexes.
- A transaction groups multiple mutations into one undo step.
- A replacement command carries the old and new normalized quotation only for whole-document replacement.
- Stored object payloads are cloned when necessary so later edits cannot corrupt older history entries.

Undo applies inverse mutations in reverse order. Redo applies forward mutations in original order. Replay is suspended from recording so it cannot create ghost entries.

## Mutation ownership

`useQuotationEditor` becomes the only production writer of quotation state and exposes actions for all changes. Production consumers treat the returned quotation as read-only; the existing ref shape remains for compatibility with file/render readers and test setup. A source audit verifies that no production consumer writes through it.

Existing line-item and tree components already emit actions. The migration must also route these current direct writes through editor actions:

- Quote information and customer fields.
- Template and output-detail settings.
- Pricing, tax classes, extra charges, and mixed-tax columns.
- Currency changes and exchange-rate rebasing.
- Quotation and item goal seek.
- Programmatic API changes.

Compound operations such as currency rebasing, tax-mode conversion, customer/profile selection, CSV import, pricing-method conversion, and batch goal seek remain one transaction.

## Behavior preserved

- Undo and redo remain available immediately after an edit.
- Same-tick edits remain one history entry.
- History remains limited to 50 entries by default.
- A new edit after undo clears redo.
- Reset clears pending, undo, and redo state.
- Buffered fields are flushed before undo/redo.
- Currency and all derived rebasing undo atomically.
- New/Open/Import remain undoable.
- Existing localized notices and reveal/highlight behavior remain.
- In-place replay preserves unaffected quotation and item identities.

## Testing

Use test-first development.

- Unit-test value, property add/remove, collection, batch, replacement, reset, limit, and redo-invalidation behavior.
- Add editor round-trip tests for every public mutation action.
- Add compound-operation tests for currency, tax mode, pricing mode, imports, customer/profile selection, and batch goal seek.
- Replace snapshot-mechanics tests with structural performance tests proving ordinary edits do not stringify, clone, or retain the full quotation.
- Run the focused quotation suite, full test suite, and typecheck.
- Import `file/Q-2026-049-Hydrogen-Electrolyzer-Plant-complex-template.csv` through `window.quotationAgent`, expand every root card, and measure the worst-case desktop UI before final handoff.

## Component map

- `useQuotationUndoHistory.ts`: stores and replays compact history entries.
- `quotationHistoryCommands.ts`: typed mutation definitions, target resolution, cloning, and in-place application.
- `useQuotationEditor.ts`: owns mutable state, transactions, and all quotation write actions.
- `QuoteInfoPanel.vue` / `QuoteCustomerPanel.vue`: emit field-change intent.
- `PricingPanel.vue`: emits typed pricing/tax intent without mutating props.
- `QuotationEditor.vue`: wires UI and agent actions to the editor.
- `useQuotationAgentApi.ts`: reads state and calls editor actions only.

No new runtime dependency is required.
