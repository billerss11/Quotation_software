// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'

import { findQuotationItemFocusElement } from './quotationItemFocusTarget'

describe('quotationItemFocusTarget', () => {
  it('prefers a focus anchor over the full item element', () => {
    document.body.innerHTML = `
      <article data-item-id="root-1">
        <header data-item-focus-anchor="root-1"></header>
      </article>
    `

    expect(findQuotationItemFocusElement(document, 'root-1')).toBe(
      document.querySelector('[data-item-focus-anchor="root-1"]'),
    )
  })

  it('falls back to the item element when no focus anchor exists', () => {
    document.body.innerHTML = '<div data-item-id="child-1"></div>'

    expect(findQuotationItemFocusElement(document, 'child-1')).toBe(
      document.querySelector('[data-item-id="child-1"]'),
    )
  })
})
