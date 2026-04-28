# Dynamic Exchange Rates Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the fixed four-currency rate table with a dynamic, user-managed list where any ISO currency code can be added or removed, and redesign the Exchange Rate panel UI from an awkward 2-column grid to a clean vertical list.

**Architecture:** `CurrencyCode` becomes `string`; `ExchangeRateTable` becomes `Record<string, number>` with the active currency set derived from its keys. A new `addCurrencyToRateTable` / `removeCurrencyFromRateTable` utility pair manages the key set, and `normalizeExchangeRates` is updated to preserve arbitrary keys rather than enforce exactly four. The panel UI is rewritten as a vertical list of rows with inline add/remove controls.

**Tech Stack:** TypeScript, Vue 3 `<script setup>`, Vitest, PrimeVue InputText / InputNumber / Button, vue-i18n

---

## Task 1 — Widen the CurrencyCode type and ExchangeRateTable

**Files:**
- Modify: `src/features/quotations/types.ts`

**Step 1: Read the file**

Open `src/features/quotations/types.ts` and confirm the current definitions.

**Step 2: Apply the type changes**

Replace:
```typescript
export type CurrencyCode = 'USD' | 'EUR' | 'CNY' | 'GBP'
export type ExchangeRateTable = Record<CurrencyCode, number>
```
With:
```typescript
export type CurrencyCode = string
export type ExchangeRateTable = Record<string, number>
```

`QuotationHeader.currency`, `PricingLine.costCurrency`, and every function that accepts `CurrencyCode` continue to work — `string` is a wider type, nothing narrows on it.

**Step 3: Run typecheck to expose any breakage early**

```powershell
npm run typecheck
```

Expected: passes or shows only issues in files that the later tasks will fix. Note every error file so subsequent tasks can target them. Fix nothing here — just record.

---

## Task 2 — Rewrite `exchangeRates.ts` for dynamic keys

**Files:**
- Modify: `src/features/quotations/utils/exchangeRates.ts`

**Context:** The file today iterates over a hardcoded `currencies: CurrencyCode[]` array. All three functions (`createExchangeRates`, `normalizeExchangeRates`, `rebaseExchangeRates`) must switch to `Object.keys()` so they work with any set of currency codes.

**Step 1: Expand `referenceExchangeRates`**

Add several more common currencies so rebasing and default seeding work for them:
```typescript
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

**Step 2: Remove the hardcoded `currencies` array entirely**

Delete:
```typescript
const currencies: CurrencyCode[] = ['USD', 'EUR', 'CNY', 'GBP']
```

**Step 3: Rewrite `normalizeExchangeRates`**

Old behavior: merges input into a fresh four-key defaults object.  
New behavior: preserves exactly the keys present in the input (plus guarantees the base currency key exists at 1).

```typescript
export function normalizeExchangeRates(
  exchangeRates: Record<string, number> | undefined,
  baseCurrency: string,
): ExchangeRateTable {
  // If input is missing or empty, seed the four standard currencies.
  const source = exchangeRates && Object.keys(exchangeRates).length > 0
    ? exchangeRates
    : createExchangeRates(baseCurrency)

  const result: ExchangeRateTable = {}

  for (const currency of Object.keys(source)) {
    const rate = source[currency]
    if (typeof rate === 'number' && Number.isFinite(rate) && rate > 0) {
      result[currency] = clampNumber(rate, MIN_EXCHANGE_RATE, MAX_EXCHANGE_RATE)
    } else {
      // Invalid rate for this currency: fall back to reference or 1.
      result[currency] = lookupReferenceRate(currency, baseCurrency)
    }
  }

  result[baseCurrency] = 1
  return result
}
```

Add the private helper:
```typescript
function lookupReferenceRate(currency: string, baseCurrency: string): number {
  const fromUsd = referenceExchangeRates[currency] ?? 1
  const baseToUsd = referenceExchangeRates[baseCurrency] ?? 1
  return roundRate(fromUsd / baseToUsd)
}
```

**Step 4: Rewrite `rebaseExchangeRates` and `convertRateTable`**

Replace the hardcoded `for (const currency of currencies)` loop in `convertRateTable` with:
```typescript
function convertRateTable(
  exchangeRates: ExchangeRateTable,
  nextBaseCurrency: string,
): ExchangeRateTable {
  // If the target base is not in the table, add it via reference before rebasing.
  const source = nextBaseCurrency in exchangeRates
    ? exchangeRates
    : { ...exchangeRates, [nextBaseCurrency]: lookupReferenceRate(nextBaseCurrency, findCurrentBase(exchangeRates)) }

  const denominator = source[nextBaseCurrency]
  const result: ExchangeRateTable = {}

  for (const currency of Object.keys(source)) {
    result[currency] = currency === nextBaseCurrency
      ? 1
      : roundRate(source[currency] / denominator)
  }

  return result
}

