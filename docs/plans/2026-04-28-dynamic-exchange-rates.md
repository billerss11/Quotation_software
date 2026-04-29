# Dynamic Exchange Rates Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the fixed four-currency setup with a dynamic, user-managed per-quotation currency list, while keeping currency handling safe across calculations, import/export, draft normalization, and the quotation editor UI.

**Architecture:** Keep `CurrencyCode` widened to `string`, but stop treating arbitrary strings as valid currencies. Introduce one shared currency helper that normalizes uppercase 3-letter codes and only accepts codes the runtime can format safely. Derive active currencies from `exchangeRates` keys, make both cost-currency and quotation-currency selectors dynamic, and update every parser/normalizer boundary to use the same helper logic.

**Tech Stack:** TypeScript, Vue 3 `<script setup>`, PrimeVue, vue-i18n, Vitest

---

## Task 1 - Centralize Currency Validation And Option Helpers

**Files:**
- Create: `src/features/quotations/utils/currencyCodes.ts`
- Modify: `src/features/quotations/types.ts`
- Test: `src/features/quotations/utils/currencyCodes.test.ts`

**Step 1: Add one shared currency helper module**

Create `src/features/quotations/utils/currencyCodes.ts` and move currency-specific rules there instead of scattering them across components and parsers.

Include:
- `STANDARD_CURRENCY_CODES = ['USD', 'EUR', 'CNY', 'GBP']`
- `normalizeCurrencyCode(value: unknown): string | null`
- `isSupportedCurrencyCode(code: string): boolean`
- `parseCurrencyCode(value: unknown): string | null`
- `sortCurrencyCodes(codes: Iterable<string>, baseCurrency?: string): string[]`

Validation rule:
- Trim input
- Uppercase it
- Require exactly 3 ASCII letters
- Confirm the runtime accepts it by constructing `new Intl.NumberFormat('en-US', { style: 'currency', currency: code })` inside `try/catch`

This keeps the app aligned with `Intl.NumberFormat` and PrimeVue currency inputs instead of accepting arbitrary strings that would later break rendering.

**Step 2: Widen the currency types**

In `src/features/quotations/types.ts`, update:

```ts
export type CurrencyCode = string
export type ExchangeRateTable = Record<string, number>
```

Do not remove the `CurrencyCode` alias. Keep it as the semantic type used across the feature.

**Step 3: Add focused tests for the helper**

Cover:
- normalizing lowercase input like `jpy` to `JPY`
- rejecting blanks and non-3-letter input
- rejecting codes the runtime cannot format
- sorting with the base currency first and the rest alphabetically

**Step 4: Run the new focused test**

```powershell
npm test -- currencyCodes
```

Expected: the helper behavior is pinned down before the rest of the plan starts depending on it.

---

## Task 2 - Rewrite `exchangeRates.ts` For Dynamic Keys

**Files:**
- Modify: `src/features/quotations/utils/exchangeRates.ts`
- Modify: `src/features/quotations/utils/exchangeRates.test.ts`

**Step 1: Keep standard defaults, but stop hardcoding the active key set**

Use `STANDARD_CURRENCY_CODES` from the new helper for default seeding only. Remove the current hardcoded `currencies` loop that defines the whole table shape.

Expand `referenceExchangeRates` with a few common starter currencies, for example:

```ts
const referenceExchangeRates: Record<string, number> = {
  USD: 1,
  EUR: 1.08,
  CNY: 0.14,
  GBP: 1.25,
  JPY: 0.0067,
  AUD: 0.64,
  HKD: 0.128,
  SGD: 0.74,
  KRW: 0.00073,
}
```

The reference table is only a seed/fallback source. The active table still comes from `exchangeRates` keys.

**Step 2: Update `createExchangeRates`**

`createExchangeRates(baseCurrency)` should:
- seed the standard currencies
- ensure `baseCurrency` exists even if it is not in the standard list
- return a fully rebased table where `baseCurrency` is `1`

**Step 3: Update `normalizeExchangeRates`**

New behavior:
- if input is missing or empty, seed from `createExchangeRates(baseCurrency)`
- if input exists, preserve its keys instead of forcing exactly four currencies
- clamp valid positive rates
- fall back invalid entries to a reference-derived value
- always force `result[baseCurrency] = 1`

**Step 4: Update rebase logic**

`rebaseExchangeRates()` and the private conversion helper should work from `Object.keys(source)`.

If `nextBaseCurrency` is not already present, inject it using the reference lookup before rebasing.

**Step 5: Add add/remove helpers with invariants**

Add:
- `addCurrencyToRateTable(table, currency, baseCurrency)`
- `removeCurrencyFromRateTable(table, currency, baseCurrency)`

Removal rule:
- never remove the base currency from the utility layer

**Step 6: Expand tests**

