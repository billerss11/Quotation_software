/** Paginate the rendered template, so preview and PDF share fonts, rows and page breaks. */
export interface QuotationPaginationOptions {
  width: number
  height: number
  quotationNumber: string
  continuedLabel: string
  termsLabel: string
  summaryLabel: string
  pageLabel: (page: number, total: number) => string
}

interface Page {
  element: HTMLElement
  document: HTMLElement
  footer: HTMLElement
  number: HTMLElement
  contentCount: number
}

const GAP = 10
const FOOTER_GAP = 16
const SUMMARY_SELECTOR = '.quotation-summary, .summary-section, .summary-grid, .closing-grid'

function clone<T extends Node>(node: T): T {
  return node.cloneNode(true) as T
}

function textNodes(element: Node): Text[] {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  let node: Node | null
  while ((node = walker.nextNode())) nodes.push(node as Text)
  return nodes
}

/** Preserve every character, including explicit newlines, when splitting a long block. */
export function splitQuotationTextElement<T extends HTMLElement>(element: T, offset: number): [T, T] {
  const head = clone(element)
  const tail = clone(element)
  const headNodes = textNodes(head)
  const tailNodes = textNodes(tail)
  let remaining = offset
  for (let i = 0; i < headNodes.length; i += 1) {
    const value = headNodes[i].data
    const take = Math.max(0, Math.min(remaining, value.length))
    headNodes[i].data = value.slice(0, take)
    tailNodes[i].data = value.slice(take)
    remaining -= value.length
  }
  return [head, tail]
}

function readableBoundary(value: string, offset: number): number {
  if (offset >= value.length) return value.length
  // A Unicode surrogate pair must never be cut in half.
  if (offset > 0 && /[\uDC00-\uDFFF]/.test(value[offset])) offset -= 1
  const previousWordBoundary = value.slice(0, offset).search(/\s+\S*$/u)
  return previousWordBoundary > offset * 0.7 ? previousWordBoundary + 1 : offset
}

function continuationText(value: string): string {
  const characters = Array.from(value)
  return characters.length > 220 ? `${characters.slice(0, 219).join('')}…` : value
}

