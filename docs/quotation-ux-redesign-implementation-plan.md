# Quotation UX Redesign Implementation Plan

Last reviewed against the current codebase: 21 July 2026

## 1. Purpose

This plan implements three usability improvements identified by operating the deployed application in Chrome:

1. Replace the page-sized nested line-item editor with a master-detail item workspace.
2. Keep quotation setup, customer selection, and customer creation inside one guided quotation workflow.
3. Add a clear **Ready to send** preflight before customer-facing output.

The redesign may change the editor layout substantially, but it must preserve quotation calculations, file formats, local-first storage, Electron bridge behavior, browser behavior, undo/redo, and the existing `window.quotationAgent` contract.

## 2. Problems observed

| Area | Observed behavior | Current code involved | Target outcome |
| --- | --- | --- | --- |
| Line items | Large quotations render many expanded nested editors in one scrolling surface. At narrower desktop widths, the toolbar wraps badly, actions are clipped, and horizontal scrolling becomes necessary. | `QuotationEditor.vue`, `LineItemsTable.vue`, `LineItemCard.vue`, `LineItemChildTable.vue`, `QuotationNavigator.vue` | A stable tree, selected branch table, and selected-item inspector that render only the current work context. |
| Navigation | Selecting item 1 from Outline moved the editor but left the requested row hidden behind the sticky workbench header. Selection is currently a temporary focus request that resets after 2.2 seconds. | `useQuotationWorkspace.ts`, `useQuotationWorkbench.ts`, `quotationItemFocusTarget.ts` | Persistent item selection with reliable, container-aware navigation. |
| Setup panels | Switching between Pricing, Quote info, and Parties reused one scroll container, so a new panel could open halfway down its form. | `QuotationSupportPanels.vue` | A dedicated Setup workspace with predictable section navigation and independent scroll positions. |
| Customers | **Manage customers** leaves the quotation and opens global Settings. Creating a record requires manually returning to the quotation and applying it. | `QuoteCustomerPanel.vue`, `CustomersPanel.vue`, `useCustomerLibrary.ts`, `useQuotationEditorLibraries.ts` | Search, create, save, and apply a customer without leaving the quotation. |
| Output readiness | Preview can show placeholder content such as “Project name”, “Customer”, and the default company while customer-facing output remains available. Analysis warnings are separate from document completeness. | `QuotationCommandBar.vue`, `FloatingPreviewWindow.vue`, `QuotationAnalysisView.vue`, `useQuotationFileActions.ts` | One actionable readiness report that links every issue to the exact field or item and guards PDF/Print with an explicit override. |

## 3. Product decisions

### 3.1 New top-level quotation workflow

Use three clear workspace sections:

1. **Setup** — quotation details, sender, customer, pricing, tax, and exchange rates.
2. **Items** — hierarchy navigation, branch editing, and selected-item properties.
3. **Review** — readiness, analysis, preview, and customer-facing output.

The command bar remains visible in all three sections. The active section and completion state must be obvious without opening a menu.

### 3.2 Saving is never blocked

Desktop **Save** and browser **Download** write the editable quotation JSON. Users must be able to save incomplete work.

The readiness guard applies only to customer-facing quotation output:

- Desktop PDF export.
- Browser Print / Save as PDF.
- Print from the floating preview.

Preview remains available because it helps users discover problems. Preview must display the readiness state and provide links back to unresolved fields.

### 3.3 Derived UI state, not quotation data

Do not add layout, selection, readiness, or dialog state to `QuotationDraft`.

- Persistent UI preferences may use `localAppSettingsStorage`.
- Current selection, active setup section, open drawers, and pending output actions remain in renderer state.
- Readiness is calculated from the current quotation, analysis data, file state, and existing validation utilities.
- The quotation JSON format requires no migration.

### 3.4 Preserve local-first behavior

Inline customer creation must reuse the existing customer library storage and subscriptions. Do not add a backend, HTTP API, or browser-only persistence path.

