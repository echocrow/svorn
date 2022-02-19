import { Observer as RxObserver, Subject } from 'rxjs'
import { isEmpty, stringify, toRxObserver } from 'src/utils'
import type { Writable as SvelteWritable } from 'svelte/store'

describe('isEmpty', () => {
  it.each([{ key: 'value' }, { '': '' }, [0]])(
    'detects non-empty objects (%j)',
    (o) => expect(isEmpty(o)).toBe(false),
  )

  it.each([{}, []])('detects empty objects (%j)', (o) =>
    expect(isEmpty(o)).toBe(true),
  )
})

describe('stringify', () => {
  it.each(['', '0', 'a', 'foobar', '123'])(
    'keeps strings as is ("%s")',
    (s) => {
      expect(stringify(s)).toBe(s)
    },
  )

  it.each([
    [0, '0'],
    [1, '1'],
    [42, '42'],
    [-123, '-123'],
    [456.789, '456.789'],
    [9_999_999, '9999999'],
    [NaN, 'NaN'],
  ])('casts numbers (%d)', (n, s) => {
    expect(stringify(n)).toBe(s)
  })

  it.each([
    [true, 'true'],
    [false, 'false'],
  ])('casts booleans (%s)', (b, s) => {
    expect(stringify(b)).toBe(s)
  })

  it('casts null', () => expect(stringify(null)).toBe('null'))

  it('casts undefined to empty string', () =>
    expect(stringify(undefined)).toBe(''))

  it('throws when passed an invalid argument', () => {
    expect(() => stringify({} as unknown as string)).toThrow()
  })
})

describe('toRxObserver', () => {
  it('supports a next callback', () => {
    const next = jest.fn()
    const got = toRxObserver(next)
    expect(got).toMatchObject({
      next: expect.any(Function),
    })
    expect(next).not.toBeCalled()
    got.next?.('foobar')
    expect(next).toBeCalledWith('foobar')
  })

  it('supports a Svelte "writable"', () => {
    const svelteWritable: SvelteWritable<unknown> = {
      set: jest.fn(),
      update: jest.fn(),
      subscribe: jest.fn(),
    }
    const got = toRxObserver(svelteWritable)
    expect(got).toMatchObject({
      next: expect.any(Function),
    })
    expect(svelteWritable.set).not.toBeCalled()
    expect(svelteWritable.update).not.toBeCalled()
    expect(svelteWritable.subscribe).not.toBeCalled()

    got.next?.('cybernetically enhanced')
    expect(svelteWritable.set).toBeCalledWith('cybernetically enhanced')
    expect(svelteWritable.update).not.toBeCalled()
    expect(svelteWritable.subscribe).not.toBeCalled()
  })

  it('supports an RxJS observer object as-is', () => {
    const observer: RxObserver<unknown> = {
      next: jest.fn(),
      error: jest.fn(),
      complete: jest.fn(),
    }
    const got = toRxObserver(observer)
    expect(got).toBe(observer)
  })

  it('supports an RxJS observer instance as-is', () => {
    const observer = new Subject()
    const got = toRxObserver(observer)
    expect(got).toBe(observer)
  })

  it.each([null, undefined])(
    'casts null/undefined to empty observer (%s)',
    (empty) => expect(toRxObserver(empty)).toEqual({}),
  )
})