export function paginateQuotationDocument(
  source: HTMLElement,
  destination: HTMLElement,
  options: QuotationPaginationOptions,
): HTMLElement[] {
  destination.replaceChildren()
  const pages: Page[] = []
  let page!: Page

  function addPage(context = ''): Page {
    const element = document.createElement('section')
    element.className = 'quotation-page'
    element.style.width = `${options.width}px`
    element.style.height = `${options.height}px`
    // Pages need the template's classes/styles, not another copy of every row.
    const content = source.cloneNode(false) as HTMLElement
    content.classList.add('quotation-page-document')
    content.style.width = `${options.width}px`
    const footer = document.createElement('footer')
    footer.className = 'quotation-page-footer'
    const reference = document.createElement('span')
    reference.className = 'quotation-page-reference'
    reference.textContent = options.quotationNumber
    const number = document.createElement('span')
    number.className = 'quotation-page-number'
    number.textContent = options.pageLabel(999, 999)
    footer.append(reference, number)
    element.append(content, footer)
    destination.append(element)
    page = { element, document: content, footer, number, contentCount: 0 }
    pages.push(page)
    if (context) {
      const heading = document.createElement('div')
      heading.className = 'quotation-continuation'
      // This is navigation context, not a replacement for the complete text in
      // the source row. Keep it bounded so long titles cannot consume a page.
      heading.textContent = `${continuationText(context)} · ${options.continuedLabel}`
      content.append(heading)
    }
    return page
  }

  function fits(): boolean {
    return page.document.getBoundingClientRect().bottom <= page.footer.getBoundingClientRect().top - FOOTER_GAP
  }

  function place(element: HTMLElement): boolean {
    element.style.marginTop = page.document.children.length ? `${GAP}px` : '0'
    page.document.append(element)
    if (fits()) {
      page.contentCount += 1
      return true
    }
    element.remove()
    return false
  }

  function fitText<T extends HTMLElement>(element: T, mount: (candidate: T) => void): [T, T] {
    const text = element.textContent ?? ''
    let low = 0
    let high = text.length
    while (low < high) {
      const mid = Math.ceil((low + high) / 2)
      const [candidate] = splitQuotationTextElement(element, mid)
      mount(candidate)
      if (fits()) low = mid
      else high = mid - 1
      candidate.remove()
    }
    const boundary = readableBoundary(text, low)
    if (!boundary) throw new Error('A quotation block cannot fit on an empty page.')
    return splitQuotationTextElement(element, boundary)
  }

  function appendBlock(element: HTMLElement, context = '') {
    let remainder = clone(element)
    if (place(remainder)) return
    // Try a fresh page only when the block really fits there. Otherwise use the
    // space already available, rather than creating a header-only first page.
    const previous = page
    if (page.contentCount) {
      addPage(context)
      if (place(remainder)) return
      page.element.remove()
      pages.pop()
      page = previous
    }
    while (remainder.textContent?.trim()) {
      const mount = (candidate: HTMLElement) => {
        candidate.style.marginTop = page.document.children.length ? `${GAP}px` : '0'
        page.document.append(candidate)
      }
      let head: HTMLElement
      let tail: HTMLElement
      try {
        ;[head, tail] = fitText(remainder, mount)
      } catch (error) {
        if (!page.contentCount) throw error
        addPage(context)
        ;[head, tail] = fitText(remainder, mount)
      }
      mount(head)
      page.contentCount += 1
      remainder = tail
      if (remainder.textContent?.trim()) addPage(context)
    }
  }

  function appendSummary(section: HTMLElement) {
    const complete = clone(section)
    if (place(complete)) return
    if (page.contentCount && section.getBoundingClientRect().height < options.height - 150) {
      const previous = page
      addPage(options.summaryLabel)
      if (place(complete)) return
      page.element.remove()
      pages.pop()
      page = previous
    }
    const notes = section.querySelector<HTMLElement>('.terms-box, .notes-panel, .terms-panel')
    const totals = section.querySelector<HTMLElement>('.totals-box, .totals-panel, .totals-board')
    if (!notes || !totals) return appendBlock(section, options.termsLabel)
    // Long notes are full-width flowing prose, not a huge unbreakable grid with
    // a mostly empty totals column beside it.
    const prose = clone(section)
    prose.replaceChildren(clone(notes))
    prose.classList.add('quotation-summary-prose')
    appendBlock(prose, options.termsLabel)
    const totalSection = clone(section)
    totalSection.replaceChildren(clone(totals))
    totalSection.classList.add('quotation-summary-totals')
    if (place(totalSection)) return
    if (page.contentCount) {
      const previous = page
      addPage(options.summaryLabel)
      if (place(totalSection)) return
      page.element.remove()
      pages.pop()
      page = previous
    }
    // Many tax/charge rows may themselves exceed a page: split between logical
    // rows, keeping the grand total and amount in words together.
    for (const row of Array.from(totals.children)) {
      const fragment = clone(totalSection)
      fragment.firstElementChild!.replaceChildren(clone(row))
      appendBlock(fragment, options.summaryLabel)
    }
  }

  function appendTableSection(section: HTMLElement, table: HTMLTableElement) {
    const rows = Array.from(table.tBodies).flatMap(body => Array.from(body.rows))
    // Build the repeated header/colgroup once. Cloning the full source table for
    // every page otherwise makes large quotations scale with rows × pages.
    const tableShell = clone(section)
    for (const group of Array.from(tableShell.querySelector('table')!.tBodies)) group.remove()
    const rowByNumber = new Map(rows.map(row => [row.dataset.itemNumber ?? row.querySelector('.col-no')?.textContent?.trim() ?? '', row]))
    let body!: HTMLTableSectionElement
    let tableSection!: HTMLElement
    function contextFor(row: HTMLTableRowElement, includeSelf = false): string {
      const number = row.dataset.itemNumber ?? row.querySelector('.col-no')?.textContent?.trim() ?? ''
      const parts = number.split('.')
      const path = parts.slice(0, includeSelf ? undefined : -1).map((_, index) => parts.slice(0, index + 1).join('.'))
      if (!number && includeSelf) return row.querySelector('.section-band')?.textContent?.trim() ?? ''
      return path.map(key => {
        const ancestor = rowByNumber.get(key)
        return `${key} ${ancestor?.querySelector('.item-title')?.textContent?.trim() ?? ''}`.trim()
      }).join(' › ')
    }
    function startTable(row: HTMLTableRowElement, newPage: boolean, continuing = false) {
      if (newPage) addPage(contextFor(row, continuing))
      tableSection = clone(tableShell)
      tableSection.style.marginTop = page.document.children.length ? `${GAP}px` : '0'
      const copy = tableSection.querySelector('table')!
      // Let column widths remain identical on every page; the original colgroup
      // has already been sized by the source template.
      body = copy.createTBody()
      page.document.append(tableSection)
    }
    if (!rows.length) return appendBlock(section)
    startTable(rows[0], false)
    for (let index = 0; index < rows.length; index += 1) {
      const original = rows[index]
      let row = clone(original)
      body.append(row)
      // A section or group must travel with the first following row. At most
      // three ancestors are involved, so preview the chain, not the whole group.
      const probes: HTMLTableRowElement[] = []
      let probeIndex = index
      while (rows[probeIndex]?.matches('.row-section, .row-group') && probeIndex + 1 < rows.length && probes.length < 3) {
        const following = rows[++probeIndex]
        const next = clone(following)
        // Ordinary rows move intact, so their lookahead must be intact as well.
        // Only a truly page-tall row will actually be fragmented below.
        if (following.getBoundingClientRect().height > options.height - 150) {
          for (const cell of Array.from(next.cells)) {
            if ((cell.textContent?.length ?? 0) > 180) {
              const [head] = splitQuotationTextElement(cell, 180)
              cell.replaceWith(head)
            }
          }
        }
        probes.push(next)
        body.append(next)
      }
      const doesFit = fits()
      probes.forEach(probe => probe.remove())
      if (doesFit) { page.contentCount += 1; continue }
      row.remove()
      const isOversized = original.getBoundingClientRect().height > options.height - 150
      if ((body.rows.length || page.contentCount) && !isOversized) {
        if (!body.rows.length) tableSection.remove()
        startTable(original, true)
      }
      body.append(row)
      if (fits()) { page.contentCount += 1; continue }
      row.remove()
      // Fragment each cell independently. Usually only the description has a
      // remainder, but a long section heading or unit must not vanish or block
      // the document. Completed monetary cells have no remainder, so amounts
      // are not printed again on continuation fragments.
      let fragmentIndex = 0
      if (!row.textContent?.trim()) throw new Error('An empty quotation row is taller than a page.')
      while (row.textContent?.trim()) {
        const shell = clone(row)
        const remainder = clone(row)
        const cells = Array.from(row.cells)
        const fillFragment = () => {
          shell.replaceChildren()
          remainder.replaceChildren()
          // Keep the complete table shape while measuring each individual cell.
          for (const cell of cells) {
            const empty = clone(cell)
            empty.replaceChildren()
            shell.append(empty)
          }
          body.append(shell)
          for (let cellIndex = 0; cellIndex < cells.length; cellIndex += 1) {
            const complete = clone(cells[cellIndex])
            shell.cells[cellIndex].replaceWith(complete)
            if (fits()) {
              const empty = clone(complete)
              empty.replaceChildren()
              remainder.append(empty)
              continue
            }
            const after = complete.nextElementSibling
            complete.remove()
            const [head, tail] = fitText(cells[cellIndex], candidate => shell.insertBefore(candidate, after))
            shell.insertBefore(head, after)
            remainder.append(tail)
          }
        }
        try { fillFragment() } catch (error) {
          shell.remove()
          if (!page.contentCount) throw error
          if (!body.rows.length) tableSection.remove()
          startTable(original, true, fragmentIndex > 0)
          fillFragment()
        }
        shell.dataset.pageFragment = String(fragmentIndex)
        page.contentCount += 1
        row = remainder
        if (!row.textContent?.trim()) break
        fragmentIndex += 1
        startTable(original, true, true)
      }
    }
  }

  addPage()
  for (const child of Array.from(source.children)) {
    if (!(child instanceof HTMLElement)) continue
    const table = child.querySelector<HTMLTableElement>('.quotation-table')
    if (table) appendTableSection(child, table)
    else if (child.matches(SUMMARY_SELECTOR)) appendSummary(child)
    else appendBlock(child)
  }
  pages.forEach((entry, index) => {
    entry.element.dataset.pageNumber = String(index + 1)
    entry.number.textContent = options.pageLabel(index + 1, pages.length)
  })
  return pages.map(entry => entry.element)
}