## 4. Target user flow

### 4.1 Create or open a quotation

1. The quotation opens in the last relevant workspace section.
2. A compact status strip shows Setup, Items, and Review progress.
3. Missing required information is visible but does not block editing or saving.

### 4.2 Complete Setup

1. Enter quotation number, project, dates, language, template, and validity.
2. Select or create the sender company.
3. Search for an existing customer or create one inline.
4. Save the new customer to the reusable library and apply it automatically.
5. Configure currency, pricing, tax, extra charges, and exchange rates.
6. Move to Items without losing the Setup scroll position.

### 4.3 Edit Items

1. Use the hierarchy tree to search, select, add, reorder, duplicate, or delete items.
2. See only the selected parent and its immediate children in the central table.
3. Edit common row values directly in the table.
4. Edit the complete selected-item form in the inspector.
5. Use breadcrumbs to move to parent levels.
6. Keep totals visible while editing.

### 4.4 Review and send

1. Review blockers and warnings in **Ready to send**.
2. Click an issue to open the correct workspace, section, field, or item.
3. Review pricing analysis and preview the document.
4. Export when ready, or explicitly choose **Export anyway** after reviewing unresolved issues.

## 5. Target layout

### 5.1 Items workspace at wide desktop sizes

Use a three-column layout:

| Pane | Suggested width | Responsibility |
| --- | ---: | --- |
| Hierarchy | 260–300 px | Search, selection, add, drag/reorder, parent/child structure, item status badges. |
| Branch table | Flexible, minimum 680 px | Immediate children of the selected parent, quick/detailed pricing columns, totals, bulk operations. |
| Inspector | 340–400 px | Full fields and calculation summary for the selected row. |

The existing resizable quotation support rail should not compete with the item inspector. Quote-wide settings move to Setup.

### 5.2 Medium desktop sizes

At approximately 1100–1499 px of available workbench width:

- Keep the hierarchy and branch table visible.
- Open the item inspector as a PrimeVue Drawer.
- Move secondary toolbar actions into an overflow menu.
- Keep Add item, Add section, entry mode, currency, and totals visible.

### 5.3 Narrow sizes

Below approximately 1100 px of available workbench width:

- Show the branch table as the main surface.
- Open both hierarchy and inspector as drawers.
- Stack table controls into two predictable rows.
- Do not squeeze explanatory text into a narrow column.

Use container queries or workbench-width state rather than only viewport media queries. The current failure happens because the side rail reduces the available editor width while viewport-based breakpoints still treat the page as wide.

## 6. Architecture changes

### 6.1 Workspace and persistent selection

Update `src/features/quotations/composables/useQuotationWorkspace.ts`:

- Replace the editor/analysis-only navigation model with Setup, Items, and Review sections.
- Keep compatibility helpers such as `openEditor()` and `openAnalysis()` while callers migrate; map them to Items and Review.
- Add a persistent `selectedItemId` separate from the temporary focus/highlight request.
- Add `selectedSetupSection` for quote info, parties, pricing, and FX.
- Keep selection valid after import, load, undo, redo, deletion, and tree moves.

Add `src/features/quotations/utils/quotationTreeSelection.ts` with pure helpers:

- Resolve an item by ID.
- Resolve its parent, path, depth, and immediate children.
- Choose the nearest valid selection after deletion.
- Choose the first editable item after a quotation is loaded or imported.
- Build breadcrumb labels without duplicating pricing logic.

Add focused unit tests in `quotationTreeSelection.test.ts` and extend `useQuotationWorkspace.test.ts`.

### 6.2 Split the large editor container

Keep `QuotationEditor.vue` as the data and action wiring owner, but move workspace rendering into focused components:

- `QuotationSetupWorkspace.vue`
- `QuotationItemsWorkspace.vue`
- `QuotationReviewWorkspace.vue`

`QuotationEditor.vue` continues to own:

