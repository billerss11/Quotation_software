# Quotation Software User Manual

## 1. Purpose

Quotation Software is a Windows-first desktop quotation tool for building, pricing, previewing, saving, reusing, and exporting quotations. It is designed for repeat quotation work with structured line items, reusable customer/company data, exchange-rate control, and print/PDF output.

This manual covers the software as implemented in the current repository.

## 2. What The Software Does

You can use the software to:

- Create a new quotation with an automatic quotation number.
- Enter quotation header details such as project name, date, validity, customer, notes, and document language.
- Build line items with parent items, child items, and third-level detail rows.
- Price quotations in either quick final-price mode or detailed cost-plus mode.
- Manage markup, discount, tax, and exchange rates.
- Reuse customer records and company profiles.
- Add a company logo to the quotation output.
- Preview the quotation before printing or exporting.
- Export quotations to PDF.
- Save quotations to JSON files and reopen them later.
- Import and export line items as CSV.
- Review quotation analysis charts and margin summaries.
- Store reusable library data for customers, company profiles, and quotation numbering.

## 3. Main Screen Layout

The application has two main modules in the left sidebar:

- `Editor`: the quotation workspace.
- `Settings`: app preferences, reusable company profiles, reusable customer records, and reusable library file actions.

Inside `Editor`, the main areas are:

- Command bar at the top.
- Line-item workbench in the center.
- Support panels on the right.
- Totals bar at the bottom.
- Analysis workspace as a second mode beside the editor.

## 4. Recommended First-Time Setup

Before preparing live quotations, set up the reusable data once.

### 4.1 Choose The App Language

1. Open `Settings`.
2. Stay on the `General` tab.
3. Change `App language` to `English` or `Simplified Chinese`.

This changes the software interface language. It does not automatically change the quotation document language.

### 4.2 Create Or Open A Reusable Library File

The reusable library stores:

- company profiles
- customer records
- quotation numbering state

Use this if you want continuity between computers or want to back up reusable records separately from local browser/app storage.

In `Settings`, use the `Library File` section:

- `New Library`: start a new reusable library in memory.
- `Open Library`: load an existing `quotation-library.json`.
- `Save Library`: save the current library to its current file path.
- `Save Library As`: save the library to a new file path.

Recommended practice:

- Keep one main `quotation-library.json` in a backed-up folder.
- Save it after editing customers or company profiles.
- Copy the same file to another PC if you want the same numbering and reusable records there.

### 4.3 Create Company Profiles

Company profiles represent the sender company for quotations.

1. Open `Settings`.
2. Open the `Company Profiles` tab.
3. Click `New profile`.
4. Enter:
   - company name
   - contact number
   - email
5. Click `Save profile`.

Important:

- Quotations do not stay live-linked to the company profile.
- When you choose a company profile in a quotation, the software copies it into that quotation as a snapshot.
- This protects old quotations from changing when the reusable company record changes later.

### 4.4 Create Customer Records

Customer records allow fast reuse of common customer information.

1. Open `Settings`.
2. Open the `Customers` tab.
3. Click `New customer`.
4. Enter:
   - customer company
   - contact person
   - contact details
5. Click `Save record`.

You can later load these values into a quotation and still edit the quotation fields independently.

## 5. Daily Quotation Workflow

The normal workflow is:

1. Create a new quotation.
2. Fill in quote info.
3. Select company and customer data.
4. Build line items.
5. Set pricing, discount, tax, and exchange rates.
6. Preview the document.
7. Save the quotation.
8. Export PDF or print.

## 6. Creating A New Quotation

In the command bar, use:

- `New` from the More menu to start a fresh quotation.

When a new quotation is created:

- the software generates a quotation number automatically in the format `Q-YYYY-NNN`
- the next number comes from the reusable library numbering state
- a default company profile snapshot is applied if at least one company profile exists

Example: `Q-2026-001`

## 7. Understanding The Command Bar

The command bar shows:

- quotation number
- project name
- customer line
- current file name or `Unsaved file`
- status messages
- workspace mode toggle
- core actions

