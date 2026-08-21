import { describe, expect, it } from 'vitest'

import legacyTemplateSource from './LegacyQuotationTemplate.vue?raw'

describe('LegacyQuotationTemplate metadata layout', () => {
  it('keeps each quotation field in a readable label-and-value row', () => {
    expect(legacyTemplateSource).toMatch(
      /\.quotation-meta-list\s*\{\s*margin: 0;\s*display: grid;\s*grid-template-columns: minmax\(0, 1fr\);/,
    )
    expect(legacyTemplateSource).toMatch(
      /\.quotation-meta-item\s*\{\s*display: grid;\s*grid-template-columns: max-content minmax\(0, 1fr\);/,
    )
    expect(legacyTemplateSource).toMatch(
      /\.quotation-meta-value\s*\{\s*min-width: 0;\s*overflow-wrap: anywhere;\s*text-align: right;/,
    )
  })
})