- `useQuotationEditor()` data and mutations.
- File actions and runtime capabilities.
- Preview and import dialogs.
- Undo/redo integration.
- `window.quotationAgent` registration.
- Cross-workspace issue navigation.

This avoids introducing a new global store and keeps the current feature boundary intact.

### 6.3 Hierarchy pane

Evolve `QuotationNavigator.vue` instead of creating a second tree implementation:

- Make selection persistent and visually distinct from a temporary focus flash.
- Keep existing search, keyboard handling, add, drag/reorder, duplicate, and delete behavior.
- Add badges for incomplete items and readiness issues.
- Keep the selected row visible inside the hierarchy scroll container.
- Remove dependency on scrolling a separate page-sized item list.
- Preserve accessible tree navigation and visible focus states.

Update `QuotationNavigator.test.ts` for selection, search, keyboard navigation, reorder events, issue badges, and selection recovery.

### 6.4 Selected branch table

Refactor `LineItemsTable.vue` to render a selected branch rather than every root card:

- Accept the selected parent/item and resolved path.
- Render the selected level’s immediate children.
- Add breadcrumbs and parent navigation.
- Keep Quick and Detailed entry modes.
- Preserve Add item, Add section, Calculation Sheet, Goal seek, Totals/Unit, and quotation currency controls.
- Reuse `LineItemChildTable.vue` virtualization and existing buffered field behavior.
- Do not copy price, cost, markup, tax, exchange-rate, or rollup formulas into the component.
- Flush edit buffers before selection changes, output, undo, redo, and structural mutations.

The existing `LineItemCard.vue` can remain during migration. Remove it only after the branch table and inspector cover all root and child editing behavior.

Update existing tests:

- `LineItemsTable.expansion.test.ts`
- `LineItemsTable.performance.test.ts`
- `LineItemsTable.summaryMode.test.ts`
- `LineItemChildTable.virtualization.test.ts`
- Buffering and pricing tests that cover selection changes.

### 6.5 Selected-item inspector

Add `QuotationItemInspector.vue`:

- Show name, description, quantity, unit, pricing method, cost, currency, markup, tax class, expected total, and notes as applicable.
- Show parent path, calculated totals, effective markup, and calculation actions.
- Reuse existing field composables and calculation utilities.
- Use the same buffered-edit rules as current line-item inputs.
- Keep destructive actions clearly separated and confirmed where appropriate.

Extract shared input groups only where both the current row components and inspector need identical behavior. Avoid a generic form framework.

Add component tests for root items, nested items, final-price mode, cost-plus mode, inherited markup/tax, buffered edits, and deletion.

### 6.6 Guided Setup workspace

Create `QuotationSetupWorkspace.vue` and reuse the existing feature panels:

- `QuoteInfoPanel.vue`
- `QuoteCustomerPanel.vue`
- `PricingPanel.vue`
- `ExchangeRatePanel.vue`

Render these as full-width setup sections rather than slots inside one narrow scrolling rail. Use a small step list or tab bar with a separate scroll container per section.

Update `quotationHistoryTargets.ts` so undo/redo notices and readiness issues route to the correct Setup section and field.

Retire `QuotationSupportPanels.vue` after Items and Setup no longer depend on it. If it remains temporarily during migration, reset `.panel-body.scrollTop` when the active panel changes or store scroll positions by panel key. This is an interim fix, not the final layout.

### 6.7 Inline customer creation

Add `InlineCustomerDialog.vue` under `src/features/customers/components/`:

- Reuse `useCustomerLibrary()` for draft state, validation, persistence, and library subscriptions.
- Show Company, Contact Person, and Contact Details.
- Require the same minimum fields as the Settings customer editor.
- On successful `saveDraft()`, emit the returned record.
- In `QuotationSetupWorkspace.vue`, call the existing `applyCustomerRecord()` action immediately.
- Keep **Manage customer library** as a secondary link for bulk maintenance.

