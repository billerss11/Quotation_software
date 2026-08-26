import {
  AUTOMATION_LIMITS,
  getBase64DecodedByteLength,
  getMaximumBase64Length,
} from '../contracts/automationLimits.js'

type SupportedLogoMimeType = 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp'

export type LogoDataUrlValidationResult =
  | {
      ok: true
      mimeType: SupportedLogoMimeType
      byteLength: number
      width: number
      height: number
    }
  | {
      ok: false
      code: 'invalid_image' | 'input_too_large' | 'image_dimensions_too_large'
      message: string
    }

export function validateLogoDataUrl(value: string): LogoDataUrlValidationResult {
  const match = /^data:(image\/(?:png|jpeg|gif|webp));base64,([a-z0-9+/]+={0,2})$/i.exec(value)
  if (!match) return invalidImage('Logo must be a supported base64 image data URL.')

  const mimeType = match[1]!.toLowerCase() as SupportedLogoMimeType
  const base64 = match[2]!
  if (
    base64.length === 0
    || base64.length % 4 !== 0
    || base64.length > getMaximumBase64Length(AUTOMATION_LIMITS.logoBytes)
  ) {
    return base64.length > getMaximumBase64Length(AUTOMATION_LIMITS.logoBytes)
      ? logoTooLarge()
      : invalidImage('Logo base64 encoding is invalid.')
  }

  const byteLength = getBase64DecodedByteLength(base64)
  if (byteLength > AUTOMATION_LIMITS.logoBytes) return logoTooLarge()

  let bytes: Uint8Array
  try {
    const binary = atob(base64)
    bytes = Uint8Array.from(binary, character => character.charCodeAt(0))
  } catch {
    return invalidImage('Logo base64 encoding is invalid.')
  }

  const dimensions = readImageDimensions(bytes, mimeType)
  if (!dimensions) return invalidImage('Logo MIME type does not match valid image bytes.')
  if (
    dimensions.width <= 0
    || dimensions.height <= 0
    || dimensions.width > AUTOMATION_LIMITS.logoDimensionPixels
    || dimensions.height > AUTOMATION_LIMITS.logoDimensionPixels
  ) {
    return {
      ok: false,
      code: 'image_dimensions_too_large',
      message: `Logo dimensions must not exceed ${AUTOMATION_LIMITS.logoDimensionPixels} x ${AUTOMATION_LIMITS.logoDimensionPixels} pixels.`,
    }
  }

  return { ok: true, mimeType, byteLength, ...dimensions }
}

function readImageDimensions(bytes: Uint8Array, mimeType: SupportedLogoMimeType) {
  if (mimeType === 'image/png') return readPngDimensions(bytes)
  if (mimeType === 'image/jpeg') return readJpegDimensions(bytes)
  if (mimeType === 'image/gif') return readGifDimensions(bytes)
  return readWebpDimensions(bytes)
}

function readPngDimensions(bytes: Uint8Array) {
  if (
    bytes.length < 24
    || !hasBytes(bytes, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    || !hasBytes(bytes, 12, [0x49, 0x48, 0x44, 0x52])
  ) return null
  return {
    width: readUint32BigEndian(bytes, 16),
    height: readUint32BigEndian(bytes, 20),
  }
}

function readGifDimensions(bytes: Uint8Array) {
  if (
    bytes.length < 10
    || (!hasAscii(bytes, 0, 'GIF87a') && !hasAscii(bytes, 0, 'GIF89a'))
  ) return null
  return {
    width: bytes[6]! | bytes[7]! << 8,
    height: bytes[8]! | bytes[9]! << 8,
  }
}

function readJpegDimensions(bytes: Uint8Array) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null
  let offset = 2
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1
      continue
    }
    while (bytes[offset] === 0xff) offset += 1
    const marker = bytes[offset]!
    offset += 1
    if (marker === 0xd8 || marker === 0xd9) continue
    if (offset + 1 >= bytes.length) return null
    const segmentLength = bytes[offset]! << 8 | bytes[offset + 1]!
    if (segmentLength < 2 || offset + segmentLength > bytes.length) return null
    if (isJpegStartOfFrame(marker) && segmentLength >= 7) {
      return {
        height: bytes[offset + 3]! << 8 | bytes[offset + 4]!,
        width: bytes[offset + 5]! << 8 | bytes[offset + 6]!,
      }
    }
    offset += segmentLength
  }
  return null
}

function readWebpDimensions(bytes: Uint8Array) {
  if (
    bytes.length < 30
    || !hasAscii(bytes, 0, 'RIFF')
    || !hasAscii(bytes, 8, 'WEBP')
  ) return null
  const chunkType = String.fromCharCode(...bytes.slice(12, 16))
  if (chunkType === 'VP8X') {
    return {
      width: 1 + readUint24LittleEndian(bytes, 24),
      height: 1 + readUint24LittleEndian(bytes, 27),
    }
  }
  if (chunkType === 'VP8L' && bytes[20] === 0x2f) {
    return {
      width: 1 + (bytes[21]! | (bytes[22]! & 0x3f) << 8),
      height: 1 + ((bytes[22]! & 0xc0) >> 6 | bytes[23]! << 2 | (bytes[24]! & 0x0f) << 10),
    }
  }
  if (chunkType === 'VP8 ' && hasBytes(bytes, 23, [0x9d, 0x01, 0x2a])) {
    return {
      width: (bytes[26]! | bytes[27]! << 8) & 0x3fff,
      height: (bytes[28]! | bytes[29]! << 8) & 0x3fff,
    }
  }
  return null
}

function isJpegStartOfFrame(marker: number) {
  return marker >= 0xc0 && marker <= 0xcf
    && marker !== 0xc4
    && marker !== 0xc8
    && marker !== 0xcc
}

function hasAscii(bytes: Uint8Array, offset: number, value: string) {
  return hasBytes(bytes, offset, [...value].map(character => character.charCodeAt(0)))
}

function hasBytes(bytes: Uint8Array, offset: number, expected: number[]) {
  return expected.every((value, index) => bytes[offset + index] === value)
}

function readUint32BigEndian(bytes: Uint8Array, offset: number) {
  return (bytes[offset]! * 0x1000000)
    + (bytes[offset + 1]! << 16)
    + (bytes[offset + 2]! << 8)
    + bytes[offset + 3]!
}

function readUint24LittleEndian(bytes: Uint8Array, offset: number) {
  return bytes[offset]! | bytes[offset + 1]! << 8 | bytes[offset + 2]! << 16
}

function invalidImage(message: string): LogoDataUrlValidationResult {
  return { ok: false, code: 'invalid_image', message }
}

function logoTooLarge(): LogoDataUrlValidationResult {
  return {
    ok: false,
    code: 'input_too_large',
    message: `Logo exceeds the ${AUTOMATION_LIMITS.logoBytes} byte limit.`,
  }
}
