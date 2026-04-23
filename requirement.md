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
* Customer name
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
* Enter description, quantity, unit price, amount, notes

### 5.4 Item Structure

The system should support a hierarchy like:

* Major item

  * Sub-item A
  * Sub-item B

The system should support subtotal calculation at the major-item level.

### 5.5 Pricing

The system should support:

* Unit price input
* Quantity input
* Automatic amount calculation
* Subtotal calculation
* Overall total
* Markup setting
* Currency selection

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
* Sub-items roll up automatically into the parent subtotal
* Parent subtotal is system-calculated and cannot be edited manually

Example structure:

* 1. Surface Equipment Supply

  * parent description / notes
  * 1.1 Valve set
  * 1.2 Fittings
  * automatic subtotal