Available actions:

- `Save`
- `Preview`
- `Export PDF` or `Print` depending on runtime capability
- More menu actions
- logo upload

More menu actions:

- `New`
- `Save As`
- `Load Latest`
- `Import CSV`
- `Export CSV`
- `Export CSV Template`
- `Import Quotation`
- `Export Quotation`
- `Upload logo`

## 8. Keyboard Shortcuts

The editor supports:

- `Ctrl + S`: save the current quotation
- `Ctrl + P`: open or close the preview window
- `Ctrl + B`: show or hide the right-side support panels

## 9. Quote Info Panel

Open the right-side support panels and select `Quote info`.

Fields available:

- quotation number
- revision
- quotation date
- project name
- document language
- validity period
- quotation currency
- notes
- terms and conditions

Notes:

- `Document language` controls the quotation document language.
- `App language` in Settings controls the software UI language.
- `Show notes & terms` expands extra text fields.
- Changing quotation currency rebases quote-currency amounts such as fixed discount and manual prices.

## 10. Customer Panel

Open the `Customer` panel on the right side.

This area has three functions:

1. select a saved company profile
2. select a saved customer
3. edit the live customer fields on the quotation

### 10.1 Applying A Company Profile

Use the `Saved companies` selector to choose the sender company.

After selection:

- the quotation stores a company snapshot
- the snapshot is shown below the selector
- future edits to the reusable profile do not change existing saved quotations automatically

### 10.2 Applying A Saved Customer

Use the `Saved customers` selector to fill:

- customer company
- contact person
- contact details

After loading a customer, you can still edit the quotation fields manually.

### 10.3 Manual Customer Entry

You can also type customer details directly without using the library.

Use this for one-off customers or when the reusable library has not been set up yet.

## 11. Line Item Workbench

The line-item workbench is the main editing area.

It supports:

- root items
- child items
- third-level detail rows
- roll-up calculations
- incomplete-line detection
- quick or detailed entry mode

### 11.1 Root Items, Child Items, And Detail Rows

The software supports a practical three-level structure:

- level 1: root item / major item
- level 2: child item / sub-item
- level 3: detail line

You can add child items until level 3. Third-level rows cannot create further children from the UI.

### 11.2 Adding Items

Use:

- `Add item` to add a new root item
- `Add child` on a row to add a nested child

When the quotation is empty, the workbench shows an empty-state prompt with an `Add item` button.

### 11.3 Editing Item Fields

Depending on the row type and entry mode, you can edit:

- item name
- description
- quantity
- unit
- pricing basis
- final unit price
- unit cost
- cost currency
- markup override or child markup fallback
- tax class
- expected/source total

### 11.4 Group Rows And Roll-Up Behavior

Rows with children behave as group rows.

For group rows:

- child amounts roll up automatically
- parent amounts are calculated
- you do not manually enter a final selling value for the group as a leaf line
- child markup fallback can be used for children that do not have their own markup override

### 11.5 Expanding And Collapsing

You can:

- collapse or expand each root item
- collapse or expand nested grouped child rows
- use `Collapse all` or `Expand all`

This is useful for large quotations.

### 11.6 Incomplete Line Detection

The workbench shows an incomplete warning badge when required fields are missing.

Click the badge to jump to the first incomplete root section.

Typical incomplete cases:

- empty item name
- quantity not greater than zero
- unit missing
- final unit price missing in quick/manual-price mode
- unit cost missing in detailed cost-plus mode

### 11.7 Reordering, Duplicating, And Deleting

Current implemented behavior:

- root items can be moved up or down
- root items can be duplicated
- any row can be deleted
- child rows do not currently expose separate move-up, move-down, or duplicate actions

If you delete the last remaining root item, the software recreates a blank item so the quotation never stays completely itemless.

## 12. Entry Modes

The workbench has two entry modes.

### 12.1 Quick Mode

Quick mode is designed for fast quote entry when you already know the selling price.

In quick mode:

- leaf rows use final unit price entry
- detailed cost-plus inputs are hidden
- totals are based on direct selling values rather than visible cost-plus editing