Update `exchangeRates.test.ts` to cover:
- default seeding still returns the standard starter set
- normalizing a sparse dynamic table preserves only the provided keys plus the base
- rebasing into a currency that was not previously in the table
- adding a new currency
- no-op add for duplicates
- no-op remove for the base currency

**Step 7: Run the focused test**

```powershell
npm test -- exchangeRates
```

---

## Task 3 - Update Draft, File, And CSV Boundaries To Use The Shared Currency Rules

**Files:**
- Modify: `src/features/quotations/utils/quotationDraft.ts`
- Modify: `src/features/quotations/utils/quotationFile.ts`
- Modify: `src/features/quotations/utils/quotationItems.ts`
- Modify: `src/features/quotations/utils/lineItemsCsv.ts`
- Modify: `src/shared/i18n/messages.ts`
- Test: `src/features/quotations/utils/quotationFile.test.ts`
- Test: `src/features/quotations/utils/lineItemsCsv.test.ts`

**Step 1: Normalize quotation header currency through the helper**

In `quotationDraft.ts`:
- normalize `quotation.header.currency` through `parseCurrencyCode`
- fall back to `'USD'` if the incoming header currency is invalid
- then normalize exchange rates against that header currency

This prevents imported or stored drafts from carrying an unusable base currency.

**Step 2: Replace the fixed four-currency file check**

In `quotationFile.ts`, replace the current hardcoded `isSupportedCurrency()` logic with `parseCurrencyCode()` or `isSupportedCurrencyCode()`.

Imported JSON should accept any valid runtime-supported 3-letter currency code, not just four hardcoded ones.

**Step 3: Preserve dynamic item currencies during normalization**

In `quotationItems.ts`, replace the current fixed parser with the shared helper so imported line items keep currencies like `JPY` instead of silently collapsing back to the fallback currency.

**Step 4: Update CSV parsing**

In `lineItemsCsv.ts`:
- use the shared helper in `parseCurrencyCell`
- keep the existing validation flow, but stop hardcoding the four accepted values

Update the i18n copy for CSV errors so it no longer says `USD, EUR, CNY, or GBP` only. The wording should match the new validation rule, for example "a valid 3-letter currency code supported by the app."

**Step 5: Expand tests**

Add or update tests for:
- parsing a quotation file whose header currency is `JPY`
- normalizing quotation items with dynamic cost currencies
- parsing CSV with a supported non-default currency
- still rejecting invalid currency values

**Step 6: Run focused tests**

```powershell
npm test -- quotationFile
npm test -- lineItemsCsv
```

---

## Task 4 - Add Dynamic Exchange Rate Actions To `useQuotationEditor`

**Files:**
- Modify: `src/features/quotations/composables/useQuotationEditor.ts`
- Test: `src/features/quotations/composables/useQuotationEditor.test.ts`

**Step 1: Import the new helpers**

Add:
- `addCurrencyToRateTable`
- `removeCurrencyFromRateTable`
- `parseCurrencyCode`

**Step 2: Add recursive currency usage detection**

Replace the shallow one-level idea from the old plan with a recursive helper that walks all descendants in `QuotationItem[]`.

The app supports nested children, so removal checks must also support nested children.

**Step 3: Add guarded actions**

Expose:

```ts
addExchangeRate(currency: string): 'added' | 'exists' | 'invalid'
removeExchangeRate(currency: string): 'removed' | 'in_use' | 'base_currency'
```

Behavior:
- `addExchangeRate` validates and normalizes the input before touching state
- `removeExchangeRate` blocks removal when the currency is in use by any line item
- `removeExchangeRate` also blocks base-currency removal

**Step 4: Keep rebase behavior safe**

Retain the currency watch, but make sure it still works when the next base currency was user-added instead of being part of the original four-currency set.

The watch should never leave the base currency missing from `exchangeRates`.

**Step 5: Add composable tests**

Cover:
- adding `JPY`
- trying to add invalid input
- removing a currency that is unused
- failing to remove a currency that is in use
- failing to remove the quotation base currency
- switching quotation currency to a dynamically-added code and rebasing successfully

**Step 6: Run the focused test**

```powershell
npm test -- useQuotationEditor
```

---

## Task 5 - Make Quotation And Cost Currency Selectors Dynamic

**Files:**
- Modify: `src/features/quotations/components/QuotationEditor.vue`
- Modify: `src/features/quotations/components/LineItemsTable.vue`
- Modify: `src/features/quotations/components/QuotationCommandBar.vue`
- Modify: `src/features/quotations/components/QuoteSetupPanel.vue`

**Step 1: Derive active currencies once in the editor**

In `QuotationEditor.vue`, create a computed list from `quotation.exchangeRates`:

```ts
const activeCurrencies = computed(() =>
  sortCurrencyCodes(Object.keys(quotation.value.exchangeRates), quotation.value.header.currency),
)
```