Update `QuoteCustomerPanel.vue`:

- Keep the searchable PrimeVue Select for existing records.
- Add a visible **New customer** action beside the selector.
- Show the currently applied quotation snapshot separately from the reusable library record.
- Explain that later library edits do not silently alter the quotation.

The same inline pattern may be applied to company profiles in the same workstream so a first-time user can complete Setup without leaving the quotation. Reuse `useCompanyProfileLibrary`; do not build a second persistence path.

Add tests for create, validate, cancel, save-and-apply, duplicate-like records, library subscription refresh, and unchanged quotation snapshots.

## 7. Ready-to-send preflight

### 7.1 Pure readiness report

Add `src/features/quotations/utils/quotationReadiness.ts`.

Suggested types:

```ts
type QuotationReadinessSeverity = 'blocker' | 'warning'
type QuotationReadinessCategory = 'setup' | 'items' | 'pricing' | 'file'

interface QuotationReadinessIssue {
  id: string
  severity: QuotationReadinessSeverity
  category: QuotationReadinessCategory
  messageKey: string
  target: string
  itemId?: string
  params?: Record<string, string | number>
}

interface QuotationReadinessReport {
  isReady: boolean
  blockers: QuotationReadinessIssue[]
  warnings: QuotationReadinessIssue[]
}
```

The utility must return message keys and parameters, not hardcoded English strings.

### 7.2 Initial readiness rules

| Rule | Severity | Navigation target |
| --- | --- | --- |
| Quotation number is blank | Blocker | Quote info / quotation number |
| Project name is blank | Blocker | Quote info / project name |
| No customer company or contact person | Blocker | Parties / customer |
| Sender snapshot is still empty or equal to the untouched default profile | Blocker | Parties / sender |
| No editable quotation items | Blocker | Items / Add item |
| Priced item is incomplete according to existing item validation | Blocker | Exact item |
| Customer contact details are blank | Warning | Parties / contact details |
| Quotation has not been saved/downloaded as JSON in the current session | Warning | Command bar Save/Download |
| Analysis advisory exists, including currency spread or low/zero markup | Warning | Review / advisory and exact item where available |
| Final-price revenue has no known cost | Warning | Review / profit confidence |

Reuse `quotationItemCompleteness.ts`, `quotationItemValidation.ts`, and `createQuotationAnalysisDataset()`. Do not recreate their business rules.

### 7.3 Readiness UI

Add:

- `QuotationReadinessBadge.vue` in the command bar.
- `QuotationReadinessPanel.vue` at the top of Review.
- `QuotationReadinessDialog.vue` for guarded output.

Behavior:

- Ready: show a clear green **Ready to send** state.
- Not ready: show blocker and warning counts, not an unlabeled warning icon.
- Clicking an issue calls one navigation function in `QuotationEditor.vue`.
- Navigation opens Setup, Items, or Review, selects the correct subsection/item, waits for rendering, and focuses the target.
- Preview displays the same report without blocking the preview.

### 7.4 Output guard

Add a small `useQuotationOutputGuard.ts` composable or keep equivalent state inside `QuotationEditor.vue` if the logic remains short.

Flow:

1. Flush pending item and pricing edits.
2. Recalculate readiness from the latest quotation.
3. If ready, run the requested PDF/Print action.
4. If issues exist, open `QuotationReadinessDialog.vue`.
5. **Review issues** closes the dialog and navigates to the first blocker.
6. **Export anyway** runs the exact pending action once.
7. Cancel clears the pending action.

Keep `useQuotationFileActions.ts` responsible for file/runtime operations. The guard belongs above it in the UI workflow so JSON save/download and programmatic file actions remain reusable.

For `window.quotationAgent.exportPdfToFile(path)`, preserve the current non-interactive behavior. Add readiness messages to its returned `warnings` only if this can be done without breaking the shared contract. Update `docs/quotation-agent-api.md` if the returned warnings change.