Use quick mode when:

- the quote is customer-price driven
- detailed cost tracking is not needed on every row
- you need the fastest data-entry workflow

### 12.2 Detailed Mode

Detailed mode is for cost-based quoting.

In detailed mode:

- leaf rows can use `Cost + markup`
- leaf rows can also be switched individually to `Final price`
- unit cost and cost currency are available
- markup logic is visible

Use detailed mode when:

- you need cost control
- the quotation mixes currencies
- margin analysis matters
- per-item markup decisions matter

### 12.3 Switching Modes

When switching from detailed to quick mode:

- the software converts leaf rows to manual-price mode using the currently calculated selling price

This is useful when you want to lock in current calculated selling values and continue faster.

## 13. Pricing Model

Pricing is controlled by:

- item-level pricing method
- global markup
- item markup override
- customer-facing quote currency
- exchange rates
- discount
- tax

### 13.1 Pricing Basis Per Leaf Row

Leaf rows can be priced in two ways:

- `Final price`
- `Cost + markup`

`Final price`:

- you enter the customer unit price directly

`Cost + markup`:

- you enter unit cost
- choose cost currency
- markup is applied
- the software calculates selling price

### 13.2 Global Markup

In the `Pricing & tax` panel, `Global markup` applies as the default markup for the quotation.

If an item does not have its own markup override, it inherits the applicable markup chain.

### 13.3 Item Markup Override

You can override markup on individual priced rows.

For group rows, the markup field acts as child fallback markup for children that do not define their own value.

### 13.4 Expected Or Source Total

Rows also expose a source/expected total reference field.

This is useful when:

- matching supplier source amounts
- comparing imported values with calculated roll-ups
- checking if child totals match a known source figure

The UI can flag mismatches when source total and child roll-up total differ.

## 14. Pricing & Tax Panel

Open the `Pricing & tax` panel to control quotation-wide commercial settings.

You can manage:

- tax mode
- global markup
- discount mode
- discount value
- single-tax rate or mixed-tax classes
- live totals summary

### 14.1 Discount Modes

Supported discount modes:

- `Percentage`
- `Fixed amount`

Discount is applied after markup and before tax.

### 14.2 Tax Modes

Supported tax modes:

- `Single tax`
- `Mixed tax`

`Single tax`:

- one tax class applies across the quotation

`Mixed tax`:

- multiple tax classes can be defined
- different rows can use different tax classes

### 14.3 Mixed Tax Classes

In mixed-tax mode you can:

- add tax classes
- rename tax classes
- change tax rates
- set the default tax class
- delete tax classes, as long as at least one remains

### 14.4 Switching Mixed Tax Back To Single Tax

If the quotation currently contains multiple effective tax classes and you switch to `Single tax`:

- the software opens a dialog
- you must choose which tax class to keep
- all rows are updated to that single class

### 14.5 Totals Summary

The panel displays:

- total cost
- markup
- discount
- price before tax
- tax
- total

In mixed-tax mode, tax can be broken out by tax bucket.

## 15. Exchange Rates Panel

Open the `FX rates` panel to manage quotation-level exchange rates.

The panel shows rates in this format:

- `1 unit of source currency = X units of quotation currency`

Example:

- if the quotation currency is `USD`, the `EUR` rate means `1 EUR = X USD`

### 15.1 What Exchange Rates Affect

Exchange rates affect:

- cost-plus pricing for rows with foreign cost currencies
- converted cost analysis
- totals based on converted costs

### 15.2 Adding A Currency

1. Click `Add currency`.
2. Enter a valid 3-letter code such as `USD`, `EUR`, `JPY`, or `CNY`.
3. Confirm.

### 15.3 Removing A Currency

A currency cannot be removed if:

- it is the current quotation currency
- one or more line items are using it as their cost currency

### 15.4 Changing The Quotation Currency

You can change the quotation currency from the workbench header or Quote info panel.

When quotation currency changes:

- exchange rates are rebased
- fixed discount values are rebased
- manual-price fields are rebased
- expected totals are rebased

