# AGENTS.md — Project Rules

## Ground Rules (NON-NEGOTIABLE)

All code must be: **Flexible**, **Maintainable**, **Readable**, **extremely scalable** .

**NEVER commit changes:** AI agents must NEVER create git commits. The user will commit all changes.

---


## Coding Rules

### Do
- Vue 3 `<script setup>`, `ref()`, `computed()`, `watch()`
- Small functions (10-30 lines, max 50)
- Descriptive names: `calculateOuterRadius()`, `isActive`, `hasConnection`

### Don't
- Duplicate code — extract to composables/utilities




## Workflow

1. Read relevant code
2. Search for existing implementations — reuse, don't duplicate
3. Check PrimeVue first for UI
4. Plan briefly: what to change/reuse, why it's simple
5. Implement with small, clear functions
6. Clean up: remove unused imports, dead code
