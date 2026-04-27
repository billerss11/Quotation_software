# Quotation App Requirements v1

## 1. Project Overview

A Windows-first desktop quotation application built with JS + Electron.

The software should help users generate quotations quickly using a fixed, well-designed template. It should support structured line items, customer details, company branding, and flexible quotation fields.

## 2. Goals

* Keep quotation output in a consistent format
* Make data entry fast
* Support branded quotations with company logo
* Support hierarchical pricing items
* Allow future expansion without changing the core structure

## 3. Target Platform

* Primary platform: Windows
* Secondary platform: optional later
* Desktop application, local-first

## 4. Core Users

* Staff preparing quotations frequently
* Users who need fast repeatable quotation generation
* Users who want a professional-looking PDF or print output

## 5. Core Functional Requirements

### 5.1 Quotation Header Fields

The system should allow users to enter and save quotation-level information, including:

* Quotation number
* Quotation date
* Customer company
* Contact person
* Contact details
* Project name
* Validity period
* Currency
* Notes / remarks

### 5.2 Branding

The system should allow users to:

* Upload company logo
* Store logo for reuse
* Show logo in quotation output
* Optionally support multiple logo presets later

### 5.3 Line Items

The system should allow users to:

* Add major items
* Add sub-items under a major item
* Reorder items
* Delete items
* Duplicate items
* Enter description, quantity, unit cost, cost currency, markup, calculated selling price, amount, notes

### 5.4 Item Structure

The system should support a hierarchy like:

* Major item

  * Sub-item A
  * Sub-item B

The system should support subtotal calculation at the major-item level.

The system should support up to three item levels:

* Major item / section
  * Sub-item / group or priced line
    * Detail line / priced component

Group rows with children should display calculated roll-up amounts on the parent row. Extra subtotal rows should not be shown in the quotation output.

### 5.5 Pricing

The system should support:

* Unit cost input
* Cost currency selection per line item
* Quantity input
* Automatic selling-price calculation
* Automatic amount calculation based on selling price
* Subtotal calculation
* Overall total
* Markup setting
* Customer-facing quotation currency selection
* Manual exchange-rate management

### 5.6 Output

The system should support:

* On-screen quotation preview
* PDF export
* Print-ready layout
* Consistent fixed template output

## 6. Non-Functional Requirements

* Fast startup
* Simple UI
* Easy keyboard-based entry
* Clean modern design
* Stable on Windows
* Local data storage

## 7. Initial UI Modules

* Dashboard / recent quotations
* Quotation editor
* Template preview
* Settings

## 8. Confirmed Product Decisions

* Markup: global by default, with the ability to override per item
* Sub-items: roll up automatically into the parent item
* Subtotal lines: users cannot edit them manually
* Discounts: supported in quotation output
* Quotation numbering: automatic
* Company profile: one company profile only
* Customer/contact history: saved for reuse

## 9. Data to Be Discussed Later

* Parent item display behavior
* Revision history
* User roles / permissions
* Cloud sync or local only

## 10. Suggested First MVP Scope

The first version should include:

* One fixed quotation template
* Header fields
* Logo upload
* Major items and sub-items
* Automatic totals
* Currency field
* PDF export
* Local save/load

## 11. Confirmed Detailed Decisions

* Discount: support both percentage and fixed amount
* Markup order: markup is applied before discount
* Quotation numbering format: automatic and includes year, for example `Q-2026-001`
* Customer management: full customer management page
* Tax fields: supported in quotation output, including VAT-style fields
* Branding: logo placement and quotation colors should be lightly customizable

## 12. Parent Item Display Behavior

* Parent items can have their own title, description, and notes
* Sub-items sit under the parent item
* Detail lines can sit under sub-items
* Sub-items roll up automatically into the parent subtotal
* Detail lines roll up automatically into the sub-item amount
* Parent subtotal is system-calculated and cannot be edited manually
* Quotation output should show parent/group amounts on the parent row instead of separate subtotal rows

Example structure:

* 1. Surface Equipment Supply

  * parent description / notes
  * 1.1 Valve set
  * 1.2 Fittings
  * automatic subtotal

## 13. Expanded Scope Beyond MVP

The product is now moving beyond the first MVP. The application should support file-backed workflows, reusable customer data, and stronger pricing controls while keeping fast line-item entry as the primary workflow.

### 13.1 File Import / Export

The system should allow users to:

* Save the current quotation to a JSON file
* Use Save As to choose a new quotation file path
* Save with `Ctrl+S`
* Import a quotation from a JSON file
* Export the current quotation as JSON
* Preserve quotation data, line items, exchange rates, totals configuration, and branding in exported JSON

### 13.2 Customer Reuse

The system should allow users to:

* Build reusable customer records from saved quotations
* View saved customers while editing a quotation
* Click a customer record to import customer company, contact person, and contact details
* Maintain a customer management page that reflects saved customer history

### 13.3 Multi-Currency Costing

The system should allow users to:

* Enter item cost in different currencies inside one quotation
* Set the cost currency per major item or sub-item
* Manage exchange rates manually per quotation
* Convert costs into the quotation currency before markup
* Show customer-facing selling prices only in the quotation output

### 13.4 Editor Workflow

The quotation editor should prioritize fast line-item entry:

* The line-item workbench is the primary screen area
* Header fields, totals, exchange rates, and preview live in supporting inspector panels
* Common actions such as save, save as, import, export, print, and logo upload stay available in a compact command bar