This helps keep quote-currency values aligned after a currency switch.

## 16. Totals Bar

At the bottom of the editor workspace, the totals bar gives a fast live summary.

In detailed mode it emphasizes:

- total cost
- markup
- discount if any
- tax if any
- grand total

In quick mode it emphasizes:

- price before tax
- discount if any
- tax if any
- grand total

## 17. Preview, Print, And PDF Export

### 17.1 Preview

Click `Preview` or press `Ctrl + P`.

The preview opens in a floating preview window inside the app session.

Use preview to check:

- company logo
- company details
- customer details
- line-item formatting
- tax and total presentation
- notes and terms

### 17.2 Export PDF

On the desktop runtime, `Export PDF` writes a PDF file directly.

Use this when:

- you need a shareable quotation document
- you want a fixed exported file for email or records

### 17.3 Print

In environments without direct PDF export, the software opens a print-oriented document and uses browser print behavior.

For the Windows desktop build, direct PDF export is expected.

## 18. Logo Upload

Use `Upload logo` from the More menu.

What happens:

- you select an image file
- the logo is embedded into the quotation preview/document
- the logo is stored inside the quotation data

This means the saved quotation carries its own logo data and does not depend on the original file staying in the same folder.

## 19. Analysis Workspace

The command bar lets you switch between:

- `Editor`
- `Analysis`

The analysis workspace helps review pricing quality and margin composition.

### 19.1 What Analysis Shows

The current implementation includes:

- KPI cards
- cost distribution by major item
- revenue and profit by major item
- markup bridge chart
- currency exposure by major item
- margin ranking table

### 19.2 How To Use Analysis

Use it to answer questions such as:

- which major item carries the most cost
- which sections contribute the most profit
- how much discount is reducing the quote
- where foreign-currency exposure is concentrated

### 19.3 Clicking Back Into The Editor

Charts and the margin table can send you back to the related item in the editor.

When you select an item from analysis:

- the software switches back to the editor
- the relevant root item is brought into view

## 20. Saving And Reopening Quotations

The software supports both local draft storage and file-based storage.

### 20.1 Local Drafts

When you save a quotation, the software stores a local draft copy.

Use `Load Latest` to restore the most recently saved draft from local storage.

This is useful when:

- you closed the app without saving to a named file
- you want to continue the latest in-progress work

### 20.2 Save

`Save` writes the quotation to the current file path if one already exists.

If the quotation has not been saved to a file yet, Save will prompt for a file path.

### 20.3 Save As

`Save As` lets you choose a new file path for the quotation JSON file.

Use this when:

- creating a variation of an existing quote
- saving revisions as separate files
- moving the quote to a new folder

### 20.4 Import Quotation

Use `Import Quotation` to open a quotation JSON file and replace the current in-memory quotation.

### 20.5 Export Quotation

Use `Export Quotation` to write the current quotation to JSON without relying on the current saved path.

This is useful for sharing or archiving a snapshot.

## 21. Quotation JSON Files

Quotation JSON files preserve quotation data such as:

- header data
- line items
- exchange rates
- totals configuration
- branding
- company profile snapshot

Recommended use:

- store one JSON file per quotation
- organize by customer, project, or year
- keep PDFs beside the source JSON if you need both editable and final copies

## 22. CSV Import And Export

The software supports CSV for line items only.

This is useful when:

- you prepare item lists in Excel
- you receive structured line-item data from another system
- you want to bulk-edit item rows

### 22.1 Export CSV Template

Use `Export CSV Template` to get the correct column structure before preparing import data.

### 22.2 Export CSV

Use `Export CSV` to export the current line-item structure to CSV.

### 22.3 Import CSV

Use `Import CSV` to replace the current line items with rows from a CSV file.

The quotation header, customer data, pricing settings, and other quotation-level information stay on the quotation. Only line items are replaced.

### 22.4 CSV Columns

The current full CSV format uses these columns:

- `item_code`
- `item_name`
- `item_description`
- `qty`
- `qty_unit`
- `pricing_basis`
- `unit_price`
- `unit_cost`
- `cost_currency`
- `tax_class`
- `markup_override`
- `expected_total`

