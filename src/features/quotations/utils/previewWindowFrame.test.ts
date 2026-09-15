import { describe, expect, it } from 'vitest'

import { calculatePreviewScale, createPreviewWindowFrame } from './previewWindowFrame'

describe('preview window frame', () => {
  it('sizes the initial frame around a portrait page', () => {
    expect(createPreviewWindowFrame({ viewportWidth: 1440, viewportHeight: 960 })).toEqual({
      width: 846,
      height: 912,
      left: 297,
      top: 24,
    })
  })

  it('fits a landscape page within the current desktop viewport', () => {
    expect(createPreviewWindowFrame({
      viewportWidth: 1366,
      viewportHeight: 768,
      pageWidth: 1123,
      pageHeight: 794,
    })).toEqual({
      width: 1175,
      height: 720,
      left: 96,
      top: 24,
    })

    expect(createPreviewWindowFrame({
      viewportWidth: 1180,
      viewportHeight: 760,
      pageWidth: 1123,
      pageHeight: 794,
    })).toEqual({
      width: 1132,
      height: 712,
      left: 24,
      top: 24,
    })
  })

  it('calculates proportional fit-width and fit-page scales', () => {
    const base = {
      pageWidth: 1000,
      pageHeight: 800,
      availableWidth: 750,
      availableHeight: 400,
    }

    expect(calculatePreviewScale({ ...base, mode: 'fit-width' })).toBe(0.75)
    expect(calculatePreviewScale({ ...base, mode: 'fit-page' })).toBe(0.5)
    expect(calculatePreviewScale({ ...base, mode: 'actual-size' })).toBe(1)
  })
})
