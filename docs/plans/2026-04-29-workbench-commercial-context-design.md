# Workbench Commercial Context Design

## Goal

Move quotation currency and total closer to the line-item editing surface so pricing context is visible where users work.

## Direction

- Keep the top command bar focused on quotation identity and document actions.
- Move `Customer currency` and `Total` into the line-items header.
- Rebalance both zones so neither looks like controls were simply removed or pasted in.

## Layout

- `QuotationCommandBar.vue`: file and preview actions only.
- `LineItemsTable.vue`: title/subtitle on the left, workbench summary cluster plus item actions on the right.
- Summary cluster contains:
  - quotation currency selector
  - grand total display

## Constraints

- No calculation changes.
- Preserve explicit props-down/events-up flow from `QuotationEditor.vue`.