function findCurrentBase(table: ExchangeRateTable): string {
  return Object.keys(table).find((k) => table[k] === 1) ?? 'USD'
}
```

Update `rebaseExchangeRates` signature:
```typescript
export function rebaseExchangeRates(
  exchangeRates: Record<string, number> | undefined,
  currentBaseCurrency: string,
  nextBaseCurrency: string,
): ExchangeRateTable {
  return convertRateTable(normalizeExchangeRates(exchangeRates, currentBaseCurrency), nextBaseCurrency)
}
```

**Step 5: Add two new exported helpers**

```typescript
export function addCurrencyToRateTable(
  table: ExchangeRateTable,
  currency: string,
  baseCurrency: string,
): ExchangeRateTable {
  if (currency in table) return table
  return {
    ...table,
    [currency]: lookupReferenceRate(currency, baseCurrency),
  }
}

export function removeCurrencyFromRateTable(
  table: ExchangeRateTable,
  currency: string,
): ExchangeRateTable {
  const next = { ...table }
  delete next[currency]
  return next
}
```

**Step 6: Run typecheck**

```powershell
npm run typecheck
```

Expected: no new errors in this file.

---

## Task 3 — Update `exchangeRates.test.ts`

**Files:**
- Modify: `src/features/quotations/utils/exchangeRates.test.ts`

**Step 1: Update existing tests that assumed exactly four keys**

Tests that check `rates.USD`, `rates.EUR`, etc. still work — the keys still exist. Tests that assert the shape has exactly four keys need to be loosened or removed.

The `normalizeExchangeRates` tests that pass `{ CNY: 0.15 }` as input will now behave differently: the new implementation only preserves keys in the input, so a single-key input produces a single-key output (plus the base). Update these:

```typescript
it('accepts a custom CNY rate and preserves it alongside the base currency', () => {
  // Input has only CNY; base is USD → result has CNY + USD.
  const rates = normalizeExchangeRates({ CNY: 0.15 }, 'USD')
  expect(rates.CNY).toBe(0.15)
  expect(rates.USD).toBe(1)
  expect(Object.keys(rates)).toHaveLength(2)
})

it('returns a four-key table when input is undefined (seeds defaults)', () => {
  const rates = normalizeExchangeRates(undefined, 'USD')
  expect(rates.USD).toBe(1)
  expect(rates.EUR).toBeCloseTo(1.08)
  expect(rates.CNY).toBeCloseTo(0.14)
  expect(rates.GBP).toBeCloseTo(1.25)
})
```

**Step 2: Add tests for the two new helpers**

```typescript
import {
  addCurrencyToRateTable,
  createExchangeRates,
  normalizeExchangeRates,
  rebaseExchangeRates,
  removeCurrencyFromRateTable,
} from './exchangeRates'

describe('addCurrencyToRateTable', () => {
  it('adds a new currency with a reference-based default rate', () => {
    const table = createExchangeRates('USD')
    const next = addCurrencyToRateTable(table, 'JPY', 'USD')
    expect(next.JPY).toBeGreaterThan(0)
    expect(next.USD).toBe(1)
  })

  it('does not overwrite an existing currency', () => {
    const table = { USD: 1, CNY: 0.15 }
    const next = addCurrencyToRateTable(table, 'CNY', 'USD')
    expect(next.CNY).toBe(0.15)
  })
})

