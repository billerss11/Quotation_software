export type CommandBarAction =
  | 'new'
  | 'save'
  | 'saveAs'
  | 'downloadJson'
  | 'importCsv'
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
      'importCsv',
      'exportCsv',
      'exportCsvTemplate',
      'importJson',
      'exportJson',
      'loadLatest',
      'exportPdf',
      'logo',
    ]
  }

  return ['new', 'downloadJson', 'importCsv', 'exportCsv', 'exportCsvTemplate', 'importJson', 'loadLatest', 'exportPdf', 'logo']
}
