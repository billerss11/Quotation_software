export interface PreviewWindowViewport {
  viewportWidth: number
  viewportHeight: number
}

export interface PreviewWindowFrame {
  width: number
  height: number
  left: number
  top: number
}

export function createPreviewWindowFrame(viewport: PreviewWindowViewport): PreviewWindowFrame {
  const width = clamp(Math.round(viewport.viewportWidth * 0.76), 720, 1000)
  const height = clamp(Math.round(viewport.viewportHeight * 0.82), 620, 900)

  return {
    width,
    height,
    left: Math.max(24, Math.round((viewport.viewportWidth - width) / 2)),
    top: Math.max(24, Math.round((viewport.viewportHeight - height) / 2)),
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}