describe('removeCurrencyFromRateTable', () => {
  it('removes the specified currency', () => {
    const table = { USD: 1, CNY: 0.14, EUR: 1.08 }
    const next = removeCurrencyFromRateTable(table, 'CNY')
    expect('CNY' in next).toBe(false)
    expect(next.USD).toBe(1)
    expect(next.EUR).toBeCloseTo(1.08)
  })

  it('returns the same table when the currency does not exist', () => {
    const table = { USD: 1, EUR: 1.08 }
    const next = removeCurrencyFromRateTable(table, 'GBP')
    expect(Object.keys(next)).toHaveLength(2)
  })
})
```

**Step 3: Add a test for rebase with an unknown target base**

```typescript
it('rebases into a currency not previously in the table using reference rates', () => {
  const table = { USD: 1, CNY: 0.14 }
  const rates = rebaseExchangeRates(table, 'USD', 'EUR')
  expect(rates.EUR).toBe(1)
  expect(rates.USD).toBeCloseTo(1 / 1.08, 4)
})
```

**Step 4: Run tests**

```powershell
npm test -- exchangeRates
```

Expected: all tests pass.

---

## Task 4 — Add i18n keys for the new panel UI

**Files:**
- Modify: `src/shared/i18n/messages.ts`

**Context:** The file has a nested structure. The `quotations.exchangeRates` key exists in both the `en-US` and `zh-CN` message objects. Find both blocks (around lines 190 and 550) and extend them.

**Step 1: Extend `en-US` block**

Find:
```typescript
    exchangeRates: {
      aria: 'Exchange rates',
      title: 'Exchange Rates',
      subtitle: '1 cost currency equals this amount in {currency}.',
      pair: '{source} to {target}',
    },
```

Replace with:
```typescript
    exchangeRates: {
      aria: 'Exchange rates',
      title: 'Exchange Rates',
      subtitle: '1 unit of each currency equals this many {currency}.',
      pair: '{source} → {currency}',
      addCurrency: 'Add currency',
      addPlaceholder: 'e.g. JPY',
      confirmAdd: 'Add',
      cancelAdd: 'Cancel',
      removeAria: 'Remove {currency} from rate table',
      currencyInUse: '{currency} is used by one or more line items and cannot be removed.',
    },
```

**Step 2: Extend the `zh-CN` block**

Find the matching `exchangeRates` block in the Chinese section and replace:
```typescript
    exchangeRates: {
      aria: '汇率',
      title: '汇率',
      subtitle: '每单位货币折合 {currency} 的金额。',
      pair: '{source} → {currency}',
      addCurrency: '添加货币',
      addPlaceholder: '例如 JPY',
      confirmAdd: '添加',
      cancelAdd: '取消',
      removeAria: '从汇率表中移除 {currency}',
      currencyInUse: '{currency} 已被一个或多个行项目使用，无法移除。',
    },
```

**Step 3: Run typecheck**

```powershell
npm run typecheck
```

Expected: no errors.

---

## Task 5 — Expose `addExchangeRate` and `removeExchangeRate` in `useQuotationEditor`

**Files:**
- Modify: `src/features/quotations/composables/useQuotationEditor.ts`

**Step 1: Import the two new helpers**

Add `addCurrencyToRateTable` and `removeCurrencyFromRateTable` to the import from `../utils/exchangeRates`.

**Step 2: Add a helper to find all cost currencies in use**

Add a private function below the composable:
```typescript
function collectCostCurrencies(items: QuotationItem[]): Set<string> {
  const used = new Set<string>()
  for (const item of items) {
    if (item.costCurrency) used.add(item.costCurrency)
    for (const child of item.children) {
      if (child.costCurrency) used.add(child.costCurrency)
    }
  }
  return used
}
```

**Step 3: Export two new actions from the composable return value**

Inside the `return { ... }` block, alongside `updateExchangeRate`, add:

```typescript
addExchangeRate: (currency: string) => {
  quotation.value.exchangeRates = addCurrencyToRateTable(
    quotation.value.exchangeRates,
    currency.trim().toUpperCase(),
    quotation.value.header.currency,
  )
},
removeExchangeRate: (currency: string) => {
  const inUse = collectCostCurrencies(quotation.value.majorItems)
  if (inUse.has(currency)) return false   // caller shows warning
  quotation.value.exchangeRates = removeCurrencyFromRateTable(
    quotation.value.exchangeRates,
    currency,
  )
  return true
},
```

Both actions return `boolean` — `addExchangeRate` always succeeds (idempotent), `removeExchangeRate` returns `false` when blocked.

**Step 4: Update `updateExchangeRate` signature**

Change the parameter type from `CurrencyCode` to `string` (same underlying type now, but explicit):
```typescript
updateExchangeRate: (currency: string, rate: number) => {
  quotation.value.exchangeRates[currency] = normalizeRate(rate)
},
```

**Step 5: Run typecheck**

```powershell
npm run typecheck
```

Expected: no errors.

---

## Task 6 — Rewrite `ExchangeRatePanel.vue`

**Files:**
- Modify: `src/features/quotations\components\ExchangeRatePanel.vue`

**Step 1: Update props and emits**

```typescript
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

