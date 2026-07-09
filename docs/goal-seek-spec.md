# Goal Seek Feature Spec

## Purpose

Add a simple internal pricing tool that calculates markup rates from target prices.

This is not an Excel-style solver. The app pricing model is simple enough to calculate the needed markup directly.

## Scope

Goal seek supports two modes:

1. Item goal seek
2. Quotation goal seek

The target price is always before tax.

## Item Goal Seek

Item goal seek calculates an item-specific markup rate from a target unit price before tax.

Formula:

```text
markupRate = (targetUnitPriceBeforeTax / convertedUnitCost - 1) * 100
```

Rules:

- Only detail/leaf items are eligible.
- Only `cost_plus` items are eligible.
- Parent/group items are not eligible.
- `manual_price` items are not eligible.
- Items with zero or invalid converted unit cost are not eligible.
- Applying item goal seek writes `markupRate` to the item.
- If the item previously inherited markup from a parent or global markup, applying creates an item-level markup override.
- Quantity does not affect item unit-price goal seek.

## Batch Item Goal Seek

Batch item goal seek uses the same item goal seek calculation for multiple selected detail items.

UI rules:

- Do not add permanent checkboxes to the main quotation editor.
- Use checkboxes only inside the goal seek dialog.
- The dialog lists eligible detail items.
- Each selected row has its own target unit price before tax.
- Preview shows the calculated markup for each selected row.
- If any selected row is invalid, disable Apply.
- Apply is all-or-nothing.
- Applying multiple rows should be one undo/redo step.

## Quotation Goal Seek

Quotation goal seek calculates the global markup rate needed to hit a target quotation subtotal after markup and before tax.

Formula:

```text
globalMarkupRate = ((targetSubtotalBeforeTax - fixedSubtotal) / adjustableBaseSubtotal - 1) * 100
```

Definitions:

- `targetSubtotalBeforeTax`: desired quotation subtotal after markup and before tax.
- `fixedSubtotal`: subtotal from rows that global markup must not change.
- `adjustableBaseSubtotal`: converted base cost subtotal from eligible rows using global markup.

Rules:

- Applying quotation goal seek writes `totalsConfig.globalMarkupRate`.
- Items with own markup are fixed.
- Items inheriting markup from parent/group are fixed.
- `manual_price` items are fixed but still count toward the target subtotal.
- Only detail `cost_plus` items using global markup are adjustable.
- If no items use global markup, reject quotation goal seek.
- If the target is below the minimum possible subtotal, reject it.
- Quotation goal seek must use converted base-currency costs, matching normal quotation calculations.

Minimum possible subtotal:

```text
fixedSubtotal + adjustableBaseSubtotal
```

## Rounding And Limits

- Target money values are rounded to 2 decimals.
- Calculated markup rates are rounded to 4 decimals.
- Negative markup is not allowed.
- Markup above the app's maximum markup limit is not allowed.
- Do not silently clamp invalid results.
- Show a clear validation message instead.

Example validation messages:

- `Target price is below cost. Minimum target is {amount}.`
- `Target price is too high. Maximum target is {amount}.`
- `This item has no valid unit cost. Enter a unit cost before using goal seek.`
- `No items are using global markup, so global goal seek cannot adjust this quotation.`
- `Target is too low. Minimum subtotal before tax is {amount}.`

## UI

Use one shared Goal Seek dialog.

Entry points:

- Item markup area: opens the dialog with that item preselected.
- Quotation pricing/global markup area: opens the dialog in quotation mode.
- Optional batch entry point: opens the dialog in item batch mode with eligible items listed.

Preview should show:

For item mode:

- current unit price before tax
- target unit price before tax
- calculated markup

For quotation mode:

- current subtotal before tax
- target subtotal before tax
- calculated global markup

The dialog should have an explicit Apply button. Do not change pricing while the user types.

## Undo And Redo

Goal seek must use normal quotation state updates.

- Item apply updates normal item `markupRate` fields.
- Quotation apply updates normal `totalsConfig.globalMarkupRate`.
- Do not create hidden goal seek state.
- A single apply action should behave as one undo/redo step.

## Persistence And Export

- Do not store goal seek targets in quotation data.
- After applying, only the resulting markup rate is saved.
- Goal seek is internal only.
- Customer-facing PDF/export should not mention goal seek.

## Status Messages

Show simple status/toast messages after applying:

- `Goal seek applied to item.`
- `Goal seek applied to {count} items.`
- `Goal seek applied to global markup.`

All user-visible strings must use i18n keys in both English and Simplified Chinese.

## Tests

Add focused Vitest coverage for solver utilities:

- item target below cost rejects
- item valid target returns expected markup
- item target above max markup rejects
- quotation target respects fixed/manual/own-markup items
- quotation target rejects when no global-markup items
- quotation target below minimum subtotal rejects

UI tests can be added later if the dialog behavior becomes complex.

## Out Of Scope For First Version

- After-tax goal seek
- Goal seek for parent/group items
- Permanent multi-select in the main editor
- Importing or pasting targets from Excel/CSV
- Storing goal seek target values
- Partial apply for batch item goal seek