## 8. Responsive toolbar work

Update `QuotationCommandBar.vue` and the Items toolbar:

- Keep one primary save/download action.
- Keep Preview and customer-facing output adjacent.
- Move low-frequency import/export/template/logo actions to **More**.
- Never rely on clipped icon-only buttons without accessible names.
- Add the readiness badge as a named button that opens the readiness report.
- Use an overflow menu when available width is insufficient.
- Test the actual workbench width with the hierarchy/inspector open, not only browser viewport width.

Required layout verification widths:

- 1920 × 1080
- 1440 × 900
- 1366 × 768
- 1100 × 700

At every width, Setup/Items/Review navigation, Add item, Save/Download, Preview, and totals must remain reachable without horizontal page scrolling.

## 9. Internationalization and accessibility

Add all new copy to both locale branches in `src/shared/i18n/messages.ts`.

Required key groups:

- `quotations.workspace.setup`
- `quotations.workspace.items`
- `quotations.workspace.review`
- `quotations.itemWorkspace.*`
- `quotations.setup.*`
- `quotations.readiness.*`
- `customers.inlineCreate.*`

Accessibility requirements:

- Workspace navigation uses tabs or links with correct selected state.
- The hierarchy supports keyboard selection, expansion, and reordering alternatives.
- Drawers and dialogs restore focus to their trigger.
- Readiness issue counts are announced with useful text.
- Issue navigation focuses the target control after the workspace changes.
- Color is never the only readiness or selection indicator.
- All icon-only controls have localized accessible names.

## 10. Performance requirements

- Do not render every expanded quotation item at once.
- Keep `@tanstack/vue-virtual`; do not add a second virtualization package.
- Selection changes should not recalculate pricing formulas outside existing computed dependencies.
- Search results should be derived from normalized item text and remain responsive for at least 1,000 nested items.
- Preserve buffered input behavior to avoid a full quotation history mutation on every keystroke.
- Keep calculation utilities pure and outside Vue components.

Performance tests should cover:

- Initial render of a 1,000-item quotation.
- Selection changes across distant branches.
- Search filtering.
- Reorder and deletion recovery.
- Quick/Detailed mode switching.
- Readiness recomputation after a single header or item edit.

## 11. Test plan

### 11.1 Unit tests

- Tree selection/path helpers.
- Workspace state transitions.
- Selection recovery after delete/import/load/undo.
- Readiness blockers, warnings, ordering, and targets.
- Customer inline-create validation and persistence.
- Output guard ready, review, cancel, and override branches.

### 11.2 Component tests

- Hierarchy selection, search, drag/reorder events, and keyboard use.
- Branch table scope and breadcrumbs.
- Inspector field updates and buffered edits.
- Setup section navigation and independent scroll state.
- Save-and-apply customer flow.
- Readiness badge/panel/dialog.
- Command bar overflow behavior.
- Preview readiness banner.

### 11.3 Integration tests

Extend or add focused tests around `QuotationEditor.vue`:

- Analysis or readiness issue → exact item selection in Items.
- Header issue → exact Setup section and field.
- Outline selection no longer uses a page-level `scrollIntoView()` that can hide the target under a sticky header.
- PDF/Print guard runs once after override.
- JSON Save/Download is never guarded.
- Desktop and web runtime capability differences remain correct.
- Undo/redo continues to reopen and focus the affected context.

### 11.4 Verification commands

Run after each implementation commit:

```powershell
npm run typecheck
npm test -- src/features/quotations
```

Run targeted customer tests when inline creation changes:

```powershell
npm test -- src/features/customers
```

Before final delivery:

```powershell
npm run build:all
```

Also verify the packaged Electron editor and the web build manually at the required widths.

## 12. Migration and rollout

Implement behind normal component boundaries, not a long-lived feature flag.

Recommended migration order:

1. Add workspace and selection foundations while the current editor still renders.
2. Add the new Items workspace using existing mutation and pricing APIs.
3. Move quote-wide panels into Setup.
4. Add inline library creation.
5. Add Review/readiness and output guarding.
6. Remove obsolete support-rail and all-items rendering code.
7. Update the user manual and automation documentation.

During migration:

- Keep one source of truth for quotation data.
- Do not maintain old and new pricing calculations in parallel.
- Keep existing component tests passing until the replacement covers the same behavior.
- Delete obsolete support-panel and expansion state only after the new path is verified.

No quotation data migration is expected.

## 13. Recommended implementation commits

Use seven reviewable commits. Tests and both locales belong in the same commit as the behavior they cover.

### Commit 1

```text
refactor(quotations): add workspace selection foundations

- separate persistent item selection from temporary focus highlighting
- add pure tree path and selection recovery helpers
- cover load, import, delete, move, undo, and redo selection behavior
```

### Commit 2

```text
feat(quotations): build the master-detail item workspace

- promote the existing outline to the primary hierarchy pane
- scope the virtualized table to the selected branch
- add breadcrumbs and a selected-item inspector
```

### Commit 3

```text
fix(quotations): make the item workspace responsive

- add medium-width inspector and hierarchy drawers
- move secondary toolbar actions into overflow menus
- keep selection and primary actions visible without page scrolling
```

### Commit 4

```text
feat(quotations): add guided in-quote setup

- move quote info, parties, pricing, tax, and FX into Setup
- add inline customer and company-profile creation
- save and apply new library records without leaving the quotation
```

### Commit 5

```text
feat(quotations): add ready-to-send checks

- derive document blockers and warnings from existing validation and analysis
- add localized issue targets and review status UI
- navigate each issue to its exact field or item
```

### Commit 6

```text
feat(quotations): guard customer-facing output

- show readiness issues before PDF or browser print
- support review, cancel, and explicit export override actions
- keep quotation JSON save and download always available
```

### Commit 7

```text
docs: update workflows for the redesigned quotation editor

- document Setup, Items, Review, inline customer creation, and preflight
- update automation warnings if readiness is exposed through quotationAgent
- record desktop and web output behavior
```

## 14. Definition of done

The redesign is complete when:

- A large quotation no longer renders every expanded editor at once.
- Selecting any hierarchy item always exposes that item and keeps it selected.
- The editor remains usable at 1366 × 768 with no clipped primary actions.
- A first-time user can configure sender and customer without leaving the quotation.
- Setup sections never inherit another section’s accidental scroll position.
- Readiness combines document completeness and pricing analysis in one place.
- Preview shows readiness status.
- PDF/Print requires readiness review or an explicit override.
- JSON Save/Download remains available for incomplete work.
- English and Simplified Chinese copy are complete.
- Focused tests, typecheck, web build, Electron build, and manual verification pass.
- `docs/user-manual.md` and, if required, `docs/quotation-agent-api.md` match the shipped behavior.

## 15. Main risks

| Risk | Mitigation |
| --- | --- |
| Selection changes lose buffered edits | Flush registered edit buffers before changing branch or running structural actions. Add integration tests. |
| Inspector duplicates row pricing logic | Reuse existing composables and pure pricing utilities. Extract only shared field UI. |
| Undo/redo points to a hidden workspace | Route history targets through the same workspace/field navigation function used by readiness issues. |
| Readiness rules become arbitrary | Keep rules in one pure utility, document severity, and reuse existing validation/analysis outputs. |
| Output guard blocks saving | Guard PDF/Print only. Never guard JSON Save/Download. |
| Inline customer creation creates a second storage path | Reuse `useCustomerLibrary()` and existing library subscriptions. |
| Responsive rules regress when panes resize | Base layout decisions on available workbench width and test with panes/drawers open. |
| Automation behavior breaks | Preserve `window.quotationAgent`; expose additional warnings without changing existing action success semantics. |
