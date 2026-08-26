import { describe, expect, it } from 'vitest'

import rootEditorSource from './LineItemRootEditor.vue?raw'

describe('LineItemRootEditor layout safeguards', () => {
  it('caps wide mixed-tax group controls instead of stretching markup across the row', () => {
    const rule = getCssRule(
      rootEditorSource,
      '.item-control-grid-group.item-control-grid-mixed',
    )

    expect(rule).toMatchObject({
      'grid-template-columns': '108px 108px minmax(260px, 560px) minmax(160px, 220px)',
      'justify-content': 'start',
    })
    expect(rule['grid-template-columns']).not.toContain('minmax(0, 1fr)')
  })
})

function getCssRule(source: string, selector: string) {
  const ruleStart = source.indexOf(`${selector} {`)
  const ruleEnd = source.indexOf('}', ruleStart)

  if (ruleStart < 0 || ruleEnd < 0) {
    throw new Error(`Missing CSS rule for ${selector}`)
  }

  return Object.fromEntries(
    source
      .slice(ruleStart + selector.length + 2, ruleEnd)
      .split(';')
      .map((declaration) => {
        const separator = declaration.indexOf(':')

        return separator < 0
          ? []
          : [declaration.slice(0, separator).trim(), declaration.slice(separator + 1).trim()]
      })
      .filter(([property, value]) => property && value),
  )
}
