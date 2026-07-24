# Math Reference and Audit

Last audited: 2026-07-23

This document describes the business math currently implemented by the application. It covers quotation pricing, currency conversion, hierarchy rollups, markup, tax, totals, goal seek, analysis metrics, document values, calculation sheets, Chinese currency text, and goods-receipt quantities.

It intentionally excludes UI layout sizes, pagination, drag coordinates, array indexes, and other non-business arithmetic.

## Audit summary

The core quotation math is centralized in `quotationCalculations.ts` and has focused regression coverage. The confirmed tax, explanation, and goods-receipt findings from the 2026-07-23 audit are resolved.

| Status | Finding | Current behavior |
| --- | --- | --- |
| Resolved | Root-row tax previously used recursive per-leaf rounding. | Quotation tax buckets are authoritative. Their cents are allocated across root items, so root cards, previews, calculation sheets, CSV exports, and explanations reconcile to quotation totals. |
| Resolved | Calculation explanations previously used misleading rounded operands and prevented a displayed manual-price loss. | Explanations show raw calculation inputs with adequate precision, explicit rounding, negative manual markup, tax-bucket steps, and any root allocation adjustment. |
| Resolved | Goods-receipt child quantities previously ignored ancestor quantities. | Every receipt candidate uses its fully extended quotation quantity, rounded once to two decimals. |
| Intentional policy | Nested document and calculation-sheet rows show local subtree amounts, without ancestor quantity multipliers. | Hierarchical rows are explanatory and must not be added together. Only root rows reconcile to the quotation total. |
| Intentional policy | Manual-price revenue without stored cost is assigned zero markup/profit. | `base subtotal + markup` can be less than selling subtotal, and the analysis bridge can have an unexplained gap. Gross-margin reporting excludes this revenue from the denominator. |
| Unchanged limitation | Quantities, costs, and manual prices have no explicit upper bound in the calculation engine. | Extremely large inputs can exceed reliable JavaScript integer precision even though rates are bounded. |

### Confirmed tax-rounding example

Two rows each have a manual price of `0.05` and tax of `10%`.

- Quotation bucket method: `R((0.05 + 0.05) × 10%) = R(0.01) = 0.01`
- Exact root taxes are `0.005` and `0.005`.
- Both are initially floored to `0.00`.
- One remaining cent is assigned to the earlier root because the fractional remainders tie.

The root allocations are therefore `[0.01, 0.00]`, and their sum equals the quotation tax of `0.01`.

## Notation

The formulas below use:

| Symbol | Meaning |
| --- | --- |
| `R(x)` | Round money to 2 decimal places. Half cents round away from zero. Non-finite values become `0`. |
| `R4(x)` | Round a goal-seek markup rate to 4 decimal places after positive-number normalization. |
| `R6(x)` | Round a goal-seek converted cost to 6 decimal places after positive-number normalization. |
| `R10(x)` | Round an exchange rate to 10 decimal places. |
| `Q2(x)` | Round a non-negative goods-receipt quantity to 2 decimal places. |
| `P(x)` | Positive-number normalization: non-finite values and negative values become `0`. |
| `C(x, min, max)` | Clamp `x` to the inclusive range. A non-finite value becomes `min`. |
| `q` | Item quantity. |
| `c` | Unit cost in the cost currency. |
| `fx` | Quotation-currency amount for one unit of the cost currency. |
| `m` | Markup percentage points. `10` means `10%`, not `0.10`. |
| `t` | Tax percentage points. |
| `B(i)` | Base cost subtotal of item `i` in quotation currency. |
| `S(i)` | Selling subtotal before tax of item `i`. |
| `M(i)` | Markup amount of item `i`. |
| `T(i)` | Effective displayed tax for item `i`: allocated quotation tax for a root, or local bucket tax for a descendant. |

## Input normalization and limits

The calculation engine applies these rules:

| Value | Calculation rule |
| --- | --- |
| Quantity | `P(q)` |
| Unit cost | `P(c)` |
| Manual unit price | `P(price)`, then money rounding |
| Effective markup rate | `C(rate, 0, 1000)` |
| Tax rate | `C(rate, 0, 100)` |
| Exchange rate | Normalized tables clamp valid rates to `0.000001` through `1,000,000` |
| Extra charge | Negative and non-finite amounts become `0`; normalized drafts store cents |

There are two important differences between storage and calculation:

1. Draft normalization preserves finite negative quantities, costs, prices, expected totals, and markup rates. The calculation engine converts negative business inputs to zero where described below.
2. CSV/XLSX import is stricter: quantity must be greater than zero; unit cost, manual price, and expected total cannot be negative; markup must be from `0` through `1000`.

### New quotation defaults

A new quotation starts with:

| Value | Default |
| --- | --- |
| Quotation currency | `USD` |
| Item quantity | `1` |
| Item quantity unit | `EA` |
| Pricing method | cost-plus |
| Unit cost | `0` |
| Global markup | `10%` |
| Tax mode | single |
| Default tax rate | `0%` |
| Revision | `1` |

These are initial values, not hidden additions to later formulas.

### Saved-draft normalization

When a saved quotation is loaded:

| Stored value | Normalized value |
| --- | --- |
| Invalid quotation currency | `USD` |
| Missing/non-finite quantity | `1` |
| Missing/non-finite unit cost | `0` |
| Non-finite manual price, markup override, or expected total | unset |
| Invalid cost currency | parent cost currency, or quotation currency at the root |
| Missing/invalid pricing method with a finite manual price | manual-price |
| Missing/invalid pricing method without a finite manual price | cost-plus |
| Non-finite global markup | `0` |
| Invalid revision | `1` |
| Invalid extra charge | `0` |

Finite negative item values remain stored. Pricing later applies `P()` and rate clamping. Extra charges are different: they are immediately clamped to zero and rounded to cents during draft normalization.

### CSV/XLSX import numeric rules

CSV numeric cells accept an optional sign and ordinary decimal notation, including values such as `12`, `12.`, and `.5`. Exponential notation and thousands separators are not accepted.

The import rules are:

| Field | General rule | Leaf-specific rule |
| --- | --- | --- |
| Quantity | Must be greater than `0` when supplied | Required |
| Unit cost | Must be at least `0` | Required and greater than `0` for cost-plus |
| Manual/unit price | Must be at least `0` | Required and greater than `0` for manual-price |
| Markup override | `0` through `1000` percentage points | Ignored for manual-price |
| Expected total | Must be at least `0` | Ignored for leaves; retained for groups |

For group rows:

- missing quantity defaults to `1`;
- pricing basis, manual/unit price, unit cost, and cost currency are ignored;
- the stored group pricing method becomes cost-plus, unit cost becomes `0`, and cost currency becomes the quotation currency.

For a manual-price leaf with stored cost but no cost currency, the quotation currency is used. A cost-plus leaf must supply its cost currency.

CSV markup can be written as `15` or `15%`; both mean `15` percentage points. Excel percentage-formatted cells in the markup column are converted from Excel fractions:

```text
imported markup percentage points = cell value × 100
```

The scaled Excel value is reduced to 15 significant digits before it is converted to text for the common CSV parser. For example, an Excel value of `0.15` formatted as a percentage imports as markup `15`.

Import does not round accepted quantities, costs, prices, or expected totals. The pricing engine applies the documented rounding at calculation boundaries.

## Money rounding

`roundMoney()` implements decimal half-away-from-zero rounding to cents.

```text
R(1.005)  = 1.01
R(-1.005) = -1.01
```

Rounding happens at several business boundaries:

- unit markup;
- unit selling price;
- leaf line cost;
- leaf selling subtotal;
- every hierarchy rollup;
- each tax-bucket subtotal;
- each tax-bucket tax amount;
- quotation totals;
- unit values derived from totals.

Because rounding happens at each boundary, these are not always equivalent:

```text
R(quantity × R(unit amount))
R(quantity × raw unit amount)
R(total amount × rate)
sum(R(line amount × rate))
```

The application deliberately uses different versions for different purposes. The exact choices are documented below.

### Display formatting

Display formatting does not change stored or calculated values:

- currency values always display exactly 2 decimal places, including currencies that normally use 0 or 3;
- shared percentage displays divide percentage points by `100` for `Intl.NumberFormat` and show exactly 2 decimal places;
- editor/calculation-sheet quantities show no decimals for integers and 2 decimals for fractional values;
- calculation-sheet CSV quantities use up to 2 decimals and remove trailing zeroes.

The underlying value may therefore contain more precision than the text shown to the user.

## Exchange-rate math

### Stored rate meaning

Every stored exchange rate is:

```text
fx[currency] = quotation currency per 1 unit of cost currency
```

Therefore:

```text
converted unit cost = P(unit cost) × P(fx[cost currency])
```

The base quotation currency always has rate `1`.

A missing cost-currency rate behaves as `0` in pricing, so the converted cost becomes `0`. It does not silently use `1`.

Normal draft loading adds a seeded entry for every cost currency used by an item, so a missing rate normally occurs only in malformed or transient in-memory data.

### Seeded reference rates

Built-in reference rates are stored as USD value per unit of currency. A rate for another base currency is:

```text
rate(currency, base) =
  R10(reference USD value of currency / reference USD value of base)
```

`R10` means rounding to 10 decimal places.