This becomes the single source of truth for selector options.

**Step 2: Pass dynamic options to child components**

Update child component contracts so they accept currency options as props instead of calling `getCurrencyOptions()` internally.

Required props:
- `QuotationCommandBar.vue`: `quotationCurrencyOptions: string[]`
- `QuoteSetupPanel.vue`: `quotationCurrencyOptions: string[]`
- `LineItemsTable.vue`: `costCurrencyOptions: string[]`

**Step 3: Remove static selector dependencies**

Remove the local `getCurrencyOptions()` usage from those components and replace it with the new props everywhere the selectors render.

This makes:
- line item cost currency options dynamic
- both quotation-currency selectors dynamic

**Step 4: Keep selector behavior consistent**

When a user adds `JPY` in the rates panel, it should immediately appear in:
- the line item cost currency dropdown
- the command bar quotation currency dropdown
- the quote setup panel quotation currency dropdown

**Step 5: Run typecheck**

```powershell
npm run typecheck
```

---

## Task 6 - Rewrite `ExchangeRatePanel.vue` As A Dynamic Vertical List

**Files:**
- Modify: `src/features/quotations/components/ExchangeRatePanel.vue`

**Step 1: Update props and emits**

Use:

```ts
const props = defineProps<{
  exchangeRates: ExchangeRateTable
  quotationCurrency: string
}>()

const emit = defineEmits<{
  updateRate: [currency: string, rate: number]
  addCurrency: [currency: string]
  removeCurrency: [currency: string]
}>()
```

**Step 2: Derive rows from the current table**

Replace the static currency array with a computed list built from `Object.keys(props.exchangeRates)` and sorted with the base currency first.

**Step 3: Add local add-currency input state**

Use local state for:
- whether the add row is open
- the pending input value

Normalize to uppercase on submit before emitting.

The panel should not accept the old `code.length >= 2` rule. It should use the shared parser to avoid submitting obviously invalid input.

**Step 4: Replace the grid template with a vertical list**

The new template should:
- show one row per active currency
- keep the base currency locked at rate `1`
- show a remove control only for non-base currencies
- keep the layout compact and readable on desktop-width inspector panels

**Step 5: Update styles**

Remove the old two-column `.rate-grid` layout and replace it with a single-column list of rows plus an inline add row.

**Step 6: Run typecheck**

```powershell
npm run typecheck
```

---

## Task 7 - Wire User Feedback And Translation Keys

**Files:**
- Modify: `src/App.vue`
- Modify: `src/features/quotations/components/QuotationEditor.vue`
- Modify: `src/shared/i18n/messages.ts`

**Step 1: Add missing exchange-rate UI copy**

Extend `quotations.exchangeRates` in both locales with keys for:
- `addCurrency`
- `addPlaceholder`
- `confirmAdd`
- `cancelAdd`
- `baseBadge`
- `removeAria`
- `invalidCurrency`
- `duplicateCurrency`
- `baseCurrencyLocked`
- `currencyInUse`

Keep the English and Simplified Chinese copies aligned with the app’s existing tone.

**Step 2: Render a toast host once**

The app already installs `ToastService`, but there is no visible `<Toast />` host. Add one in `App.vue` so feature-level feedback can actually render.

**Step 3: Surface add/remove results from the editor**

In `QuotationEditor.vue`:
- destructure `addExchangeRate` and `removeExchangeRate`
- use `useToast()` to show warnings/info for invalid input, duplicate add, base-currency removal, and in-use removal
- wire the new `@add-currency` and `@remove-currency` events from `ExchangeRatePanel`

This keeps feedback close to the user action without adding new global state.

**Step 4: Run typecheck**

```powershell
npm run typecheck
```

---

## Task 8 - Final Verification

**Step 1: Run targeted tests for the changed areas**

```powershell
npm test -- currencyCodes
npm test -- exchangeRates
npm test -- quotationFile
npm test -- lineItemsCsv
npm test -- useQuotationEditor
```

**Step 2: Run the project typecheck**

```powershell
npm run typecheck
```

**Step 3: Run the full test suite if the targeted suite is clean**

```powershell
npm test
```

**Step 4: Manual smoke check**

- Open the quotation editor and confirm the rates panel still starts with the standard seeded currencies.
- Add `JPY` and confirm it appears in the rates list.
- Confirm `JPY` also appears in both quotation-currency selectors and the line item cost-currency selectors.
- Change the quotation currency to `JPY` and confirm the rate table rebases with `JPY = 1`.
- Remove an unused non-base currency and confirm it disappears from all selectors.
- Assign a currency like `GBP` to a nested child line item, then try to remove it and confirm the removal is blocked.
- Import a JSON quotation whose header currency is `JPY` and confirm it loads successfully.
- Import CSV with a supported non-default cost currency and confirm the rows keep that currency.
