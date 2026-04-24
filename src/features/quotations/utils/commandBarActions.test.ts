import { describe, expect, it } from 'vitest'

import { getCommandBarActions } from './commandBarActions'

describe('command bar actions', () => {
  it('shows full file actions when native dialogs are available', () => {
    expect(getCommandBarActions(true)).toEqual([
      'new',
      'save',
      'saveAs',
      'importJson',
      'exportJson',
      'loadLatest',
      'print',
      'logo',
    ])
  })

  it('hides fake save actions when native dialogs are unavailable', () => {
    expect(getCommandBarActions(false)).toEqual([
      'new',
      'downloadJson',
      'importJson',
      'loadLatest',
      'print',
      'logo',
    ])
  })
})