| Currency | Reference USD value |
| --- | ---: |
| USD | 1 |
| EUR | 1.08 |
| CNY | 0.14 |
| GBP | 1.25 |
| JPY | 0.0067 |
| AUD | 0.64 |
| HKD | 0.128 |
| SGD | 0.74 |
| KRW | 0.00073 |

Unknown currencies fall back to reference value `1`.

When a stored rate table is normalized:

- a finite positive rate is clamped to `0.000001` through `1,000,000`;
- an invalid or non-positive stored rate is replaced by the seeded reference rate for that currency/base pair;
- the quotation currency is forced to `1`;
- an empty table is replaced by a complete seeded table.

An invalid or non-positive rate entered through the editor or agent API becomes `1` before table normalization.

### Rebasing the quotation currency

When the quotation currency changes:

```text
new rate[currency] = old rate[currency] / old rate[new base currency]
new rate[new base currency] = 1
```

The result is rounded to 10 decimal places.

If the new base currency is absent from the table, its seeded reference rate relative to the detected current base is inserted first. The current base is the first currency with rate `1`, or `USD` when none is found.

Stored quotation-currency amounts are also converted:

```text
conversion rate = new rate[old quotation currency]
new manual unit price = R(old manual unit price × conversion rate)
new expected total    = R(old expected total × conversion rate)
new extra charge      = R(old extra charge × conversion rate)
```

Unit cost is not changed because it remains denominated in its own cost currency.

### Online rates

The online provider returns:

```text
1 quotation currency = provider rate × cost currency
```

The application needs the inverse:

```text
stored cost-currency rate = R10(1 / provider rate)
```

Requested currencies are trimmed, uppercased, deduplicated, and stripped of the base currency. Only finite positive provider rates with a valid date are accepted. Unsupported or absent requested currencies are reported as missing and do not overwrite an existing stored rate.

## Markup selection and inheritance

The effective markup for a leaf uses the nearest available rate in this order:

1. the leaf's own finite markup override;
2. the nearest finite ancestor markup override;
3. the global quotation markup.

The chosen rate is clamped to `0%` through `1000%`.

An explicit `0%` override is valid and stops inheritance.

A group markup is not added on top of its children. It acts only as a fallback rate for descendants that do not have a closer override.

The group markup-usage indicator counts descendant leaves:

- `used`: no markup override exists on the path below the current group;
- `ignored`: the leaf or a closer descendant group has its own finite override.

The per-unit markup shown in markup help text is:

```text
per-unit markup = R(item markup amount / item quantity)
```

It is `0` when quantity is non-finite, zero, or negative.

### Changing pricing method

Only leaves can switch pricing method.

Cost-plus to manual-price initializes:

```text
manual unit price = current canonical unit selling price
```

The current price includes the effective self, ancestor, or global markup.

Manual-price to cost-plus behaves as follows:

```text
if stored unit cost > 0:
  keep stored unit cost
else:
  unit cost = manual unit price, or 0 when absent
```

The existing cost currency is kept, with the quotation currency as the fallback. If no positive cost and no explicit markup override existed, a `0%` override is added so inherited/global markup is not added. Currency conversion can still change the selling price when the retained cost currency is not the quotation currency.

## Leaf pricing

### Cost-plus leaf

The canonical sequence is:

```text
raw converted unit cost = P(c) × P(fx)
unit markup             = R(raw converted unit cost × C(m, 0, 1000) / 100)
unit selling price      = R(raw converted unit cost + unit markup)
base line cost          = R(P(q) × raw converted unit cost)
selling subtotal        = R(P(q) × unit selling price)
```

Markup is rounded at the unit level before quantity is applied. Therefore:

```text
selling subtotal - base line cost
```

can differ slightly from:

```text
base line cost × markup rate
```

The reported leaf markup is:

```text
M(leaf) = max(R(selling subtotal - base line cost), 0)
```

### Manual-price leaf

Manual price bypasses cost-plus pricing:

```text
unit selling price = R(P(manual unit price))
selling subtotal   = R(P(q) × unit selling price)
base line cost     = R(P(q) × P(c) × P(fx))
```

If stored cost is positive:

```text
M(leaf) = R(selling subtotal - base line cost)
```

This result may be negative when the manual price is below cost.

If the manual-price line has zero converted cost:

```text
M(leaf) = 0
```

The application does not treat the whole selling price as markup when cost is unknown.

### Cost of sales percentage

The calculation sheet's “cost of sales” is:

```text
cost of sales % = cost amount / pre-tax sales amount × 100
```

It returns no value when sales are zero or negative. It is not gross margin.

## Hierarchical quantity and rollup math

Quotation items can be nested to three levels. A child quantity means units per one unit of its parent.

For a group:

```text
B(group) = R(P(group quantity) × sum(B(direct child)))
S(group) = R(P(group quantity) × sum(S(direct child)))
```

This recursion means a leaf's fully extended quantity is conceptually:

```text
leaf quantity × parent quantity × grandparent quantity
```

Each group level rounds its own rolled-up result to cents.

The group's unit selling price is the price of one group:

```text
group unit selling price = R(sum(S(direct child)))
```

It is calculated from child subtotals, not by dividing the already-rounded group subtotal by group quantity.

### Group markup

Normally:

```text
M(group) = R(S(group) - B(group))
```

If the group contains any manual-price descendant with no cost, the code avoids treating that unknown-cost revenue as markup:

```text
M(group) = R(P(group quantity) × sum(M(direct child)))
```

As a result, this identity is not guaranteed:

```text
B(group) + M(group) = S(group)
```

### Effective group markup

When group base cost is positive:

```text
effective group markup % = R(M(group) / B(group) × 100)
```

When base cost is zero, the displayed effective rate is the group's fallback markup rate. It is not a rate derived from actual cost.

## Quotation summaries and totals

Each root item produces:

```text
root base subtotal = B(root)
root markup amount = M(root)
root subtotal       = S(root)
```

Section headers are ignored.

Quotation totals before tax are:

```text
base subtotal         = R(sum(root base subtotals))
markup amount         = R(sum(root markup amounts))
subtotal after markup = R(sum(root selling subtotals))
```

Because unknown-cost manual-price revenue has zero markup:

```text
base subtotal + markup amount
```

may be less than:

```text
subtotal after markup
```

There is no discount formula in the current codebase.

## Tax

### Tax-class selection

A leaf's tax class is selected in this order:

1. the leaf's own valid tax class;
2. the nearest ancestor's valid tax class;
3. the configured default tax class;
4. the first normalized tax class as a final fallback.

Invalid or missing rates become `0%`. Valid rates are clamped to `0%` through `100%`.

If no valid tax classes exist, normalization creates one class. Its rate comes from the legacy single `taxRate` field when that field is finite, otherwise `0%`. If the configured default class is invalid, the first normalized class becomes the default.

`taxMode` controls configuration and document behavior. The tax calculation itself always resolves tax at leaf level and supports multiple classes.

Single-tax mode is allowed only when the number of distinct effective leaf tax classes is at most one:

```text
single-tax allowed = count(distinct resolved leaf tax classes) <= 1
```

Loading or importing a quotation with more than one effective class automatically changes the mode to mixed. Switching back to single mode requires either one effective class already or applying one selected class to every item.

### Canonical quotation tax: bucket method

Quotation totals use tax buckets. Each leaf contributes its pre-tax selling subtotal to its resolved tax class:

```text
leaf bucket subtotal = S(leaf)
```

Each group scales every child bucket:

```text
group bucket subtotal[class] =
  R(P(group quantity) × sum(child bucket subtotal[class]))
```

After scaling, the bucket rows are reconciled so their sum equals `S(group)`. A positive cent difference is added to the last positive bucket. A negative difference is removed from buckets in reverse order without making a bucket negative.

Root contributions with the same tax class are merged:

```text
taxable subtotal[class] = R(sum(root bucket subtotal[class]))
tax[class] = R(taxable subtotal[class] × C(rate[class], 0, 100) / 100)
```

Quotation tax totals are:

```text
taxable subtotal = R(sum(taxable subtotal[class]))
tax amount        = R(sum(tax[class]))
```

The bucket reconciliation is designed to keep:

```text
taxable subtotal = subtotal after markup
```

including fractional nested quantities.

### Root-item tax allocation

Quotation tax buckets remain the accounting source of truth. For each quotation tax class, the bucket's tax is allocated to the root items that contributed taxable subtotal to it.

For each contributing root `i`:

```text
exact tax cents[i] =
  (root taxable subtotal[i] × tax rate / 100) × 100
  = root taxable subtotal[i] × tax rate
initial cents[i]   = floor(exact tax cents[i])
remainder[i]       = exact tax cents[i] - initial cents[i]
```

The implementation adds `0.000000001` before the floor operation to prevent a binary floating-point value just below an integer from losing a cent.

The target is the already-rounded quotation bucket tax:

```text
target cents = quotation bucket tax × 100
remaining cents = target cents - sum(initial cents)
```

Remaining cents are assigned one at a time in this order:

1. largest fractional remainder;
2. quotation order when remainders tie.

Allocation runs independently for every tax class, including `0%` buckets. Section headers do not participate.

For a root item:

```text
T(root) = sum(allocated tax for its buckets)
root gross amount = R(S(root) + T(root))
```

Therefore:

```text
sum(T(root)) = quotation tax amount
sum(root gross amount) + extra charges = grand total
```

Root cards, quotation previews, calculation sheets, CSV exports, and calculation explanations all use the same allocation.

For each effective displayed bucket:

