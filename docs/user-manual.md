# Quotation Software User Manual

Last verified against the current codebase: 16 July 2026

This manual uses the English UI labels. If the app or document language is Simplified Chinese, the wording changes but the buttons, icons, and workflows stay in the same place.

## Contents

1. [What the application does](#1-what-the-application-does)
2. [Desktop and web differences](#2-desktop-and-web-differences)
3. [Screen layout and icon guide](#3-screen-layout-and-icon-guide)
4. [First-time setup](#4-first-time-setup)
5. [Company profiles](#5-company-profiles)
6. [Customer records](#6-customer-records)
7. [Create, save, open, and back up quotations](#7-create-save-open-and-back-up-quotations)
8. [Keyboard shortcuts and undo/redo](#8-keyboard-shortcuts-and-undoredo)
9. [Quotation information](#9-quotation-information)
10. [Sender and customer details](#10-sender-and-customer-details)
11. [Line-item entry modes](#11-line-item-entry-modes)
12. [Add and edit line items](#12-add-and-edit-line-items)
13. [Build a three-level item structure](#13-build-a-three-level-item-structure)
14. [Sections, ordering, and the Outline](#14-sections-ordering-and-the-outline)
15. [Cost-plus and final-price calculations](#15-cost-plus-and-final-price-calculations)
16. [Markup inheritance](#16-markup-inheritance)
17. [Tax setup](#17-tax-setup)
18. [Extra charges](#18-extra-charges)
19. [Currencies and exchange rates](#19-currencies-and-exchange-rates)
20. [Goal seek](#20-goal-seek)
21. [Calculation Sheet and Calculation Steps](#21-calculation-sheet-and-calculation-steps)
22. [Totals and incomplete-item checks](#22-totals-and-incomplete-item-checks)
23. [Preview, templates, logo, and PDF output](#23-preview-templates-logo-and-pdf-output)
24. [Analysis workspace](#24-analysis-workspace)
25. [Generate a goods receipt](#25-generate-a-goods-receipt)
26. [CSV import and export](#26-csv-import-and-export)
27. [Quotation JSON import and export](#27-quotation-json-import-and-export)
28. [Library backup and transfer](#28-library-backup-and-transfer)
29. [Recommended end-to-end workflows](#29-recommended-end-to-end-workflows)
30. [Troubleshooting](#30-troubleshooting)
31. [Limits and important behavior](#31-limits-and-important-behavior)

## 1. What the application does

Quotation Software is a local-first quotation editor. It can:

- Create English or Simplified Chinese quotations.
- Store reusable sender-company profiles and customer records.
- Build flat or hierarchical quotations with up to three item levels.
- Price items by cost plus markup or by directly entered final unit price.
- Use one tax rate or multiple tax classes.
- Convert costs from several currencies into the quotation currency.
- Calculate totals, cost, markup, tax, cost/sales percentage, and margin analysis.
- Preview and print a customer-facing quotation using six document templates.
- Export quotation data as JSON or CSV.
- Generate a goods receipt from quotation items.

The application is local-first. Quotation JSON files and library backup files are the safest way to transfer or archive work.

## 2. Desktop and web differences

The same quotation editor is used in both versions, but file and printing buttons differ.

| Task | Desktop app | Web app |
|---|---|---|
| Save current quotation | Click **Save**. The app can write back to the selected file. | Click **Download**. A JSON file is saved through the browser or browser file picker. |
| Save with a different name | **More** > **Save As** | Use **Download** again. Browser behavior depends on file-system support. |
| Create PDF | Click **Export PDF** | Click **Print**, then choose **Save as PDF** in the browser print dialog. |
| Goods receipt output | **Export PDF** in the goods-receipt dialog | **Print GR**, then use the browser print dialog. |
| File paths | Full Windows path can be shown. | Usually only the selected or downloaded file name is shown. |

If a browser blocks a print tab or download, allow pop-ups/downloads for the application site and try again.

## 3. Screen layout and icon guide

### 3.1 Main areas

The application has two navigation buttons on the far-left sidebar:

- **Editor**, with a file-edit icon: create and work with quotations.
- **Settings**, with a gear icon: app language, backups, company profiles, and customers.

Inside **Editor**, the top command bar contains:

- The quotation number.
- Project name or **Untitled**.
- Customer name or **No customer selected**.
- Current file name or **Unsaved file**.
- **Editor** and **Analysis** workspace tabs.
- File, preview, PDF/print, goods-receipt, and menu actions.

The main Editor workspace has:

- The line-item work area in the center/left.
- A resizable support panel on the right.
- A totals bar at the bottom of the item work area.

Drag the narrow divider beside the support panel to make it wider or narrower. Click the chevron at the far right to hide or show the panel. The width and collapsed state are remembered.

### 3.2 Support-panel groups

The support panel has three top-level icon groups:

| Group | Icon appearance | Panels inside |
|---|---|---|
| Details | ID-card | **Quote info**, **Parties** |
| Pricing | Calculator | **Pricing & tax**, **FX rates** |
| Structure | List | **Outline** |

Click a group, then click the required panel tab inside it.

### 3.3 Common icon meanings

Buttons usually show a label, tooltip, or accessible name when hovered. The common icons are:

| Icon appearance | Meaning |
|---|---|
| Plus | Add an item, section, tax class, currency, charge, profile, or customer |
| Downward arrow into a tray | Download/save data |
| Eye | Open quotation preview |
| Printer or PDF document | Print or export PDF |
| Truck | Generate goods receipt |
| Vertical three dots | Open **More** actions |
| Up/down arrows | Move a root row earlier or later |
| Copy | Duplicate a complete root item and its children |
| Calculator | Open the Calculation Sheet |
| Information circle | Show Calculation Steps or explanatory help |
| Target/bullseye | Open goal seek |
| Trash can | Delete the row or record |
| Bookmark | Section header, not a priced item |
| Chevron | Expand/collapse a group or panel |
| Drag grip | Drag an Outline row to reorder or reparent it |
| Star | Current default tax class; an outline star can make another class the default |

## 4. First-time setup

Complete these steps before creating regular quotations.

1. Click **Settings** in the left sidebar.
2. Stay on the **General** tab.
3. Under **Appearance**, choose an **Application theme**.
4. Choose **English** or **Simplified Chinese** from **App language**.
5. Open **Company Profiles** and create at least one sender company.
6. Open **Customers** and add regular customers if useful.
7. Return to **General** and click **Save backup as** to create a `quotation-library.json` backup after entering reusable records.

Changing **App language** changes the application interface. It does not automatically change the current quotation document language. Set that separately in **Editor** > **Details** > **Quote info** > **Document language**.

The available application themes are **Ledger Teal**, **Modern Blue**, **Warm Sand**, and **Graphite Night**. The selected theme is remembered on the current device. It changes the editor, settings, and Analysis appearance; it does not change the selected quotation document template or the customer-facing PDF.

## 5. Company profiles

Company profiles store reusable sender information.

### 5.1 Create a profile

1. Click **Settings**.
2. Click **Company Profiles**.
3. Click **New profile** (plus icon).
4. Enter:
   - **Company Name**: required.
   - **Contact Number**: optional.
   - **Email**: optional, but it must be a valid email address if entered.
5. Click **Save profile** (save icon).

The left **Profiles** list shows saved records. The most recently updated profiles appear in the reusable library.

### 5.2 Edit a profile

1. Click the profile in the **Profiles** list.
2. Change the fields in **Edit company profile**.
3. Click **Save profile**.

The editor displays the last-updated date for an existing record.

### 5.3 Cancel or delete

- Click **Cancel** to discard the current draft changes.
- Click **Delete profile** (trash icon), then confirm **Delete**, to remove an existing profile.
- If you select another record or start a new one while unsaved changes exist, the app asks whether to keep editing or discard the changes.

Deleting or editing a library profile does not rewrite old quotations. A quotation copies the selected profile into a snapshot so historical output remains stable.

## 6. Customer records

Customer records store reusable recipient information.

### 6.1 Create a customer

1. Click **Settings**.
2. Click **Customers**.
3. Click **New customer** (plus icon).
4. Enter:
   - **Company**.
   - **Contact Person**.
   - **Contact Details**: phone, email, address, or other useful text.
5. Enter at least **Company** or **Contact Person**. One of these is required.
6. Click **Save record**.

### 6.2 Edit or delete

1. Select a record from the **Records** list.
2. Edit the fields.
3. Click **Save record**.

Click **Delete record** and confirm to remove it. Click **Cancel** to restore the selected record's saved values. Unsaved-change confirmation works the same way as in Company Profiles.

Applying a customer to a quotation copies its current values into the quotation. Later edits to the reusable customer record do not automatically alter that quotation.

## 7. Create, save, open, and back up quotations

### 7.1 Start a new quotation

1. Click **Editor**.
2. Click **More** (vertical three-dot icon).
3. Click **New** (file-plus icon).

The app creates a new quotation number, normally in the `Q-YYYY-NNN` pattern, and starts with one blank item. A new quotation also uses the current app language for its initial document language and can use the available sender profile as its initial sender snapshot.

Save or download the current quotation before clicking **New** if you need a separate file copy.

### 7.2 Save in the desktop app

1. Click **Save** in the command bar or press `Ctrl+S`.
2. Choose a location and JSON file name if the quotation has not been saved before.
3. Use **More** > **Save As** to create another copy with a different name.

Saving also places the quotation in the app's local saved-draft list and updates the reusable quotation-numbering state.

### 7.3 Download in the web app

1. Click **Download** in the command bar or press `Ctrl+S`.
2. If the browser supports direct file access, select or confirm a JSON file.
3. Otherwise, find the downloaded JSON in the browser's Downloads folder.

### 7.4 Load the latest locally saved quotation

1. Click **More**.
2. Click **Load Latest** (folder-open icon).

This loads the most recently saved local draft. It is not a file browser and it does not mean “open the newest file from a Windows folder.”

### 7.5 Open a quotation JSON file

1. Click **More**.
2. Click **Import Quotation** (upload icon).
3. Select a quotation `.json` file.

The imported quotation replaces the quotation currently in the editor. Save the current work first if it must be kept.

### 7.6 Command-bar actions

Desktop **More** normally contains:

- **New**.
- **Save As**.
- **Load Latest**.
- **Import line items**.
- **Export CSV**.
- **Export CSV Template**.
- **Import Quotation**.
- **Export Quotation**.
- **Upload logo**.

Web **More** normally contains:

- **New**.
- **Load Latest**.
- **Import line items**.
- **Export CSV**.
- **Export CSV Template**.
- **Import Quotation**.
- **Upload logo**.

The web command bar uses the primary **Download** button for quotation JSON export, so **Export Quotation** is not repeated in **More**.

## 8. Keyboard shortcuts and undo/redo

Windows uses `Ctrl`; macOS-style browser environments use `Command`.

| Shortcut | Action |
|---|---|
| `Ctrl+S` | Save or download the current quotation |
| `Ctrl+P` | Open or close the floating quotation preview |
| `Ctrl+B` | Hide or show the right support panel |
| `Ctrl+Z` | Undo the last quotation change |
| `Ctrl+Y` | Redo the last undone quotation change |
| `Ctrl+Shift+Z` | Alternative redo shortcut |

After undo or redo, a notice describes the changed field or item. The app scrolls to and briefly highlights the affected location when possible.

When the cursor is inside a text box, `Ctrl+Z`, `Ctrl+Y`, and `Ctrl+Shift+Z` are left to the text field for normal typing undo/redo. Click outside the field before using quotation-level undo/redo.

Opening another quotation or resetting the working quotation clears the previous undo/redo history. Undo is not a substitute for saving a file.

## 9. Quotation information

1. In **Editor**, open the right-side **Details** group.
2. Click **Quote info**.

### 9.1 Main fields

| Field | Use |
|---|---|
| **Quotation number** | Customer-visible reference, for example `Q-2026-001` |
| **Revision** | Revision number shown as `Rev. N` |
| **Quotation date** | Date printed on the document |
| **Project name** | Project/title shown in the command bar and document |
| **Document language** | English or Simplified Chinese output text |
| **Document template** | Customer-facing page design |
| **Preview/PDF item detail** | Shows level 1 only, levels 1-2, or levels 1-3 in output |
| **Validity period** | Customer-visible validity text |
| **Currency** | Quotation/sales currency |

Changing **Preview/PDF item detail** only controls customer-facing preview and output. It does not delete hidden children or change their rolled-up totals.

### 9.2 Notes and terms

Turn on **Show notes & terms** to reveal:

- **Notes / Remarks**.
- **Terms & Conditions**.

These fields are printed only when enabled and populated according to the selected template.

## 10. Sender and customer details

1. Open **Details**.
2. Click **Parties**.

### 10.1 From company

- Select a saved company profile from the sender selector.
- The **Quotation company snapshot** shows the sender currently stored in the quotation.
- If no profiles exist, click **Manage profiles** (gear icon). This opens **Settings** > **Company Profiles**.

Selecting a profile copies its company name, contact number, and email into the quotation snapshot.

### 10.2 To customer

- Select a saved customer when available.
- If no customers exist, click **Manage customers**.
- You can also type directly into:
  - **Customer company**.
  - **Contact person**.
  - **Contact details**.

Direct edits affect only the current quotation. They do not modify the saved customer record.

## 11. Line-item entry modes

At the top of **Line Items**, choose **Quick** or **Detailed**.

| Mode | Default for newly added leaf items | Best for |
|---|---|---|
| **Quick** | **Final price** | Entering a known selling price quickly |
| **Detailed** | **Cost + markup** | Costing, FX conversion, markup, margin, and analysis |

Important: changing the mode does not convert existing items. It only changes the default pricing basis for items added afterward. Every leaf row can still be changed individually using **Pricing basis**.

## 12. Add and edit line items

### 12.1 Add a root item

1. Click **Add item** (plus icon) above the work area.
2. Enter the item name and description.
3. Enter a positive **Qty** and a **Unit**, such as `EA`, `set`, `hour`, or `lot`.
4. Select **Pricing basis**.
5. Complete the price or cost fields.

### 12.2 Root-card controls

The header of a root item can contain:

- Expand/collapse chevron.
- Item number and name.
- Move up and move down.
- **Duplicate** (copy icon).
- Expand/collapse all levels for grouped items.
- **Calculation Sheet** (calculator icon).
- **Show calculation steps** (information-circle icon).
- **Delete** (trash icon).

**Duplicate** copies the complete root item, including its descendants, and inserts the copy immediately below the source.

Deleting the last remaining root row creates a new blank item so the editor is never left without an editable item row.

### 12.3 Totals and unit summary

Use the **Totals | Unit summary** switch on a root card:

- **Totals** shows quantity, total cost, total markup, subtotal excluding tax, applicable tax, total including tax, and cost/sales percentage.
- **Unit summary** shows per-unit cost, markup, selling price, tax, tax-inclusive price, and cost/sales percentage.

### 12.4 Leaf fields

A detailed cost-plus leaf normally shows:

- **Qty** and **Unit**.
- **Pricing basis**.
- **Unit cost**.
- **Cost FX** currency.
- **Markup override**.
- **Tax class** when mixed tax is enabled.
- Calculated unit price and amount.

A final-price leaf normally shows the direct **Unit price** instead of cost and markup inputs.

## 13. Build a three-level item structure

The maximum item depth is three levels:

- Level 1: root/major item, for example `1`.
- Level 2: child/sub-item, for example `1.1`.
- Level 3: detail item, for example `1.1.1`.

### 13.1 Add children

1. Find the parent item.
2. Click **Add child** at the bottom of its card or row.
3. Complete the new child fields.
4. To create level 3, click **Add child** on a level-2 row.

Level-3 rows do not show another **Add child** action because deeper nesting is not allowed.

### 13.2 Parent and leaf behavior

- An item with children becomes a group/rollup row.
- Leaf rows carry the actual cost-plus or final-price inputs.
- Child/detail values roll up into the parent and then into quotation totals.
- Parent quantity and nested quantities affect the rollup. Use **Calculation Steps** when you need to verify the exact multiplication path.
- A group displays **Default child markup** instead of a direct selling-price input.

### 13.3 Child table

Expanded groups display a child table. Depending on tax mode and row type, columns include:

- Item number and description.
- Qty and unit.
- Unit cost and cost currency.
- Markup.
- Unit price.
- Amount.
- Tax fields in mixed-tax mode.

Child rows also have calculation, add-child, and delete controls where applicable.

## 14. Sections, ordering, and the Outline

### 14.1 Add a section

1. Click **Add section** above the work area.
2. Enter the section title.

A section has a bookmark icon. It is a root-level document heading only; it has no quantity, price, tax, or children.

Use its up/down arrows to move it, or its trash icon to delete it.

### 14.2 Move root rows

Use the up/down arrows on a root item or section to move it one position. Item numbering updates automatically.

### 14.3 Use the Outline

1. Open the **Structure** group in the right panel.
2. Click **Outline**.

The Outline provides:

- **Search outline**: filters by item name, description, number, or section title.
- Expand/collapse controls for groups.
- **Collapse all** or **Expand all**.
- A drag grip for reordering.
- Incomplete markers.
- Click-to-jump navigation.

Click an Outline row to scroll to and focus that item in the editor.

### 14.4 Drag and drop

Drag an Outline item:

- Before or after another root row to reorder it.
- Inside a compatible item to make it a child.
- Out to the root level to remove it from a parent.

The app rejects moves that would:

- Put an item inside itself or its descendant.
- Create more than three item levels.
- Put a section inside an item.

## 15. Cost-plus and final-price calculations

### 15.1 Cost + markup

Use **Cost + markup** when cost and margin are known.

For a simple leaf, the application conceptually calculates:

1. Convert unit cost into the quotation currency using the selected FX rate.
2. Apply the effective markup percentage.
3. Multiply by quantity.
4. Apply the effective tax rate.

The calculation is rounded using the application's money rules. Use **Calculation Steps** for the exact displayed values instead of reproducing the calculation in a separate spreadsheet.

### 15.2 Final price

Use **Final price** when the selling unit price is already known.

1. Select **Final price** under **Pricing basis**.
2. Enter **Unit price**.
3. Enter quantity and unit.
4. Select tax where required.

Final-price rows do not provide reliable cost or profit information unless cost data exists through another supported structure. Analysis reports them as revenue without known cost, and cost coverage can be below 100%.

### 15.3 Cost/Sales percentage

**Cost/Sales** means cost divided by sales value. It is not markup percentage.

- Lower Cost/Sales generally means more gross margin.
- If sales value is zero or cost is unknown, the percentage may be shown as unavailable.

## 16. Markup inheritance

Markup is resolved from the nearest applicable source:

1. A leaf's **Markup override**, if entered.
2. The nearest parent group's **Default child markup**, if applicable.
3. The quotation **Global markup**.

Leave a markup override blank to inherit. Enter `0` to deliberately use zero markup; zero is different from blank.

A group reports whether its default markup is used by all, some, none, or no priced descendants. Manual final-price leaves do not use inherited cost-plus markup.

## 17. Tax setup

1. Open the right-side **Pricing** group.
2. Click **Pricing & tax**.

### 17.1 Single tax mode

1. Set **Tax mode** to **Single**.
2. Enter **Tax/VAT rate**.

The one rate is applied to all priced rows.

### 17.2 Mixed tax mode

Use mixed mode when different items need different tax rates.

1. Set **Tax mode** to **Mixed**.
2. Under **Tax classes**, click **Add tax class**.
3. Enter a class label and rate.
4. Click the star action to make the required class the default.
5. Select a **Tax class** on each applicable item.

The command bar shows a mixed-tax badge while this mode is active.

The last remaining class cannot be deleted. Removing a class that is in use causes rows to fall back according to the current tax configuration, so review item assignments after structural tax changes.

### 17.3 Switch mixed tax back to single

If several effective classes are in use, the app opens a confirmation dialog.

1. Choose the tax class/rate to keep.
2. Confirm the change.

The selected class is then applied as the single tax rate across the quotation.

### 17.4 Mixed-tax document columns

Under **Document columns**, select which columns appear in preview/PDF:

- **Tax %**.
- **Unit Price excl. Tax**.
- **Unit Tax**.
- **Unit Price incl. Tax**.
- **Tax Total**.
- **Amount excl. Tax**.
- **Amount incl. Tax**.

These checkboxes change customer-facing table columns. They do not change calculation results.

## 18. Extra charges

Extra charges are fixed amounts added after line tax.

1. Open **Pricing & tax**.
2. Under **Extra charges**, click **Add charge**.
3. Enter a label, such as `Shipping`, and an amount.
4. Use the trash icon to remove a charge.

Extra charges appear in the quote totals and customer-facing output. They do not belong to an item, do not receive item markup, and are not included in line-item analysis as item revenue/cost.

## 19. Currencies and exchange rates

### 19.1 Choose quotation currency

Set **Currency** either:

- At the top of **Line Items**, or
- In **Details** > **Quote info**.

Both controls edit the same quotation currency.

### 19.2 Edit FX rates

1. Open **Pricing** > **FX rates**.
2. Read each row as: `1 source currency = X quotation currency`.
3. Enter the required positive rate.

The quotation/base currency is locked at `1`.

Example: if the quotation is USD and `1 EUR = 1.10 USD`, enter `1.10` on the EUR row.

To update the currencies already in the table from the internet:

1. Click **Fetch latest rates**.
2. Wait for the Frankfurter reference-rate date to appear.
3. Review every fetched rate before using the quotation.

The fetch action requires an internet connection and at least one non-base currency. If a currency has no online rate, its existing value is kept and the app lists the missing currency. If the request fails, all existing values are kept. These are daily reference rates, not guaranteed transaction rates.

### 19.3 Add or remove a currency

1. Click **Add currency**.
2. Choose a currency from **Select currency**.
3. Click **Add** or click **Cancel**.

Click **Remove** beside an unused non-base currency. The app refuses to remove:

- The quotation currency.
- A currency used by a cost row.
- A duplicate or invalid currency addition.

Changing the quotation currency rebases the FX table. Review all displayed rates afterward.

## 20. Goal seek

Goal seek calculates the markup required to reach a target selling value.

### 20.1 Goal seek selected items

1. Click **Goal seek** above the line-item work area, or click the target icon beside an eligible item's markup.
2. In **Goal Seek Items**, select the rows to change.
3. Enter a **Target unit price** for each selected row.
4. Review the **Preview** result.
5. Click **Apply**.

The dialog provides **Select all** and **Unselect all**.

Only cost-plus leaf/detail rows with a positive cost are eligible. Group rows, final-price rows, and rows without a usable positive cost are excluded. Applying the result writes item-specific markup overrides.

The row-level target icon opens the same dialog focused on that item.

### 20.2 Goal seek the quotation subtotal

1. Open **Pricing & tax**.
2. Click the target icon beside **Global markup**.
3. In **Goal Seek Quotation**, enter **Target subtotal before tax**.
4. Review the calculated markup.
5. Click **Apply**.

This changes the global markup and only affects eligible rows that actually use it. Item overrides and manual final prices limit how much of the quotation can be adjusted. Tax and extra charges are not part of the target subtotal.

If the target is below the fixed minimum or above the allowed markup range, the dialog shows an error and disables **Apply**.

## 21. Calculation Sheet and Calculation Steps

### 21.1 Full-quotation Calculation Sheet

1. Click **Calculation Sheet** above the line items.
2. Review the modal headed **Calculation Sheet - Quotation ...**.

The summary includes:

- Total cost.
- Total markup.
- Total tax.
- Line-items total.
- Extra charges.
- Quote total.

The audit table always shows the item and input columns. Use **Totals** or **Unit amounts** to choose which five amount columns are visible:

- Item number and name.
- Qty and unit.
- Cost currency.
- Markup rate/source.
- Cost/Sales percentage.
- Tax rate/class.
- **Unit amounts**: unit cost, unit markup, unit price, unit tax, and unit total.
- **Totals**: total cost, total markup, subtotal excluding tax, total tax, and total including tax.

Root/group rows are rollups. Leaf rows show the detailed pricing inputs.

The table is wide; scroll horizontally to see all columns. Click **Export CSV** inside this dialog to export the audit sheet. The exported audit file includes both the unit and total amount groups, regardless of the current on-screen toggle. This audit CSV is for review and is not the same as the line-item import CSV.

### 21.2 Per-item Calculation Sheet

Click the calculator icon on a root item to open the same type of sheet scoped to that item and its descendants.

### 21.3 Calculation Steps

1. Click the information-circle icon on a row.
2. In **Calculation Steps**, select any item from the tree on the left.
3. Review the pricing method, markup source, tax source, totals, unit flow, and total flow.

Typical displayed values include:

- Converted/base cost.
- Unit markup.
- Unit selling price.
- Unit tax and tax-inclusive unit price.
- Total cost, markup, subtotal, tax, and final total.
- Effective markup and Cost/Sales percentage.

Drag the divider between the item tree and the explanation to resize it. When the divider is focused, Left/Right arrow keys can resize it. Use the dialog's expand/maximize control when more space is needed.

## 22. Totals and incomplete-item checks

### 22.1 Bottom totals bar

The totals bar updates immediately as data changes. Depending on entry and tax mode, it shows combinations of:

- Total cost.
- Markup.
- Price before tax.
- Cost/Sales.
- Tax or tax buckets.
- Extra charges.
- Final total.

### 22.2 Incomplete badge

The **N incomplete** button appears above the work area when items are missing required values. Click it to jump to the first incomplete item.

An item is incomplete when:

- Its name is blank.
- Quantity is not positive.
- Unit is blank.
- A final-price leaf has no positive manual unit price.
- A cost-plus leaf has no positive unit cost.

Groups need a name, positive quantity, and unit; their leaf descendants carry the price/cost requirement.

Incomplete markers also appear in the Outline. They are editing warnings, not automatic deletion or correction.

## 23. Preview, templates, logo, and PDF output

### 23.1 Open preview

Click **Preview** (eye icon) or press `Ctrl+P`.

The floating preview contains:

- Quotation number and revision.
- Project, date, validity, and currency.
- Sender and customer details.
- Logo when uploaded.
- Sections and line items.
- Notes and terms.
- Tax, extra charges, and totals.

The output obeys **Document language**, **Preview/PDF item detail**, tax-column choices, and the selected template.

Use **Close preview** or `Ctrl+P` to close it.

### 23.2 Templates

The template selector is available in **Quote info** and in the preview header.

| Template | Intended style |
|---|---|
| **Classic** | Original, conventional quotation layout |
| **Technical Bid** | Bold layout for technical/commercial proposals |
| **Executive Summary** | Polished summary-led commercial layout |
| **Luminous** | Light premium presentation |
| **Ribbon Ledger** | Editorial ledger layout with compact control ribbon |
| **Atelier** | Warm editorial layout with a refined project statement |

Changing the template in preview updates the quotation's selected template.

### 23.3 Output item detail

Choose one of:

- **Level 1 only**.
- **Levels 1-2**.
- **Levels 1-3**.

Use level 1 for a short customer summary. Use levels 1-3 when every detail line must be visible. Hidden levels remain part of rollup totals.

### 23.4 Upload a logo

1. Click **More**.
2. Click **Upload logo** (image icon).
3. Select the supported image file.
4. Open preview to confirm size and placement.

The logo is embedded in the quotation JSON. A very large image makes the JSON file larger; use a reasonably sized business logo.

### 23.5 Print or export

Desktop:

1. Click **Export PDF** in the command bar.
2. Choose the file location.

Web:

1. Click **Print** in the command bar or **Print preview** in the floating preview.
2. Wait for the print document/tab to open.
3. Choose **Save as PDF** or a printer in the browser dialog.

Use print preview to confirm page breaks, item detail, tax columns, notes, terms, and totals before sending the document.

## 24. Analysis workspace

Click **Analysis** in the command bar. The editor data remains the source; Analysis does not maintain a separate quotation.

### 24.1 Summary and checks

The top area summarizes values such as:

- Items requiring review.
- Cost visibility/coverage.
- Number of cost currencies.
- Tax mix.

Advisory cards flag:

- Mixed currencies inside an item.
- Mixed tax classes inside an item.
- Zero markup.
- Low markup, using the displayed review threshold.

Use **Show more** or **Show fewer** when an advisory affects several items. Click an affected item to return to **Editor** and focus it.

### 24.2 KPI cards

The KPI area shows:

- Grand total.
- Gross margin amount.
- Gross margin rate.
- Cost coverage rate.

Final-price revenue without known cost lowers cost coverage. Treat profit and margin as incomplete when coverage is below 100%.

### 24.3 Charts and tables

Depending on quotation data, Analysis shows:

- Currency exposure.
- Effective markup by item.
- Revenue and profit by item.
- Cost distribution.
- Markup bridge/waterfall from cost through markup, tax, extra charges, and final total.
- Margin table.

Clicking an item in a chart's item browser or the margin table returns to the matching editor row.

For larger quotations:

- The first 12 items are shown initially in a chart scope.
- Use **Show all items** / **Show fewer items** to change the scope.
- Charts render up to 80 items at once.
- The item browser uses **Previous** and **Next** pages for larger sets.

If the quotation has no meaningful priced data, Analysis shows an empty-state message instead of misleading charts.

## 25. Generate a goods receipt

The goods-receipt tool creates a separate receiving document from quotation items. It does not change quotation quantities or prices.

### 25.1 Open the dialog

1. Make sure the quotation contains usable item rows.
2. Click **Generate GR** (truck icon) in the command bar.

If there are no usable detail items, the command bar shows an error message and the dialog does not open.

### 25.2 Choose a template

At the top of the dialog, select:

- **Standard**.
- **Compact**.

The last selected goods-receipt template is remembered locally.

### 25.3 Complete receipt details

Enter or review:

- **GR No.**.
- **Document date**.
- **Customer PO / Reference**.
- **Project name**.
- **Delivery reference**.
- **Receiving company**.
- **Delivery contact**.
- **Delivery address**.
- **Contact details**.
- **Supplier**.
- **Supplier contact**.
- **Prepared by**.
- **General remarks**.

The app prefills available project, customer, and supplier snapshot data. A new receipt number normally starts in a `GR-YYYYMMDD` pattern. It follows the date until you manually edit the receipt number.

### 25.4 Select lines

The selection toolbar provides:

- **Included only**: show only selected lines.
- **Level 1**: select eligible positive-quantity top-level lines.
- **Level 2**: select second-level lines, or shallower leaf lines where no deeper line exists.
- **Detail items**: select leaf/detail rows.
- **Clear**: deselect all lines.

Use the Outline search to find an item by number or description. Expand groups and select the required row checkbox.

Selecting a parent and its descendant at the same time would duplicate the same branch, so the app keeps selection mutually exclusive along that branch.

### 25.5 Edit received quantities and text

Each selected line provides:

- Received quantity, with the quoted quantity shown for reference.

- Unit.
- **Edit description and remarks** to reveal editable **Description** and **Remarks** fields.

Warnings and errors:

- Quantity `0`: warning.
- Quantity greater than quoted: warning.
- Negative quantity: error.
- No exportable selected lines: error.

Warnings allow output; errors disable print/export until corrected.

### 25.6 Preview and output

The right side is a live preview. Drag the divider between editor and preview to resize it; when focused, Left/Right arrow keys adjust it.

The document can include:

- English and Chinese goods-receipt heading.
- Supplier and receiver details.
- Item table and remarks.
- Total quantity when all selected lines use the same unit.
- Prepared/received signature areas.

Desktop: click **Export PDF**.

Web: click **Print GR**, then choose a printer or **Save as PDF**.

The output file name is based on the GR number. Click **Cancel** or close the dialog to leave without output.

## 26. Line-item import and CSV export

CSV and XLSX imports are for bulk line-item data only. They do not contain the complete quotation setup, parties, branding, document template, extra charges, or reusable library.

### 26.1 Important: confirmed import replaces the current rows

Choosing a CSV or Excel file only validates it and opens a preview. It does not change or save the quotation. The rows are replaced only after you click **Confirm Import**. Line-item import does not merge rows.

- Existing line items are removed.
- Existing section headers are removed. CSV and XLSX imports cannot create section headers.
- Quotation information, parties, branding, tax-class definitions/rates, extra charges, and document template stay in the quotation. If imported leaves use multiple tax classes, the app switches the quotation to **Mixed** tax mode.
- Tax classes named in the imported file must already exist in the current quotation.
- A cost currency missing from the current FX table is added with the app's reference/default rate. Review the FX table after import.
- Any error disables **Confirm Import** and leaves the quotation unchanged.
- Warnings do not block confirmation. Read them before confirming because they explain every ignored, defaulted, or non-pricing value.
- Closing the dialog or canceling a pending import leaves the quotation unchanged.
- A confirmed import is one undoable editor action.

Save or download the quotation JSON before importing. Do not rely on CSV as a complete quotation backup.

### 26.2 Export the current line items

1. Click **More**.
2. Click **Export CSV** (file-export icon).
3. Save/download the file.

The exported file uses UTF-8 with a BOM for reliable Excel handling. It exports item rows in hierarchy order. Section headers are omitted.

### 26.3 Download a template

The app provides two different templates:

- **Download CSV Template** gives you the existing blank CSV with the canonical headers.
- **Download Excel Template** gives you the canonical bilingual workbook with instructions, examples, formatting, and input checks. The app imports this `.xlsx` file directly.

To download the CSV template:

1. Click **More**.
2. Click **Export CSV Template**.

To use the Excel template:

1. Click **More** > **Import line items**.
2. Click **Download Excel Template**.
3. Read **Instructions 使用说明** and review **Examples 示例**.
4. Enter your own rows only on **Import Data**. Do not rename its English headers.
5. Save the workbook as `.xlsx` without renaming **Import Data** or changing its row-one headers.
6. Return to **Import line items**, click **Choose Excel**, and select the saved workbook.

The Excel workbook is bilingual in one file. Its input sheet keeps exact English headers because XLSX import requires the canonical names and order. Examples are on a separate sheet so they cannot be imported by accident. The workbook has no macros, formulas, or external links.

The downloaded template uses these 10 canonical headers:

```text
item_code,item_name,item_description,qty,qty_unit,manual_unit_price,unit_cost,cost_currency,tax_class,markup_override
```

For CSV import, columns may be in any order. Header matching trims spaces, ignores case, and treats spaces and hyphens like underscores. For example, `Manual Unit Price`, `manual-unit-price`, and `manual_unit_price` match the same column. Only `item_name` is a required CSV header; include the other columns needed by your row types.

For XLSX import, the sheet must be named exactly **Import Data**, and row one must contain all 10 canonical headers in the original order. Extra, missing, renamed, or reordered headers are rejected.

Unknown English or Chinese headers are ignored with a warning. Two headers that normalize to the same recognized name are an error. Do not put a title, comment, or blank row above the header. Header aliases are limited to the current and legacy English names described below.

### 26.4 What must be filled

The importer decides whether a leaf is **Final price** or **Cost + markup** from `manual_unit_price`:

- If `manual_unit_price` is filled, the leaf uses **Final price**.
- If `manual_unit_price` is blank, the leaf uses **Cost + markup**.

Use this checklist for the current template:

| Row type | Required to import | Recommended for a complete quotation | Leave blank unless needed |
|---|---|---|---|
| Any nonblank row | `item_name` | A valid `item_code`; `qty_unit` | `item_description`, `tax_class`, `markup_override` are optional |
| Parent/group row | `item_name` | Positive `qty` and a `qty_unit` | Price, cost, currency, and legacy pricing-basis values are ignored with warnings; group prices come from children |
| Cost-plus leaf | `qty`, `unit_cost`, `cost_currency` | Positive `qty`, positive `unit_cost`, and a valid unit | `manual_unit_price` must be blank |
| Final-price leaf | `qty`, `manual_unit_price` | Positive `qty`, positive `manual_unit_price`, and a valid unit | `unit_cost` and `cost_currency` are optional cost-analysis data |

`item_code` may be blank, but that row is always imported as a new root row with an automatically assigned code and a warning. A child row therefore needs an explicit child code such as `1.1`.

Leaf quantities and the required leaf price or cost must be greater than zero. Optional money values may be zero but not negative. Markup must be from 0% through 1000%.

### 26.5 Detailed column reference

| Column | Accepted value | Blank behavior | Important details |
|---|---|---|---|
| `item_code` | Text in numeric hierarchy form: `1`, `1.1`, or `1.1.1` | Assigns the next unused root code and reports a warning | Maximum three levels. Each segment must be a positive whole number without leading zeros. Codes must be unique. |
| `item_name` | Any text | Error on every nonblank row | Leading and trailing spaces are removed. |
| `item_description` | Any text | Empty description | Use CSV quoting if it contains commas, quotes, or line breaks. |
| `qty` | Plain number, for example `1`, `2.5`, or `100` | Group: defaults to `1`. Leaf: error | Do not include a unit, thousands separator, or currency symbol. Use a positive number. |
| `qty_unit` | Text such as `EA`, `set`, `hour`, `day`, or `lot` | Defaults to `EA` and reports a warning | The importer does not restrict the unit text. |
| `manual_unit_price` | Plain selling-price number greater than zero on a final-price leaf | Selects cost-plus pricing when no legacy `pricing_basis` is present | Any filled numeric value selects final-price pricing. If `unit_cost` is also filled, the manual price controls sales while the cost supports cost/profit analysis. |
| `unit_cost` | Plain cost number | Cost-plus leaf: error. Final-price leaf or group: allowed | For a final-price leaf, also fill `cost_currency` if the cost should be analyzed in a specific currency. Group cost is not used for group pricing. |
| `cost_currency` | Supported three-letter currency code such as `USD`, `EUR`, `CNY`, or `JPY` | Cost-plus leaf: error. A manual-price analysis cost defaults to the quotation currency with a warning | Matching is case-insensitive and the value is normalized to uppercase. This column does not set the FX rate. |
| `tax_class` | Existing tax-class ID or label | Uses the normal inherited/default tax class | Matching is case-insensitive. It does not create a tax class or import a tax rate. A group value can be inherited by its descendants. |
| `markup_override` | Percentage points from 0 to 1000, for example `15` or `15%` | Uses parent/global markup inheritance | `15` and `15%` both mean 15%. `0.15` means 0.15%, not 15%. A group value is inherited by descendants. A leaf value overrides the group/global value. It is retained but does not change a final-price leaf's selling price. |

For numbers, use plain decimal text with a period as the decimal separator. Currency symbols, thousands separators, hexadecimal, scientific notation, `NaN`, and infinity are rejected. For example, use `1200.50`, not `$1,200.50`, `1,200.50`, or `1.2e3`. A trailing `%` is accepted only for `markup_override`.

### 26.6 Hierarchy, row order, and numbering

- Valid codes include `1`, `2`, `1.1`, `1.2`, and `1.1.1`.
- Invalid codes include `0`, `01`, `1.0`, `-1`, `.1`, `A1`, and `1.1.1.1`.
- Every child must have its parent row. For `1.2.1`, rows `1` and `1.2` must exist.
- Parent rows may appear before or after their children in the file. The importer sorts rows numerically by `item_code`.
- The physical spreadsheet row order is not preserved when it conflicts with `item_code`.
- Codes describe hierarchy and sort order; they are not permanent item IDs. Gaps are compacted by the editor. For example, imported roots `1` and `5` are displayed and later exported as `1` and `2`.
- Duplicate codes are errors.
- A blank `item_code` cannot describe a child. It creates a new root row.

### 26.7 Blank, ignored, defaulted, and unsupported data

- Completely blank data rows are ignored.
- Leading and trailing spaces in cells are removed.
- Unknown named columns are ignored and reported as warnings.
- A nonblank cell beyond the header width is an error. Trailing blank cells are allowed.
- Comment rows and subtotal/title rows are not ignored. Any nonblank row must be a valid item row.
- Parent/group price, cost, currency, and legacy pricing-basis values are ignored and reported. Group markup and tax class remain valid inheritance values.
- Section headers are ignored during CSV export and cannot be represented on import.
- Empty and header-only files are rejected; CSV import is not a clearing command.
- Malformed CSV quoting is rejected.
- Line-item import does not import quotation number, dates, customer/sender, notes, terms, logo, document template, tax rates/classes, FX rates, or extra charges.

### 26.8 Example: group with cost-plus and final-price children

This example assumes blank tax cells should use the quotation's current default tax setup:

```csv
item_code,item_name,item_description,qty,qty_unit,manual_unit_price,unit_cost,cost_currency,tax_class,markup_override
1,Equipment package,Supply and commissioning,1,set,,,,,10
1.1,Pump,Pump and motor,2,EA,,1200,USD,,15
1.2,Commissioning,On-site work,3,day,500,,,,
```

- Row `1` is a group. Its 10% markup is available for cost-plus descendants that do not have their own override.
- Row `1.1` is a cost-plus leaf because `manual_unit_price` is blank. It overrides markup to 15%.
- Row `1.2` is a final-price leaf because `manual_unit_price` is `500`.

If a tax class is required, enter an existing class ID or label in `tax_class`, for example `Service 6%`. The import fails if that class does not already exist in the quotation.

### 26.9 Import the file and read the report

1. Save/download the current quotation JSON first.
2. Create any required tax classes and confirm the quotation currency.
3. Fill the CSV or Excel template.
4. Save CSV as **CSV UTF-8**, or keep the Excel template as `.xlsx`.
5. Click **More** > **Import line items** to open the guide.
6. Click **Choose CSV** or **Choose Excel**, then select the file.
7. Review the recognized and ignored columns, item count, errors, warnings, and defaults.
8. If validation succeeds, click **Confirm Import**. Selecting the file alone does not replace rows.
9. After confirmation, check the incomplete badge, FX rates, tax assignments, Calculation Sheet, and Preview.

The report uses the actual spreadsheet row number: the header is row 1 and the first item is row 2. It shows severity, row, column, and explanation.

Warnings allow confirmation:

- Blank `item_code` was assigned a root code.
- Blank `qty_unit` was changed to `EA`.
- An unknown column or group pricing value was ignored.
- A markup or legacy expected total was retained or ignored without affecting the selling price.

Errors prevent confirmation and replacement:

- Empty/header-only file, malformed quoting, missing `item_name`, or duplicate recognized headers.
- Invalid or duplicate item code.
- Missing parent or item name.
- Missing required leaf quantity, final unit price, unit cost, or cost currency.
- Invalid, non-positive, negative, or out-of-range numeric value.
- Conflicting manual/legacy price columns or an explicit legacy pricing basis that contradicts the price data.
- Unsupported currency or unknown tax class.

### 26.10 CSV quoting and Excel

- If a text cell contains a comma, quote, or line break, keep it properly CSV-quoted.
- Inside a quoted cell, write a literal quote as two quotes. Example: `"Valve, ""special"""`.
- Save as **CSV UTF-8** to preserve Chinese text.
- Excel may change item codes or numeric formats. Keep `item_code` as text if Excel tries to reformat it.
- Do not use thousands separators, currency symbols, scientific notation, or spreadsheet formulas in numeric cells. A trailing `%` is allowed only for markup.
- Do not use the Calculation Sheet's audit CSV as an import file. Its headers do not match the line-item importer.

### 26.11 Legacy CSV files

Older exported columns are accepted by name and may also be reordered. They include `pricing_basis`, `unit_price`, and `expected_total`.

- `pricing_basis` uses `cost_plus` or `manual_price`.
- `unit_price` is the old name for the direct/manual unit price. It may coexist with `manual_unit_price` only when the two values are equal.
- Without `pricing_basis`, a manual price selects final-price pricing; otherwise the row uses cost-plus pricing.
- With `pricing_basis`, contradictory price data is an error.
- `expected_total` is legacy comparison data. A leaf value does not control pricing and is reported when ignored.

For new files, use the current template rather than adding legacy columns.

## 27. Quotation JSON import and export

Quotation JSON is the complete portable quotation format. It includes:

- Header and parties snapshot.
- Items and hierarchy.
- Pricing and tax configuration.
- Exchange rates.
- Output detail and template.
- Branding/logo.

### Export

- Desktop: click **Save**, **More** > **Save As**, or **More** > **Export Quotation** as appropriate.
- Web: click **Download**.

### Import

1. Click **More** > **Import Quotation**.
2. Select the JSON file.

Import replaces the current working quotation. Invalid, malformed, or unsupported JSON is rejected and a status message explains the problem.

Do not manually edit quotation JSON unless you understand the data structure. Use CSV for bulk line-item edits and the UI for the rest.

## 28. Library backup and transfer

The reusable library contains:

- Company profiles.
- Customers.
- Quotation-numbering state.

It does not contain full quotation files.

### 28.1 Automatic local storage

Company profiles, customers, and numbering save automatically on the current device. The General-page file actions are for backup and transfer, not a requirement for every edit.

### 28.2 Save a backup

1. Click **Settings** > **General**.
2. Under **Backup and transfer**, click **Save backup as**.
3. Save `quotation-library.json` in a backed-up location.

After a backup file has been selected or saved, **Save backup** writes/downloads the current library using that file context. In browsers without direct file access, it may create another download.

### 28.3 Open a backup

1. Click **Open backup**.
2. Select a valid library JSON file.
3. Read the confirmation. It shows the number of company and customer records in the selected file.
4. Click **Replace** only if those records should replace the current local library.

This is replacement, not merge.

### 28.4 Create an empty library

1. Click **Create empty library**.
2. Read the warning.
3. Confirm **Create**.

This clears current company profiles, customers, and numbering state on the device. Back up first if the records may be needed.

Invalid library JSON, invalid profiles/customers, or invalid numbering data is rejected without replacing the current library.

## 29. Recommended end-to-end workflows

### 29.1 Create a detailed costed quotation

1. Create/select a company profile and customer.
2. Click **Editor** > **More** > **New**.
3. Complete **Quote info** and **Parties**.
4. Select **Detailed**.
5. Set quotation currency and FX rates.
6. Set global markup and tax mode.
7. Add items and children; enter positive quantity, unit, cost, and currency.
8. Add markup overrides only where needed.
9. Click the incomplete badge and correct every marked row.
10. Review Calculation Sheet and Analysis.
11. Open Preview and verify template, detail level, parties, tax columns, and totals.
12. Save/download JSON.
13. Export PDF or print to PDF.

### 29.2 Create a quick final-price quotation

1. Start a new quotation.
2. Complete quotation and party information.
3. Select **Quick**.
4. Add items.
5. Enter item name, positive quantity, unit, and unit price.
6. Configure tax and optional extra charges.
7. Preview, save/download, and output.

Remember that final-price rows reduce profit-analysis quality because their costs are not known.

### 29.3 Revise an existing quotation

1. Import the saved quotation JSON.
2. Increase **Revision**.
3. Update the date, validity, items, prices, and terms.
4. Use Calculation Sheet and Preview to compare the result.
5. Use **Save As** or download a new JSON file so the previous revision remains archived.
6. Export a new PDF.

### 29.4 Generate a goods receipt after approval

1. Open the approved quotation JSON.
2. Click **Generate GR**.
3. Enter PO/reference and delivery details.
4. Choose a selection preset, then adjust individual line checkboxes.
5. Enter received quantities and remarks.
6. Resolve errors and review warnings.
7. Check the live preview.
8. Export or print the goods receipt.

## 30. Troubleshooting

### Save/Download produced no file

- Check whether a file chooser opened behind the app.
- Check the browser Downloads list.
- Allow downloads for the site.
- Try **Save As** on desktop.

### Print did not open

- Allow pop-ups for the web app.
- Try again from the floating preview.
- Wait for the print document to finish loading before closing tabs.

### PDF shows the wrong item depth

Open **Details** > **Quote info** and change **Preview/PDF item detail**.

### Totals look wrong

Check, in this order:

1. Item quantity and unit.
2. Whether the row is a parent/group or a leaf.
3. Pricing basis.
4. Cost currency and FX rate.
5. Markup override versus inherited/global markup.
6. Tax mode and effective tax class.
7. Extra charges.
8. Calculation Steps for the affected item.
9. Full Calculation Sheet totals.

### Markup changed but a price did not

The row may use **Final price**, have its own markup override, or inherit from a nearer parent. Check **Calculation Steps** for the effective source.

### Cannot remove an FX currency

It is the quotation currency or is still used by a cost row. Change the affected rows first.

### Goal seek Apply is disabled

- Select at least one eligible row.
- Use cost-plus leaf rows with positive cost.
- Enter a valid positive target.
- For quotation goal seek, use a reachable subtotal.

### CSV import failed

Open **Import Report**. Fix every error, ensure the `item_name` header and all parent rows exist, remove duplicate recognized headers or extra cells, and save as CSV UTF-8. Column order does not matter.

### A sender/customer update did not appear in an old quotation

This is intentional snapshot behavior. Re-select the updated profile/customer in that quotation or edit the quotation fields directly.

### Goods receipt cannot export

Select at least one exportable line and remove negative quantities. Quantities above quoted values are warnings, not blocking errors.

### Analysis is blank

Return to **Editor**; quotation data is not lost. Restart or update the application and try again. In a development build, a blank Analysis screen usually means a chart component failed to load and should be reported as a software issue.

### Chinese text is corrupted

Use UTF-8 for CSV and JSON. In Excel, choose **CSV UTF-8**. Do not save project or data text as GBK/GB2312/CP936.

## 31. Limits and important behavior

- Item hierarchy is limited to three levels.
- Sections exist only at the root level and have no price.
- Quick/Detailed changes defaults for new items; it does not convert existing items.
- Deleting the final root row creates a new blank item.
- CSV import replaces line items; JSON import replaces the whole working quotation.
- Opening a library backup replaces the reusable library; it does not merge.
- Customer and company selections are copied snapshots, not live links.
- Extra charges are added after line tax and do not participate in item markup.
- Goal seek only changes eligible markup values.
- Output detail level hides rows from preview/PDF without deleting them or changing rollups.
- Final-price rows can make margin and cost coverage incomplete.
- Browser print/download behavior depends on browser permissions.
- Save quotation JSON files separately from the reusable-library backup. They serve different purposes.

Before sending a quotation, always check the customer-facing preview and save the quotation JSON used to create the final PDF.
