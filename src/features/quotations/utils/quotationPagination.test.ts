// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { splitQuotationTextElement } from './quotationPagination'

describe('quotation text fragmentation', () => {
  it('preserves markup, Chinese text and explicit line breaks without changing the original', () => {
    const cell = document.createElement('td')
    cell.innerHTML = '<strong class="item-title">Pump 泵</strong><span class="item-detail">Model A\n第一行\n第二行</span>'
    const original = cell.textContent!
    const [head, tail] = splitQuotationTextElement(cell, 15)
    expect(head.textContent! + tail.textContent!).toBe(original)
    expect(cell.textContent).toBe(original)
    expect(head.querySelector('strong')?.className).toBe('item-title')
    expect(tail.querySelector('span')?.className).toBe('item-detail')
    expect(head).not.toBe(cell)
  })

  it('can split before or after all text without duplicating content', () => {
    const paragraph = document.createElement('p')
    paragraph.textContent = 'First line\nSecond line\n'
    for (const offset of [0, 1, paragraph.textContent.length, paragraph.textContent.length + 10]) {
      const [head, tail] = splitQuotationTextElement(paragraph, offset)
      expect(head.textContent! + tail.textContent!).toBe(paragraph.textContent)
    }
  })
})
