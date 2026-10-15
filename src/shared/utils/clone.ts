/** Copy JSON-shaped state without expanding shared strings into one JSON buffer. */
export function cloneSerializable<T>(value: T): T {
  const ancestors = new Set<object>()

  function copy(input: unknown): unknown {
    if (input === null || typeof input === 'string' || typeof input === 'boolean') return input
    if (typeof input === 'number') return Number.isFinite(input) ? (input === 0 ? 0 : input) : null
    if (typeof input === 'bigint') throw new TypeError('Cannot clone a BigInt value as JSON data.')
    if (typeof input !== 'object') return undefined
    if (ancestors.has(input)) throw new TypeError('Cannot clone circular JSON data.')
    ancestors.add(input)

    let result: unknown
    if (Array.isArray(input)) {
      const array: unknown[] = []
      for (let index = 0; index < input.length; index += 1) {
        array.push(copy(input[index]) ?? null)
      }
      result = array
    } else {
      const record: Record<string, unknown> = {}
      for (const key of Object.keys(input)) {
        const entry = copy((input as Record<string, unknown>)[key])
        if (entry !== undefined) {
          // Define own data properties so a JSON key like __proto__ stays data.
          Object.defineProperty(record, key, { value: entry, enumerable: true, writable: true, configurable: true })
        }
      }
      result = record
    }

    ancestors.delete(input)
    return result
  }

  const result = copy(value)
  if (result === undefined) throw new TypeError('Cannot clone an unsupported root value as JSON data.')
  return result as T
}
