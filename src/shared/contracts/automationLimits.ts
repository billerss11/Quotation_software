const MEBIBYTE = 1024 * 1024

export const AUTOMATION_LIMITS = {
  quotationJsonBytes: 10 * MEBIBYTE,
  lineItemsCsvBytes: 10 * MEBIBYTE,
  lineItemsXlsxBytes: 25 * MEBIBYTE,
  logoBytes: 5 * MEBIBYTE,
  logoDimensionPixels: 4096,
  goodsReceiptDraftBytes: 5 * MEBIBYTE,
  batchManifestBytes: 2 * MEBIBYTE,
  batchJobCount: 100,
} as const

export function getBase64DecodedByteLength(value: string) {
  if (value.length === 0) return 0
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0
  return Math.floor(value.length * 3 / 4) - padding
}

export function getMaximumBase64Length(decodedByteLimit: number) {
  return Math.ceil(decodedByteLimit / 3) * 4
}

export function getUtf8ByteLength(value: string) {
  return new TextEncoder().encode(value).byteLength
}