```text
standalone calculated bucket tax =
  R(local bucket taxable subtotal × bucket rate / 100)

bucket allocation adjustment =
  R(effective bucket tax - standalone calculated bucket tax)

item allocation adjustment =
  R(sum(effective bucket tax) - sum(standalone calculated bucket tax))
```

For descendants, effective and standalone bucket tax are identical, so the adjustment is zero.

### Descendant tax

Descendants do not receive root allocation overrides. A descendant is calculated as a local subtree using the same tax-bucket method:

```text
local tax[class] = R(local taxable subtotal[class] × rate[class] / 100)
T(descendant) = R(sum(local tax[class]))
```

This preserves useful local explanations, but descendant amounts are non-additive because they intentionally exclude ancestor quantity multipliers.

### Effective item tax rate

For a group or mixed-tax item:

```text
effective tax rate = R(effective displayed tax / item subtotal × 100)
```

It is `null` when the item subtotal is zero.

## Extra charges and grand total

Extra charges are fixed quotation-currency amounts:

```text
extra charges total = R(sum(P(charge amount)))
```

They are not included in tax buckets and are added after tax:

```text
grand total = R(taxable subtotal + tax amount + extra charges total)
```

There is no percentage-based charge, freight formula, or taxable-charge option.

## Expected-total comparison

`expectedTotal` is a validation reference for groups. It never changes selling math.

For a group:

```text
expected = R(expected total)
actual   = S(group)
difference = R(abs(actual - expected))
```

No mismatch is shown when:

```text
difference <= 0.01
```

Expected totals on leaf rows are ignored by the importer.

## Goal seek

Goal seek works on pre-tax prices. It does not target tax or grand total.

A target is normalized before solving:

```text
normalized target = R(P(user target))
```

Therefore a negative or non-finite target becomes `0.00`.

### Item goal seek

Eligible items are cost-plus leaves with positive converted unit cost.

```text
converted unit cost for solver =
  R6(P(unit cost) × P(fx))

minimum target = canonical unit selling price at 0% markup
maximum target = canonical unit selling price at 1000% markup
```

For an in-range target:

```text
markup % =
  (target unit price - converted unit cost)
  / converted unit cost
  × 100
```

The solved markup is rounded to 4 decimal places. The projected price is recalculated through the canonical pricing function and is authoritative.

The item solve fails when the item is a group or manual-price leaf, converted cost is not positive, or the target is outside the canonical `0%` to `1000%` price range.

### Quotation global-markup goal seek

The solver divides pre-tax revenue into:

- `fixed subtotal`: manual-price lines and cost-plus lines controlled by their own or an ancestor markup;
- `adjustable base subtotal`: cost of leaves that use the global markup.

Ancestor quantity multipliers are included.

```text
minimum subtotal = R(fixed subtotal + adjustable base subtotal)

maximum subtotal =
  R(fixed subtotal
    + adjustable base subtotal × (1 + 1000 / 100))
```

For an in-range target:

```text
global markup % =
  ((target subtotal - fixed subtotal) / adjustable base subtotal - 1)
  × 100
```

The result is rounded to 4 decimal places and projected through the canonical quotation calculation. Unit-level money rounding means the projected subtotal may differ slightly from the requested target.

The quotation solve fails when there is no positive adjustable base subtotal or when the target is outside the minimum/maximum range.

## Analysis metrics

### Row eligibility and ordering

A root appears in the major-item analysis only when:

```text
root base subtotal > 0
or root selling subtotal > 0
```

Rows are sorted by selling subtotal descending, then base subtotal descending.

### Major-item profit and rates

When a root item has positive base cost:

```text
profit amount = R(root subtotal - root base subtotal)
effective markup % = R(profit / root base subtotal × 100)
gross margin %     = R(profit / root subtotal × 100)
```

When base cost is zero:

```text
profit amount = R(reported root markup)
```

For an uncosted manual-price item, reported markup and profit are therefore `0`.

All analysis rates use:

```text
analysis rate = R(amount / denominator × 100)
```

A non-finite amount/denominator or a denominator `<= 0` produces `0%`.

### Overall gross margin and cost visibility

The analysis separates revenue with known cost from manual-price revenue without cost:

```text
known-cost revenue =
  sum(selling revenue for every cost-plus leaf
      and every manual-price leaf with positive stored cost)

final-price revenue without cost =
  sum(selling revenue for manual-price leaves with no positive cost)

cost visibility % =
  R(known-cost revenue / quotation pre-tax subtotal × 100)

overall gross margin % =
  R(sum(major-item profit) / known-cost revenue × 100)
```

The overall gross-margin denominator is known-cost revenue, not total quotation revenue.

A cost-plus leaf counts as known-cost even when its stored cost is `0`. A manual-price leaf counts as known-cost only when its stored unit cost is finite and greater than `0`.