### 22.5 How Item Codes Work

`item_code` defines hierarchy:

- `1` = root item
- `1.1` = child item
- `1.1.1` = third-level detail row

The current CSV parser supports up to three levels.

### 22.6 CSV Pricing Rules

For leaf rows:

- `manual_price` rows must provide `unit_price`
- `cost_plus` rows must provide `unit_cost`
- `cost_plus` rows must provide `cost_currency`
- leaf rows must provide `qty`

For grouped rows:

- pricing basis may be blank
- roll-up comes from children

### 22.7 CSV Tax Class Rules

If `tax_class` is provided, it must match an existing tax class label or ID in the current quotation.

### 22.8 CSV Validation Errors

Common CSV import failures include:

- empty file
- invalid headers
- invalid item code
- missing item name
- invalid number
- unsupported pricing basis
- unsupported currency
- unsupported tax class
- missing parent item
- missing leaf quantity
- missing leaf unit price
- missing leaf unit cost
- missing leaf currency
- duplicate item code

Practical recommendation:

- always start from the exported template or a known-good export
- keep `item_code` unique
- confirm tax classes in the quotation before importing rows that reference them

## 23. Company Profiles In Real Use

Use company profiles when:

- the same organization sends many quotations
- you have multiple sender entities
- you want stable sender details in each saved quotation

Recommended workflow:

1. build the company profile library in `Settings`
2. choose the correct company in each quotation
3. verify the `Quotation company snapshot` in the Customer panel
4. preview before exporting

## 24. Customer Library In Real Use

Use the customer library when:

- you repeatedly quote to the same companies
- contact details must be reused accurately
- you want faster data entry

Recommended workflow:

1. save reusable customers in `Settings`
2. load them into the quotation from the Customer panel
3. adjust project-specific contact details if needed

## 25. Document Language vs App Language

There are two separate language controls.

`App language`:

- changes the software interface
- set in `Settings`

`Document language`:

- changes the quotation document language
- set per quotation in `Quote info`

This lets you run the software in one language and issue the customer-facing quote in another.

## 26. Quotation Numbering

Quotation numbering is automatic and follows the format:

- `Q-YYYY-NNN`

The sequence is tracked in the reusable library data.

What this means in practice:

- starting a new quotation advances the numbering state
- opening the same reusable library on another PC carries the numbering state with it
- manually editing a quotation number to a higher valid sequence updates future numbering

If you care about uninterrupted numbering across machines, use one shared `quotation-library.json` process and keep it current.

## 27. Suggested Folder Strategy

A practical desktop setup is:

- one folder for reusable library data
- one folder tree for quotation JSON files
- one folder tree for exported PDFs

Example:

- `QuotationData/quotation-library.json`
- `QuotationData/Quotes/2026/Customer A/Q-2026-014.json`
- `QuotationData/Quotes/2026/Customer A/Q-2026-014.pdf`

## 28. Backup And Transfer Between PCs

To move the working environment to another PC, back up:

- `quotation-library.json`
- quotation JSON files
- exported PDFs if needed

Important:

- reusable customers, company profiles, and numbering continuity depend on the reusable library file if you want controlled transfer
- local drafts alone are not a reliable long-term transfer method

## 29. Common User Scenarios

### 29.1 Fast Simple Quote

Use this when you already know selling prices.

1. Create a new quotation.
2. Fill in quote info and customer.
3. Switch line items to `Quick`.
4. Add rows and enter final prices.
5. Set discount or tax if needed.
6. Preview.
7. Save JSON and export PDF.

### 29.2 Cost-Plus Engineering Quote

Use this when costs come from vendors in mixed currencies.

1. Create a new quotation.
2. Fill in quote info.
3. Stay in `Detailed` mode.
4. Add root items and child/detail rows.
5. Enter unit cost and cost currency per priced leaf row.
6. Set global markup and overrides.
7. Add exchange rates.
8. Review totals and analysis.
9. Preview and export.

### 29.3 Reusing A Previous Customer