**Step 2: Replace the local `currencies` array with a computed derived from the prop**

```typescript
const currencies = computed(() =>
  Object.keys(props.exchangeRates).sort((a, b) => {
    // Quotation currency always first, rest alphabetical.
    if (a === props.quotationCurrency) return -1
    if (b === props.quotationCurrency) return 1
    return a.localeCompare(b)
  }),
)
```

**Step 3: Add add-currency local state**

```typescript
const addingCurrency = ref(false)
const newCurrencyInput = ref('')

function confirmAdd() {
  const code = newCurrencyInput.value.trim().toUpperCase()
  if (code.length >= 2) emit('addCurrency', code)
  newCurrencyInput.value = ''
  addingCurrency.value = false
}

function cancelAdd() {
  newCurrencyInput.value = ''
  addingCurrency.value = false
}
```

**Step 4: Replace the template**

Remove the `.rate-grid` div. Replace with:

```html
<template>
  <section class="exchange-panel" :aria-label="t('quotations.exchangeRates.aria')">
    <div>
      <h2 class="section-title">{{ t('quotations.exchangeRates.title') }}</h2>
      <p class="section-subtitle">{{ t('quotations.exchangeRates.subtitle', { currency: quotationCurrency }) }}</p>
    </div>

    <div class="rate-list">
      <div v-for="currency in currencies" :key="currency" class="rate-row">
        <span class="currency-label">{{ currency }}</span>
        <span class="pair-label">{{ t('quotations.exchangeRates.pair', { source: currency, currency: quotationCurrency }) }}</span>
        <InputNumber
          class="rate-input"
          :model-value="exchangeRates[currency]"
          :min="0.000001"
          :max="1000000"
          :min-fraction-digits="2"
          :max-fraction-digits="6"
          :disabled="currency === quotationCurrency"
          @update:model-value="updateRate(currency, $event)"
        />
        <Button
          v-if="currency !== quotationCurrency"
          text
          severity="secondary"
          size="small"
          icon="pi pi-times"
          :aria-label="t('quotations.exchangeRates.removeAria', { currency })"
          @click="emit('removeCurrency', currency)"
        />
        <span v-else class="base-badge">{{ t('quotations.exchangeRates.baseBadge') }}</span>
      </div>
    </div>

    <div v-if="addingCurrency" class="add-row">
      <InputText
        v-model="newCurrencyInput"
        :placeholder="t('quotations.exchangeRates.addPlaceholder')"
        class="add-input"
        @keyup.enter="confirmAdd"
        @keyup.escape="cancelAdd"
      />
      <Button size="small" :label="t('quotations.exchangeRates.confirmAdd')" @click="confirmAdd" />
      <Button size="small" text severity="secondary" :label="t('quotations.exchangeRates.cancelAdd')" @click="cancelAdd" />
    </div>

    <Button
      v-if="!addingCurrency"
      text
      size="small"
      icon="pi pi-plus"
      :label="t('quotations.exchangeRates.addCurrency')"
      @click="addingCurrency = true"
    />
  </section>
</template>
```

> **Note:** The `baseBadge` key needs adding to i18n as `'Base'` / `'基准'`. Add it to Task 4 if forgotten.

