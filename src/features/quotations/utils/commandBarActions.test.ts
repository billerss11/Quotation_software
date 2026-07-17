import { describe, expect, it } from 'vitest'

import { getCommandBarActions } from './commandBarActions'

describe('getCommandBarActions', () => {
  it('shows full file actions when native dialogs are available', () => {
    expect(getCommandBarActions(true)).toEqual([
      'new',
      'save',
      'saveAs',
      'importLineItems',
      'exportCsv',
      'exportCsvTemplate',
      'importJson',
      'exportJson',
      'loadLatest',
      'exportPdf',
      'logo',
    ])
  })

  it('hides fake save actions when native dialogs are unavailable', () => {
    expect(getCommandBarActions(false)).toEqual([
      'new',
      'downloadJson',
      'importLineItems',
      'exportCsv',
      'exportCsvTemplate',
      'importJson',
      'loadLatest',
      'exportPdf',
      'logo',
    ])
  })
})
