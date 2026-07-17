export type CommandBarAction =
  | 'new'
  | 'save'
  | 'saveAs'
  | 'downloadJson'
  | 'importLineItems'
  | 'exportCsv'
  | 'exportCsvTemplate'
  | 'importJson'
  | 'exportJson'
  | 'loadLatest'
  | 'exportPdf'
  | 'logo'

export function getCommandBarActions(hasNativeFileDialogs: boolean): CommandBarAction[] {
  if (hasNativeFileDialogs) {
    return [
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
    ]
  }

  return ['new', 'downloadJson', 'importLineItems', 'exportCsv', 'exportCsvTemplate', 'importJson', 'loadLatest', 'exportPdf', 'logo']
}
