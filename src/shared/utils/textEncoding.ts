/**
 * Decodes a binary buffer to a string using encoding auto-detection.
 *
 * Priority:
 * 1. Unicode BOM (UTF-8, UTF-16 LE/BE)
 * 2. Strict UTF-8 validation — if the bytes are valid UTF-8, use it
 * 3. GBK fallback — covers GB2312/GB18030, the dominant encoding for
 *    Chinese text files produced on Windows (e.g. Excel CSV exports)
 */
export function decodeTextBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)

  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(buffer)
  }

  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(buffer)
  }

  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(buffer)
  }

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer)
  } catch {
    return new TextDecoder('gbk').decode(buffer)
  }
}
