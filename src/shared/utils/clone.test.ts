import { describe, expect, it, vi } from 'vitest'
import { isReactive, reactive, shallowReactive } from 'vue'

import { cloneSerializable } from './clone'

describe('cloneSerializable', () => {
  it('detaches nested records and arrays, including repeated object references', () => {
    const item = { details: [{ description: 'Original', quantity: 2 }] }
    const source = { current: item, revisions: [item] }

    const cloned = cloneSerializable(source)
    cloned.current.details[0]!.description = 'Edited'
    cloned.revisions[0]!.details.push({ description: 'Added', quantity: 1 })

    expect(source.current.details).toEqual([{ description: 'Original', quantity: 2 }])
    expect(cloned.revisions[0]!.details[0]!.description).toBe('Original')
    expect(cloned.current.details).toHaveLength(1)
    expect(cloned.current).not.toBe(cloned.revisions[0])
  })

  it('copies Vue state with nested reactive proxies into plain detached data', () => {
    const source = shallowReactive({
      header: reactive({ customerCompany: 'Customer' }),
      majorItems: [reactive({ lines: reactive([{ quantity: 2 }]) })],
    })

    const cloned = cloneSerializable(source)
    expect(cloned).toEqual(source)
    expect(isReactive(cloned)).toBe(false)
    expect(isReactive(cloned.header)).toBe(false)
    expect(isReactive(cloned.majorItems[0]!.lines)).toBe(false)

    cloned.header.customerCompany = 'Edited'
    cloned.majorItems[0]!.lines[0]!.quantity = 5
    expect(source.header.customerCompany).toBe('Customer')
    expect(source.majorItems[0]!.lines[0]!.quantity).toBe(2)
  })

  it('preserves JSON semantics for optional fields, arrays and numeric values', () => {
    const source = {
      note: undefined,
      metadata: { createdAt: '2026-10-15T00:00:00.000Z', updatedAt: undefined },
      values: [undefined, , null, Number.NaN, Number.POSITIVE_INFINITY, -0, 1.25, () => 'ignored', Symbol('ignored')],
      infinity: Number.NEGATIVE_INFINITY,
      text: '报价 "Example"\n\u0000',
      enabled: false,
      ignoredFunction: () => 'ignored',
      ignoredSymbol: Symbol('ignored'),
      [Symbol('hidden')]: 'ignored',
    }
    Object.defineProperty(source, 'hidden', { value: 'ignored', enumerable: false })

    const cloned = cloneSerializable(source)

    expect(cloned).toStrictEqual(JSON.parse(JSON.stringify(source)))
    expect(Object.hasOwn(cloned, 'note')).toBe(false)
    expect(Object.hasOwn(cloned.values, 1)).toBe(true)
    expect(Object.is(cloned.values[5], -0)).toBe(false)
  })

  it('preserves own JSON keys without changing the output prototype', () => {
    const source = JSON.parse('{"__proto__":{"polluted":true},"constructor":{"name":"data"},"prototype":1}')

    const cloned = cloneSerializable(source)

    expect(JSON.stringify(cloned)).toBe(JSON.stringify(source))
    expect(Object.getPrototypeOf(cloned)).toBe(Object.prototype)
    expect(Object.hasOwn(cloned, '__proto__')).toBe(true)
    expect(Object.getOwnPropertyDescriptor(cloned, '__proto__')).toMatchObject({
      enumerable: true, writable: true, configurable: true,
    })
    cloned.__proto__.polluted = false
    expect(source.__proto__.polluted).toBe(true)
  })

  it('copies history whose shared strings would exceed a single JSON buffer', () => {
    const logoDataUrl = `data:image/png;base64,${'A'.repeat(8 * 1024 * 1024)}`
    const source = {
      revisions: Array.from({ length: 128 }, (_, index) => ({
        revisionNumber: index + 1,
        quotation: { branding: { logoDataUrl }, header: { notes: 'Saved note' } },
      })),
    }
    const stringify = vi.spyOn(JSON, 'stringify').mockImplementation(() => {
      throw new Error('Cloning must not serialize the history.')
    })
    let cloned: typeof source
    try {
      cloned = cloneSerializable(source)
    } finally {
      stringify.mockRestore()
    }

    expect(cloned.revisions).toHaveLength(128)
    expect(cloned.revisions.every((revision) => revision.quotation.branding.logoDataUrl === logoDataUrl)).toBe(true)
    cloned.revisions[0]!.quotation.header.notes = 'Edited'
    expect(source.revisions[0]!.quotation.header.notes).toBe('Saved note')
    expect(cloned.revisions[1]!.quotation.header.notes).toBe('Saved note')
  })

  it('rejects cycles and values that cannot be represented as JSON data', () => {
    const circular: { self?: unknown } = {}
    circular.self = circular
    const array: unknown[] = []
    array.push(array)

    expect(() => cloneSerializable(circular)).toThrow('Cannot clone circular JSON data.')
    expect(() => cloneSerializable(reactive(circular))).toThrow('Cannot clone circular JSON data.')
    expect(() => cloneSerializable(array)).toThrow('Cannot clone circular JSON data.')
    expect(() => cloneSerializable({ value: 1n })).toThrow(TypeError)
    expect(() => cloneSerializable(undefined)).toThrow(TypeError)
    expect(() => cloneSerializable(() => 'ignored')).toThrow(TypeError)
    expect(() => cloneSerializable(Symbol('ignored'))).toThrow(TypeError)
  })
})