### Composition counts

```text
major item count = number of root quotation items
priced line count = number of leaves
currency count = distinct source currencies with positive converted cost
markup override count = number of finite explicit overrides at any level
```

An explicit `0%` markup override is included in the override count. Section headers are excluded from all four counts.

### Currency exposure

Currency exposure groups converted cost by the leaf's original cost-currency code:

```text
extended quantity = product of quantities along the item path

exposure[currency] +=
  R(extended quantity × unit cost × fx[currency])
```

The values are in quotation currency even though the keys identify source currencies.

Only positive converted amounts are retained. Each line contribution and each addition to a currency bucket are rounded to cents. Currency keys are sorted alphabetically.

### Pricing bridge

The bridge derives:

```text
extra charges = R(grand total - taxable subtotal - tax amount)
```

It then accumulates:

```text
base subtotal → markup amount → tax amount → extra charges
```

and separately plots grand total.

Because uncosted manual-price revenue has zero base and zero markup, the accumulated steps may not reach grand total. This is a known limitation of the current profit policy.

### Advisories

- zero markup: effective leaf markup `<= 0%`;
- low markup: effective leaf markup is greater than `0%` and less than `10%`;
- currency mix: a major item has positive cost exposure in more than one currency;
- tax mix: a major item resolves to more than one tax class.

Markup advisories inspect only leaves with positive extended base cost. For a manual-price leaf, the checked rate is derived from actual selling revenue and can be negative:

```text
checked markup % =
  R((extended selling amount - extended base cost)
    / extended base cost × 100)
```

Tax-mix advisories count only tax classes belonging to leaves with positive extended selling amounts. Zero-value leaves do not create a tax-mix warning.

## Calculation sheet and document values

### Calculation-sheet unit columns

Most unit columns are derived from the item's local total:

```text
unit cost        = R(item base amount / item quantity)
unit markup      = R(item markup amount / item quantity)
unit tax         = R(effective displayed tax / item quantity)
unit gross price = R(effective gross total / item quantity)
```

Invalid, zero, or negative divisors return `0`.

The unit selling price is not derived this way:

- leaf: canonical leaf unit selling price;
- group: `R(sum(direct child selling subtotals))`.

Calculation-sheet quotation summaries add only depth-1/root rows. This avoids double-counting descendants.

```text
sheet total cost   = R(sum(root total cost))
sheet total markup = R(sum(root total markup))
sheet total tax    = R(sum(root allocated tax))
line-items gross   = R(sum(root gross total))
quotation total    = R(line-items gross + extra charges)
```

CSV formatting does not recalculate money:

- money is written with exactly 2 decimals;
- quantity uses up to 2 decimals;
- markup and tax rates use up to 4 decimals;
- cost of sales uses 1 decimal.

### Hierarchical row scope

A nested row is priced as its own local subtree. It includes its own quantity and descendant quantities, but not ancestor quantities.

Example:

```text
parent quantity = 2
child quantity  = 3
child unit price = 10

child row local subtotal = 3 × 10 = 30
parent subtotal          = 2 × 30 = 60
```

Both rows can appear in a detailed document. They are not separate additive charges.

### Mixed-tax document columns

The document derives:

```text
net amount       = local item selling subtotal
tax amount       = allocated quotation tax for a root, otherwise local bucket tax
gross amount     = R(net amount + tax amount)
unit tax         = R(tax amount / displayed row quantity)
unit gross price = R(gross amount / displayed row quantity)
```

Pricing values are shown only for document rows that have a calculated amount. Changing output detail level changes which local rows are visible; it does not change quotation totals.

Valid output detail levels are `1`, `2`, and `3`. Missing or invalid output settings normalize to level `3`.

## Calculation-explanation audit

The explanation tree takes its totals and tax buckets from item pricing. Root explanations receive the quotation allocation; descendants use local bucket math.

### Cost-plus rounding

Example with unit cost `1.049`, FX `1`, and markup `50%`:

```text
raw converted unit cost = 1.049 × 1 = 1.049
displayed converted unit cost = R(1.049) = 1.05
unit markup = R(1.049 × 50%) = 0.52
unit selling price = R(1.05 + 0.52) = 1.57
```

Raw unit costs, exchange rates, and raw converted unit costs display up to 10 decimal places. Rates display up to 4 decimal places. Quantities display up to 2 decimal places. Monetary results remain at two decimals.

### Manual-price markup

When converted cost is positive:

```text
markup = subtotal - base amount
```

The displayed result may be negative when the selling subtotal is below known cost.

When converted total cost is zero, the intentional unknown-cost policy still reports markup as `0`; it does not treat selling revenue as profit. The explanation shows a dedicated message for this policy instead of displaying the known-cost subtraction formula.

