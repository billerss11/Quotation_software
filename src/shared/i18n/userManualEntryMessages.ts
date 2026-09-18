export const enUsUserManualEntry = {
  title: 'User Manual',
  description: 'Open the illustrated Microsoft Word guide, search for a task, or upload it to an AI assistant.',
  backToEditor: 'Back to editor',
  format: 'Microsoft Word document',
  currentLanguage: 'Current app language',
  languages: {
    'en-US': 'English guide',
    'zh-CN': 'Simplified Chinese guide',
  },
  actions: {
    open: 'Open guide',
    download: 'Download DOCX',
  },
  statuses: {
    opened: 'Opened {name}.',
    openFailed: 'Could not open the guide: {error}',
  },
}

export const zhCnUserManualEntry = {
  title: '用户手册',
  description: '打开带截图的 Microsoft Word 用户指南，搜索操作说明，或交给 AI 助手阅读。',
  backToEditor: '返回编辑器',
  format: 'Microsoft Word 文档',
  currentLanguage: '当前界面语言',
  languages: {
    'en-US': '英文指南',
    'zh-CN': '简体中文指南',
  },
  actions: {
    open: '打开指南',
    download: '下载 DOCX',
  },
  statuses: {
    opened: '已打开{name}。',
    openFailed: '无法打开指南：{error}',
  },
}
