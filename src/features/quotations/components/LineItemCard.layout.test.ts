import { describe, expect, it } from 'vitest'

import source from './LineItemCard.vue?raw'

const style = source.match(/<style scoped>([\s\S]*)<\/style>/)?.[1] ?? ''

describe('LineItemCard responsive layout styles', () => {
  it('uses card-width container queries for the major item editor', () => {
    expect(style).toMatch(/\.item-card\s*\{[\s\S]*container:\s*line-item-card\s*\/\s*inline-size;/)
    expect(style).toMatch(
      /@container\s+line-item-card\s+\(max-width:\s*920px\)\s*\{[\s\S]*\.item-editor-shell\s*\{[\s\S]*grid-template-columns:\s*1fr;/,
    )
    expect(style).toMatch(
      /@container\s+line-item-card\s+\(max-width:\s*700px\)\s*\{[\s\S]*\.item-control-grid,[\s\S]*grid-template-columns:\s*repeat\(6,\s*minmax\(0,\s*1fr\)\);/,
    )
    expect(style).toMatch(
      /@container\s+line-item-card\s+\(max-width:\s*520px\)\s*\{[\s\S]*\.pf,[\s\S]*grid-column:\s*1\s*\/\s*-1;/,
    )
  })
})