**Step 5: Replace styles**

Remove `.rate-grid` and `.rate-field`. Add:

```css
.rate-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rate-row {
  display: grid;
  grid-template-columns: 3rem 1fr auto auto;
  align-items: center;
  gap: 10px;
}

.currency-label {
  font-weight: 700;
  font-size: 13px;
  color: var(--text-strong);
}

.pair-label {
  font-size: 12px;
  color: var(--text-muted);
}

.rate-input {
  width: 100%;
}

.base-badge {
  font-size: 11px;
  color: var(--text-muted);
  padding: 2px 6px;
  border: 1px solid var(--surface-border);
  border-radius: 4px;
}

.add-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.add-input {
  width: 7rem;
}
```

**Step 6: Run typecheck**

```powershell
npm run typecheck
```

---

## Task 7 — Wire add/remove in `QuotationEditor.vue`

**Files:**
- Modify: `src/features/quotations/components/QuotationEditor.vue`

**Context:** The editor hosts the `<ExchangeRatePanel>` via the `<template #rates>` slot in `QuotationInspector`. Find the existing wiring.

**Step 1: Add event handlers alongside `updateExchangeRate`**

In the `<template #rates>` block, add the two new event bindings:

```html
<ExchangeRatePanel
  :exchange-rates="quotation.exchangeRates"
  :quotation-currency="quotation.header.currency"
  @update-rate="updateExchangeRate"
  @add-currency="addExchangeRate"
  @remove-currency="handleRemoveCurrency"
/>
```

**Step 2: Add `handleRemoveCurrency` to the script**

```typescript
function handleRemoveCurrency(currency: string) {
  const removed = removeExchangeRate(currency)
  if (!removed) {
    toast.add({
      severity: 'warn',
      summary: t('quotations.exchangeRates.currencyInUse', { currency }),
      life: 4000,
    })
  }
}
```

Destructure `addExchangeRate` and `removeExchangeRate` from `useQuotationEditor()`.

**Step 3: Run typecheck**

```powershell
npm run typecheck
```

---

## Task 8 — Update `LineItemsTable.vue` to accept dynamic cost currency options

**Files:**
- Modify: `src/features/quotations/components/LineItemsTable.vue`
- Modify: `src/features/quotations/components/QuotationEditor.vue`

**Context:** `LineItemsTable` currently reads `CURRENCY_OPTIONS` from the static `getCurrencyOptions()`. It should instead show the currencies that are actually in the rate table, because those are the ones that have a defined rate.

**Step 1: Add a prop to `LineItemsTable`**

```typescript
const props = defineProps<{
  // ... existing props ...
  costCurrencyOptions: string[]
}>()
```

Replace the local constant:
```typescript
// Remove this:
const CURRENCY_OPTIONS: CurrencyCode[] = getCurrencyOptions()
// Replace usages of CURRENCY_OPTIONS with props.costCurrencyOptions
```

**Step 2: Pass the prop from `QuotationEditor.vue`**

Wherever `<LineItemsTable>` is rendered, add:

```html
:cost-currency-options="Object.keys(quotation.exchangeRates)"
```

**Step 3: Run typecheck**

```powershell
npm run typecheck
```

---

## Task 9 — Final verification

**Step 1: Run all tests**

```powershell
npm test
```

Expected: all suites pass, including `exchangeRates.test.ts` and `useQuotationEditor.test.ts`.

**Step 2: Run typecheck one final time**

```powershell
npm run typecheck
```

Expected: zero errors.

**Step 3: Manual smoke check**

- Open the app, navigate to the Rates tab in the inspector.
- Confirm the vertical list renders with the 4 default currencies.
- Add `JPY` — confirm it appears with a sensible rate seeded from reference.
- Edit a line item — confirm `JPY` now appears in the cost currency dropdown.
- Switch the quotation currency to `EUR` — confirm rates rebase; `EUR` row shows 1 and is locked.
- Remove `GBP` — confirm it disappears from the list and from the line item dropdown.
- Assign `GBP` to a line item, then try to remove `GBP` — confirm the warning toast appears and the row stays.
