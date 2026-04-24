export type CommandBarAction =
  | 'new'
  | 'save'
  | 'saveAs'
  | 'downloadJson'
  | 'importJson'
  | 'exportJson'
  | 'loadLatest'
  | 'print'
  | 'logo'

export function getCommandBarActions(hasNativeFileDialogs: boolean): CommandBarAction[] {
  if (hasNativeFileDialogs) {
    return ['new', 'save', 'saveAs', 'importJson', 'exportJson', 'loadLatest', 'print', 'logo']
  }

  return ['new', 'downloadJson', 'importJson', 'loadLatest', 'print', 'logo']
}
