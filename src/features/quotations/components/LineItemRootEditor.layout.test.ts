import { describe, expect, it } from 'vitest'

import rootEditorSource from './LineItemRootEditor.vue?raw'

describe('LineItemRootEditor layout safeguards', () => {
  it('keeps the markup input bounded when the editor has spare width', () => {
    const rule = getCssRule(
      rootEditorSource,
      '.pf-markup',
    )

    expect(rule).toMatchObject({
      'max-width': '260px',
    })
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
