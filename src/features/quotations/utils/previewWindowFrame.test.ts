import { describe, expect, it } from 'vitest'

import { createPreviewWindowFrame } from './previewWindowFrame'

describe('preview window frame', () => {
  it('creates a centered readable preview frame for desktop viewports', () => {
    expect(createPreviewWindowFrame({ viewportWidth: 1440, viewportHeight: 960 })).toEqual({
      width: 1000,
      height: 787,
      left: 220,
      top: 87,
    })
  })

  it('keeps the preview usable on smaller desktop viewports', () => {
    expect(createPreviewWindowFrame({ viewportWidth: 1180, viewportHeight: 760 })).toEqual({
      width: 897,
      height: 623,
      left: 142,
      top: 69,
    })
  })
})
