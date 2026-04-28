# AGENTS.md - Quotation Software Rules

## Project Context

- This is a Windows-first desktop quotation app built with Electron, Vite, Vue 3, TypeScript, PrimeVue, and Vitest.
- The app is local-first. Preserve file-backed quotation/customer workflows and Electron bridge APIs before adding browser-only or backend assumptions.
- Product requirements live in `requirement.md`; use them as the source of truth for quotation behavior.

## Ground Rules

- Never create git commits. The user handles commits.
- Keep changes small, readable, and aligned with the existing feature structure.
- Reuse existing utilities, composables, and PrimeVue components before adding new patterns.
- Remove unused imports, dead code, and copied boilerplate when touching a file.

## Vue And UI

- Use Vue 3 with `<script setup>` and TypeScript.
- Prefer `ref()`, `computed()`, and `watch()` for local reactivity.
- Keep Vue components focused on display, user input, and event wiring.
- Check PrimeVue first for UI controls, overlays, menus, tabs, inputs, dialogs, toasts, and confirmations.
- Keep UI text practical and quotation-workflow focused.

## Internationalization (i18n)

- The app is bilingual: **English (`en-US`)** and **Simplified Chinese (`zh-CN`)**. Treat both as required for new work.
- Do not hardcode user-visible strings in Vue or shared UI logic. Add keys to the message modules in `src/shared/i18n/` (e.g. `messages.ts`) and use `useI18n()` / `t()` (or the project’s existing i18n helpers) so every new label, toast, dialog, and ARIA string exists in both locales.
- Reuse the same key structure and naming patterns as existing messages; add pluralization or interpolation placeholders where the English copy needs them, and mirror them in Chinese.
- When adding tests for UI copy, prefer matching stable keys or message content that is easy to assert without duplicating entire translation files.

## Project Structure

- Put feature code under `src/features/<feature>/`.
- Keep feature UI in `components/`, stateful feature logic in `composables/`, and pure logic in `utils/`.
- Put cross-feature helpers under `src/shared/`.
- Keep Electron-specific code in `electron/` and scripts in `scripts/`.

## Quotation Logic

- Keep price, cost, exchange-rate, markup, discount, tax, and total calculations centralized in quotation utilities.
- Do not put pricing formulas directly in Vue components.
- Preserve hierarchical item rollups: detail lines roll into sub-items, and sub-items roll into parent items.
- Keep customer-facing quotation output consistent with the fixed template requirements.

## Testing And Verification

- Add or update focused Vitest coverage for changed utilities and composables.
- For Vue/component changes, run at least `npm run typecheck`.
- For pricing, file import/export, storage, or quotation row changes, run the relevant `npm test -- <pattern>` command.
- Before handing work back, mention any verification that could not be run.
