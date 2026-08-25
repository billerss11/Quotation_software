import { describe, expect, it } from 'vitest'

import classicTemplateSource from './ClassicQuotationTemplate.vue?raw'

describe('ClassicQuotationTemplate metadata layout', () => {
  it('keeps each quotation field in a readable label-and-value row', () => {
    expect(classicTemplateSource).toMatch(
      /\.quotation-meta-list\s*\{\s*margin: 0;\s*display: grid;\s*grid-template-columns: minmax\(0, 1fr\);/,
    )
    expect(classicTemplateSource).toMatch(
      /\.quotation-meta-item\s*\{\s*display: grid;\s*grid-template-columns: max-content minmax\(0, 1fr\);/,
    )
    expect(classicTemplateSource).toMatch(
      /\.quotation-meta-value\s*\{\s*min-width: 0;\s*overflow-wrap: anywhere;\s*text-align: right;/,
    )
  })
})
