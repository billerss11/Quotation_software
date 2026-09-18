// Real screenshots of the app. Coordinates are percentages of each 1440 × 960 image.
// See docs/user-manual-screenshots.md when refreshing the guide.
export interface ManualFocus {
  x: number
  y: number
  width: number
  height: number
}

export interface ManualStep {
  id: string
  image: string
  focus?: ManualFocus
  focusZh?: ManualFocus
}

export const manualSections: { id: string; steps: ManualStep[] }[] = [
  {
    id: 'open',
    steps: [
      { id: 'open-menu', image: 'open-menu', focus: { height: 3.35, width: 14.08, x: 83.61, y: 10.5 }, focusZh: { height: 3.35, width: 14.08, x: 83.61, y: 10.5 } },
      { id: 'overview', image: 'overview', focus: { height: 6.04, width: 93.06, x: 6.11, y: 1.04 }, focusZh: { height: 6.04, width: 93.06, x: 6.11, y: 1.04 } },
    ],
  },
  {
    id: 'setup',
    steps: [
      { id: 'new-menu', image: 'new-menu', focus: { height: 3.35, width: 14.08, x: 83.61, y: 6.94 }, focusZh: { height: 3.35, width: 14.08, x: 83.61, y: 6.94 } },
      { id: 'quote-info', image: 'quote-info', focus: { height: 61.66, width: 24.36, x: 71.43, y: 29.77 }, focusZh: { height: 61.66, width: 24.36, x: 71.43, y: 29.77 } },
      { id: 'parties', image: 'parties', focus: { height: 54.06, width: 24.36, x: 71.43, y: 29.77 }, focusZh: { height: 50.56, width: 24.36, x: 71.43, y: 29.77 } },
    ],
  },
  {
    id: 'items',
    steps: [
      { id: 'add-item', image: 'add-item', focus: { height: 3.33, width: 7.09, x: 33.11, y: 21.2 }, focusZh: { height: 3.33, width: 6.92, x: 27.81, y: 21.2 } },
      { id: 'edit-item', image: 'edit-item', focus: { height: 33.99, width: 60.44, x: 7.13, y: 57.92 }, focusZh: { height: 32.3, width: 60.44, x: 7.13, y: 59.61 } },
      { id: 'add-child', image: 'add-child', focus: { height: 3.33, width: 9.46, x: 8.05, y: 87.51 }, focusZh: { height: 3.33, width: 6.89, x: 8.05, y: 88.03 } },
      { id: 'hierarchy', image: 'hierarchy', focus: { height: 50.55, width: 60.44, x: 7.13, y: 43.4 }, focusZh: { height: 47.78, width: 60.44, x: 7.13, y: 44.57 } },
    ],
  },
  {
    id: 'pricing',
    steps: [
      { id: 'pricing', image: 'pricing', focus: { height: 24.68, width: 23.49, x: 71.43, y: 36.47 }, focusZh: { height: 23.08, width: 23.49, x: 71.43, y: 36.47 } },
      { id: 'fx', image: 'fx', focus: { height: 22.18, width: 24.36, x: 71.43, y: 29.77 }, focusZh: { height: 22.18, width: 24.36, x: 71.43, y: 29.77 } },
    ],
  },
  {
    id: 'review',
    steps: [
      { id: 'analysis', image: 'analysis', focus: { height: 38.12, width: 91.5, x: 6.39, y: 27.29 }, focusZh: { height: 38.19, width: 91.5, x: 6.39, y: 27.29 } },
      { id: 'preview-options', image: 'preview-options', focus: { height: 36.48, width: 25.48, x: 71.48, y: 54 }, focusZh: { height: 36.48, width: 23.42, x: 71.48, y: 54 } },
      { id: 'preview-document', image: 'preview-document', focus: { height: 95, width: 58.75, x: 20.62, y: 2.5 }, focusZh: { height: 95, width: 58.75, x: 20.62, y: 2.5 } },
    ],
  },
  {
    id: 'save',
    steps: [
      { id: 'save', image: 'save', focus: { height: 3.54, width: 7.28, x: 67.53, y: 2.29 }, focusZh: { height: 3.54, width: 4.91, x: 72.07, y: 2.29 } },
      { id: 'import-quotation', image: 'import-quotation', focus: { height: 3.35, width: 14.08, x: 83.61, y: 25.01 }, focusZh: { height: 3.35, width: 14.08, x: 83.61, y: 25.01 } },
    ],
  },
  {
    id: 'import',
    steps: [
      { id: 'import-dialog', image: 'import-dialog', focus: { height: 51.25, width: 62.5, x: 18.75, y: 24.37 }, focusZh: { height: 51.97, width: 62.5, x: 18.75, y: 24.02 } },
    ],
  },
  {
    id: 'receipt',
    steps: [
      { id: 'receipt-open', image: 'receipt-open', focus: { height: 3.54, width: 8.26, x: 87.39, y: 2.29 }, focusZh: { height: 3.54, width: 7.61, x: 88.04, y: 2.29 } },
      { id: 'receipt-dialog', image: 'receipt-dialog', focus: { height: 80.03, width: 36.08, x: 2.13, y: 19.97 }, focusZh: { height: 79.97, width: 36.08, x: 2.13, y: 20.03 } },
      { id: 'receipt-selection', image: 'receipt-selection', focus: { height: 5.62, width: 36.08, x: 2.13, y: 53.47 }, focusZh: { height: 5.69, width: 36.08, x: 2.13, y: 53.34 } },
      { id: 'receipt-items', image: 'receipt-items', focus: { height: 37.26, width: 36.08, x: 2.13, y: 51.94 }, focusZh: { height: 37.26, width: 36.08, x: 2.13, y: 51.87 } },
    ],
  },
  {
    id: 'settings',
    steps: [
      { id: 'settings', image: 'settings', focus: { height: 3.88, width: 47.14, x: 8.5, y: 67.57 }, focusZh: { height: 3.94, width: 47.14, x: 8.5, y: 63.94 } },
      { id: 'company', image: 'company', focus: { height: 33.33, width: 49.96, x: 48.65, y: 38.94 }, focusZh: { height: 33.33, width: 49.96, x: 48.65, y: 38.94 } },
      { id: 'customers', image: 'customers', focus: { height: 34.21, width: 49.96, x: 48.65, y: 38.91 }, focusZh: { height: 34.28, width: 49.96, x: 48.65, y: 36.88 } },
    ],
  },
]