1. Open the Customer panel.
2. Select a saved customer.
3. Confirm the fields populate.
4. Edit only the project-specific differences if needed.

### 29.4 Reusing A Sender Company

1. Open the Customer panel.
2. Select a saved company profile.
3. Confirm the company snapshot.
4. Continue editing the quote.

### 29.5 Importing A Large Item List From Excel

1. Export the CSV template first.
2. Fill it in using the required columns.
3. Check `item_code` hierarchy and tax class names.
4. Import CSV.
5. Review the result in the workbench.
6. Fix any validation errors and re-import if needed.

### 29.6 Creating A Revision Of An Existing Quote

1. Import the existing quotation JSON.
2. Change `Revision`.
3. Update lines and commercial terms.
4. Use `Save As` to create a separate file.
5. Export a new PDF.

### 29.7 Moving To Another Computer

1. Save the reusable library file.
2. Copy the library JSON and quotation JSON files to the new PC.
3. Open the library in `Settings`.
4. Open the quotation JSON file.
5. Continue working with the same reusable records and numbering base.

## 30. Troubleshooting

### 30.1 Save Failed

Possible causes:

- file operation issue
- local draft storage full

Actions:

- try `Save As`
- save to a new folder
- export the quotation JSON
- remove unneeded local drafts if storage is full

### 30.2 Cannot Remove A Currency

Cause:

- the currency is the quotation currency, or
- at least one line item still uses it

Action:

- change affected line items to another cost currency first

### 30.3 CSV Import Failed

Likely causes:

- wrong headers
- invalid item codes
- tax class mismatch
- unsupported currency code
- missing required leaf values

Action:

- compare the file with the exported CSV template

### 30.4 Old Quotations Show The Wrong Company

If this happens, check whether the wrong company profile was selected before saving. Existing quotations store a company snapshot, so later profile edits should not overwrite historical quotes.

### 30.5 Analysis Looks Incomplete

Analysis depends on meaningful priced rows. If the quotation has many incomplete or non-costed rows, some analysis insights will be limited.

### 30.6 Numbering Looks Wrong Across Computers

Cause:

- different machines are using different reusable library states

Action:

- standardize on one `quotation-library.json`
- open that library on the active machine
- save it after major changes

## 31. Current Implementation Notes And Limits

The current implementation behaves as follows:

- the left navigation currently has `Editor` and `Settings`; there is no separate dashboard screen
- customer management lives inside `Settings`, not as a separate top-level module
- root items can be reordered and duplicated; child rows currently cannot
- line-item CSV import supports up to three hierarchy levels through `item_code`
- the quotation editor always keeps at least one root item in the draft

These notes are useful if product requirements mention broader future scope than the current shipped UI.

## 32. Best Practices

- Create and save the reusable library before serious production use.
- Keep one authoritative `quotation-library.json`.
- Use `Detailed` mode for multi-currency or margin-sensitive quotations.
- Use `Quick` mode for fast customer-price entry.
- Export the CSV template before preparing imports manually.
- Preview every quotation before PDF export.
- Save the editable JSON file as well as the final PDF.
- Use `Save As` when preparing revisions or customer-specific variations.

## 33. End-To-End Example

A full professional workflow looks like this:

1. Open `Settings` and load your reusable library.
2. Confirm app language.
3. Confirm the needed company profile and customer records exist.
4. Switch to `Editor`.
5. Start a new quotation.
6. Fill in quotation date, project, validity, document language, and currency.
7. Choose the sender company profile.
8. Choose a saved customer.
9. Add line items and children.
10. Set pricing in quick or detailed mode.
11. Add discount, tax, and exchange rates.
12. Upload logo if needed.
13. Review totals.
14. Open `Analysis` and inspect margin/currency exposure.
15. Return to `Editor` if adjustments are needed.
16. Open `Preview`.
17. Save the quotation JSON.
18. Export PDF.
19. Save or update the reusable library if customer or company data changed.

This gives you:

- a reusable customer/company data base
- an editable source quotation
- a customer-facing PDF
- consistent numbering continuity
