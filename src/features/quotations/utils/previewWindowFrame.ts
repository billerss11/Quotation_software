export interface PreviewWindowViewport {
  viewportWidth: number
  viewportHeight: number
  pageWidth?: number
  pageHeight?: number
}

export interface PreviewWindowFrame {
  width: number
  height: number
  left: number
  top: number
}

export type PreviewZoomMode = 'fit-width' | 'actual-size' | 'fit-page'

interface PreviewScaleInput {
  mode: PreviewZoomMode
  pageWidth: number
  pageHeight: number
  availableWidth: number
  availableHeight: number
}

const DEFAULT_PAGE_WIDTH = 794
const DEFAULT_PAGE_HEIGHT = 1123
const WINDOW_VIEWPORT_INSET = 24
const WINDOW_HORIZONTAL_CHROME = 52
const WINDOW_VERTICAL_CHROME = 140
const MIN_WINDOW_WIDTH = 720
const MIN_WINDOW_HEIGHT = 620

export function createPreviewWindowFrame(viewport: PreviewWindowViewport): PreviewWindowFrame {
  const maxWidth = Math.max(1, viewport.viewportWidth - WINDOW_VIEWPORT_INSET * 2)
  const maxHeight = Math.max(1, viewport.viewportHeight - WINDOW_VIEWPORT_INSET * 2)
  const minWidth = Math.min(MIN_WINDOW_WIDTH, maxWidth)
  const minHeight = Math.min(MIN_WINDOW_HEIGHT, maxHeight)
  const pageWidth = viewport.pageWidth ?? DEFAULT_PAGE_WIDTH
  const pageHeight = viewport.pageHeight ?? DEFAULT_PAGE_HEIGHT
  const width = clamp(Math.round(pageWidth + WINDOW_HORIZONTAL_CHROME), minWidth, maxWidth)
  const height = clamp(Math.round(pageHeight + WINDOW_VERTICAL_CHROME), minHeight, maxHeight)

  return {
    width,
    height,
    left: Math.max(WINDOW_VIEWPORT_INSET, Math.round((viewport.viewportWidth - width) / 2)),
    top: Math.max(WINDOW_VIEWPORT_INSET, Math.round((viewport.viewportHeight - height) / 2)),
  }
}

export function calculatePreviewScale(input: PreviewScaleInput) {
  if (input.mode === 'actual-size') {
    return 1
  }

  if (
    input.pageWidth <= 0
    || input.pageHeight <= 0
    || input.availableWidth <= 0
    || input.availableHeight <= 0
  ) {
    return 1
  }

  const widthScale = input.availableWidth / input.pageWidth
  const scale = input.mode === 'fit-page'
    ? Math.min(widthScale, input.availableHeight / input.pageHeight)
    : widthScale

  return Math.max(0.1, Math.round(scale * 10_000) / 10_000)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}