The displayed converted total cost is:

```text
converted unit cost = R(P(unit cost) × P(fx))
converted total cost =
  canonical item base amount
```

The total remains canonical because multiplying the displayed rounded unit cost could produce a different cent result.

### Tax explanation

```text
calculated bucket tax = R(bucket taxable subtotal × bucket rate / 100)
allocated bucket tax = calculated bucket tax + allocation adjustment
total tax = sum(effective bucket taxes)
```

An allocation-adjustment step appears only when a root receives or loses a cent relative to its standalone rounded bucket tax.

```text
unit tax = R(effective tax / quantity)
unit gross price = R(effective gross total / quantity)
```

These formulas avoid adding independently rounded unit net and unit tax values.

### Group explanation

The explanation first rounds each sum of direct-child local totals:

```text
child base total   = R(sum(direct child base amounts))
child subtotal     = R(sum(direct child selling subtotals))
child markup total = R(sum(direct child markup amounts))
```

It then shows the group quantity scaling and the canonical group results described under hierarchy rollups. Tax is explained by bucket; child tax amounts are not added together.

## Chinese uppercase currency amount

Customer documents can render an amount in Chinese financial numerals.

The process is:

```text
rounded amount = R(amount)
total cents = integer(abs(rounded amount) × 100)
whole amount = total cents / 100
jiao = tens digit of cents
fen  = ones digit of cents
```

Negative values receive the `负` prefix.

The whole amount is split into groups of four digits and labeled with:

```text
元, 万, 亿, 万亿
```

Zero jiao and zero fen produce `整`.

The fractional cases are:

```text
jiao = 0 and fen = 0 → 整
jiao = 0 and fen > 0 → 零{fen}分
jiao > 0 and fen = 0 → {jiao}角整
jiao > 0 and fen > 0 → {jiao}角{fen}分
```

Amounts requiring more than four four-digit groups—whole amounts of at least `10^16`—fall back to a plain integer string for the whole amount. Extremely large JavaScript numbers may already have lost precision before this conversion.

## Goods-receipt quantity math

Each receipt candidate uses the product of its own quantity and every ancestor quantity:

```text
raw extended quantity =
  P(item quantity) × product(P(ancestor quantity))

receipt quantity = round raw extended quantity to 2 decimals
receipt quoted quantity = receipt quantity
```

The ancestor multiplier remains unrounded during traversal. Only the final quantity for each candidate is rounded.

Examples:

```text
2 × 3 × 4 = 24
1.25 × 1.25 = 1.5625 → 1.56
```

A zero, negative, or non-finite quantity normalizes to `0`, so that item and every descendant path has an extended quantity of `0`.

Initial selection and presets use the extended quantity:

- on draft creation, positive-quantity leaves are selected;
- summary preset selects positive-quantity roots;
- grouped preset selects positive-quantity depth-1 rows and any positive root leaf;
- detailed preset selects positive-quantity leaves.

Here root depth is `0`, its direct children are depth `1`, and its grandchildren are depth `2`. Preset selection never changes a line's calculated quantity.

Validation rules are:

- a user-edited negative or non-finite receipt quantity: error;
- selected zero quantity: warning;
- selected quantity greater than the extended quoted quantity: warning;
- only selected positive finite quantities are exportable.

Parent and descendant rows cannot both be selected, which prevents direct parent-child double-counting.

Reset restores:

```text
quantity = quoted extended quantity
```

The printed total quantity is available only when all exported line units match after trimming:

```text
total quantity = sum(exported line quantities)
```

The total is not rounded again after summing. If units differ, no total quantity is shown.

## Non-financial counters

Quotation numbering uses:

```text
next sequence = highest sequence for the current year + 1
quotation number = Q-{year}-{sequence padded to at least 3 digits}
```

Only existing numbers exactly matching `Q-{current year}-{digits}` participate. Numbers from another year or another format are ignored. Sequences above three digits are not truncated.

Revision numbers must be positive integers; invalid values normalize to `1`.

The editor's incomplete-item count recursively counts every item that fails these rules:

| Item type | Complete only when |
| --- | --- |
| Any item | name is non-empty, quantity is greater than `0`, and quantity unit is non-empty |
| Cost-plus leaf | the common rules pass and unit cost is greater than `0` |
| Manual-price leaf | the common rules pass and manual unit price is greater than `0` |
| Group | the common rules pass; child completeness is counted separately |

The agent summary exposes two structural counts:

```text
top-level item count = number of root quotation items
item count = recursive count of all quotation items
```

Section headers are excluded from both.

Goods-receipt numbers use the document date:

```text
YYYY-MM-DD → GR-YYYYMMDD
```

Implementation detail: all non-digits are removed and the first eight digits are used. Fewer than eight digits produces `GR`.

## Worked pricing example

