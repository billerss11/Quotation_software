import { describe, expect, it } from 'vitest'

import source from './LineItemCard.vue?raw'
import childTableSource from './LineItemChildTable.vue?raw'
import rootEditorSource from './LineItemRootEditor.vue?raw'

const style = source.match(/<style scoped>([\s\S]*)<\/style>/)?.[1] ?? ''
const childTableStyle = childTableSource.match(/<style scoped>([\s\S]*)<\/style>/)?.[1] ?? ''
const rootEditorStyle = rootEditorSource.match(/<style scoped>([\s\S]*)<\/style>/)?.[1] ?? ''

describe('LineItemCard responsive layout styles', () => {
  it('uses card-width container queries for the major item editor', () => {
    expect(style).toMatch(/\.item-card\s*\{[\s\S]*container:\s*line-item-card\s*\/\s*inline-size;/)
    expect(rootEditorStyle).toMatch(
      /@container\s+line-item-card\s+\(max-width:\s*920px\)\s*\{[\s\S]*\.expected-total-row\s*\{[\s\S]*grid-template-columns:\s*1fr;/,
    )
    expect(rootEditorStyle).toMatch(
      /@container\s+line-item-card\s+\(max-width:\s*700px\)\s*\{[\s\S]*\.item-control-grid,[\s\S]*grid-template-columns:\s*repeat\(6,\s*minmax\(0,\s*1fr\)\);/,
    )
    expect(rootEditorStyle).toMatch(
      /@container\s+line-item-card\s+\(max-width:\s*520px\)\s*\{[\s\S]*\.pf,[\s\S]*grid-column:\s*1\s*\/\s*-1;/,
    )
  })

  it('top-aligns mixed child-row controls and values when rows grow taller', () => {
    expect(childTableStyle).toMatch(/\.ct-row\s*\{[\s\S]*align-items:\s*start;/)
    expect(childTableStyle).toMatch(/\.ct-amount-detail\s*\{[\s\S]*align-self:\s*start;/)
    expect(childTableStyle).toMatch(/\.ct-amount\s*\{[\s\S]*align-self:\s*start;/)
  })

  it('lets nested line-item column headers stick while the editor scrolls', () => {
    expect(style).toMatch(/\.item-card\s*\{[\s\S]*overflow:\s*visible;/)
    expect(style).not.toMatch(/\.item-card-panel\s*\{[\s\S]*overflow:\s*(?:hidden|clip);/)
    expect(childTableStyle).toMatch(/\.child-table-wrap\s*\{[\s\S]*overflow:\s*visible;/)
    expect(childTableStyle).toMatch(/\.ct-head\s*\{[\s\S]*position:\s*sticky;[\s\S]*top:\s*54px;[\s\S]*z-index:\s*7;/)
  })

  it('keeps the root item description directly under the root item name', () => {
    expect(source).toMatch(/:description-value="getTextFieldValue\(props\.item,\s*'description'\)"/)
    expect(source).toMatch(/@update-item-description="setText\(props\.item\.id,\s*'description',\s*\$event\)"/)
    expect(source).toMatch(/@flush-item-description="flushBufferedField\(props\.item\.id,\s*'description'\)"/)
    expect(rootEditorSource).not.toMatch(/descriptionValue/)
  })
})
