import { describe, expect, it } from 'vitest'

import { validateLogoDataUrl } from './logoDataUrl'

const ONE_PIXEL_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='

describe('validateLogoDataUrl', () => {
  it('accepts a valid supported image and reports its dimensions', () => {
    expect(validateLogoDataUrl(ONE_PIXEL_PNG)).toEqual({
      ok: true,
      mimeType: 'image/png',
      byteLength: 68,
      width: 1,
      height: 1,
    })
  })

  it('rejects falsely labelled and unsupported images', () => {
    expect(validateLogoDataUrl('data:image/png;base64,aGVsbG8=')).toMatchObject({
      ok: false,
      code: 'invalid_image',
    })
    expect(validateLogoDataUrl('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=')).toMatchObject({
      ok: false,
      code: 'invalid_image',
    })
  })

  it('rejects dimensions above the limit before rendering', () => {
    const pngHeader = Uint8Array.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52,
      0, 0, 0x10, 0x01, 0, 0, 0, 1,
    ])
    const base64 = btoa(String.fromCharCode(...pngHeader))
    expect(validateLogoDataUrl(`data:image/png;base64,${base64}`)).toMatchObject({
      ok: false,
      code: 'image_dimensions_too_large',
    })
  })
})