Assume:

- root group quantity `2`;
- one child leaf quantity `3`;
- child unit cost `100 EUR`;
- `fx[EUR] = 1.10 USD`;
- markup `10%`;
- tax `13%`;
- no extra charges.

Leaf:

```text
converted unit cost = 100 × 1.10 = 110.00
unit markup = R(110.00 × 10%) = 11.00
unit selling price = R(110.00 + 11.00) = 121.00
leaf base cost = R(3 × 110.00) = 330.00
leaf subtotal = R(3 × 121.00) = 363.00
```

Root group:

```text
root base subtotal = R(2 × 330.00) = 660.00
root selling subtotal = R(2 × 363.00) = 726.00
root markup = R(726.00 - 660.00) = 66.00
```

Quotation tax and grand total:

```text
taxable subtotal = 726.00
tax = R(726.00 × 13%) = 94.38
grand total = R(726.00 + 94.38) = 820.38
```

## Source-of-truth files

| Area | Main source |
| --- | --- |
| Core pricing, rollups, tax buckets, totals | `src/features/quotations/utils/quotationCalculations.ts` |
| Money rounding | `src/features/quotations/utils/moneyMath.ts` |
| Currency and percentage display formatting | `src/shared/utils/formatters.ts` |
| Limits | `src/features/quotations/utils/pricingLimits.ts` |
| New-item defaults and loaded item normalization | `src/features/quotations/utils/quotationItems.ts` |
| Quotation defaults and draft normalization | `src/features/quotations/utils/quotationDraft.ts` |
| Exchange-rate creation and rebasing | `src/features/quotations/utils/exchangeRates.ts` |
| Online exchange-rate inversion | `src/features/quotations/services/onlineExchangeRates.ts` |
| Item-display pricing and effective tax buckets | `src/features/quotations/utils/quotationItemPricing.ts` |
| Item-card unit and total summary values | `src/features/quotations/composables/useLineItemCardSummary.ts` |
| Group-card summary rows | `src/features/quotations/utils/majorItemPricingDisplay.ts` |
| Markup usage and per-unit helper values | `src/features/quotations/utils/quotationMarkupCopy.ts` |
| Tax normalization and inheritance | `src/features/quotations/utils/quotationTaxes.ts` |
| Goal seek | `src/features/quotations/utils/quotationGoalSeek.ts` |
| Analysis metrics | `src/features/quotations/utils/quotationAnalysis.ts` |
| Calculation-sheet rows | `src/features/quotations/utils/quotationCalculationSheetRows.ts` |
| Calculation-sheet CSV formatting | `src/features/quotations/utils/quotationCalculationSheetCsv.ts` |
| Calculation explanation | `src/features/quotations/utils/quotationCalculationExplanation.ts` |
| Calculation explanation display precision | `src/features/quotations/components/CalculationExplanationDialog.vue` |
| Calculation-sheet quotation summaries | `src/features/quotations/components/CalculationSheetDialog.vue` |
| Document row pricing | `src/features/quotations/utils/quotationPreviewPricing.ts` |
| Document tax/gross columns | `src/features/quotations/utils/quotationDocumentColumnValues.ts` |
| Output detail-level normalization | `src/features/quotations/utils/quotationOutputSettings.ts` |
| Expected-total mismatch | `src/features/quotations/utils/quotationItemValidation.ts` |
| Incomplete-item count | `src/features/quotations/utils/quotationItemCompleteness.ts` |
| Currency-change conversion of stored amounts | `src/features/quotations/composables/useQuotationEditor.ts` |
| Agent summary counts and agent rate normalization | `src/features/quotations/composables/useQuotationAgentApi.ts` |
| CSV/XLSX numeric import | `src/features/quotations/utils/lineItemsCsv.ts`, `src/features/quotations/utils/lineItemsXlsx.ts` |
| Chinese currency words | `src/features/quotations/utils/chineseCurrencyAmount.ts` |
| Goods-receipt quantities | `src/features/goods-receipts/utils/goodsReceipt.ts` |
| Quotation numbering | `src/features/quotations/utils/quotationNumbering.ts` |

## Test coverage reviewed

The audit reviewed focused tests for:

- core cost, selling, markup, hierarchy, tax buckets, extra charges, and rounding;
- exchange-rate rebasing and online-rate inversion;
- item and quotation goal seek;
- analysis KPIs and advisories;
- item pricing, calculation sheets, explanations, and document column values;
- CSV/XLSX percentage import;
- Chinese currency amount formatting;
- goods-receipt quantity validation and totals.

Regression coverage now includes root tax allocation, largest remainders and stable ties, mixed and zero-rate buckets, section headers, nested groups, root/descendant display scope, explanation operands and allocation adjustments, negative manual markup, and extended goods-receipt quantities.
