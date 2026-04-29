# Compact Line Item Density Design

## Goal

Make the major-item editor feel denser so the child rows and calculated pricing stay in focus.

## Approved Direction

Use a compact two-row parent-item editor instead of the current tall stacked form. Keep the major item title and actions in the header, move editable pricing controls into a denser grid, and keep the most important totals in a compact metrics strip.

## Key Decisions

- Keep `LineItemsTable.vue` as the main editing surface.
- Preserve all pricing and tax calculations in existing quotation utilities.
- Show `来源总额` / `Source total` only when it is actionable:
  - grouped item
  - stored expected total exists
  - stored expected total does not match computed child total
- Keep `含税金额` visible in both tax modes as the primary customer-facing total.
- In mixed tax mode, keep tax-class selectors visible on parent and child rows.

## Layout Changes

- Reduce major-item card padding and vertical gaps.
- Keep description available, but make it visually secondary and shorter by default.
- Replace wide rollup cards with smaller metric tiles.
- Tighten child-row padding, badge size, and metadata spacing.

## Constraints

- No pricing formula changes.
- No changes to file format or stored quotation schema.
- No git commits.
