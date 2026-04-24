export type CommandBarAction =
  | 'new'
  | 'save'
  | 'saveAs'
  | 'downloadJson'
  | 'importCsv'
  | 'exportCsvTemplate'
  | 'importJson'
  | 'exportJson'
  | 'loadLatest'
  | 'print'
  | 'logo'

export function getCommandBarActions(hasNativeFileDialogs: boolean): CommandBarAction[] {
  if (hasNativeFileDialogs) {
    return [
      'new',
      'save',
      'saveAs',
      'importCsv',
      'exportCsvTemplate',
      'importJson',
      'exportJson',
      'loadLatest',
      'print',
      'logo',
    ]
  }

  return ['new', 'downloadJson', 'importCsv', 'exportCsvTemplate', 'importJson', 'loadLatest', 'print', 'logo']
}
