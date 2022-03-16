import type { CellValues } from '$lib/cells'

import parse from './parse'
import resolve, { ValErr } from './resolve'

const expectEmptyArray = (val: unknown) => expect(val).toEqual([])

const expectParseResolve = (input: string, values: CellValues = {}) => {
  const parsed = parse(input)
  expectEmptyArray(parsed.lexErrors)
  expectEmptyArray(parsed.parseErrors)
  const resolved = resolve(parsed.cst, values)
  return expect(resolved)
}

describe('parse', () => {
  it.each([
    ['', []],
    ['=A1', ['A1']],
    ['=B2*A3', ['B2', 'A3']],
    ['=Z1-Z1-Z1', ['Z1']],
    ['=0', []],
    ['="A1"', []],
    ["'=A1", []],
  ])('lists dependencies %s => %s', (input, want) =>
    expect(parse(input).cells).toEqual(new Set(want)),
  )
})

describe('parse & resolve', () => {
  it('resolves empty text', () => {
    expectParseResolve('').toBe('')
  })

  describe('plain text', () => {
    it.each([
      ["'", ''],
      ["'foobar", 'foobar'],
      ["'s p a c e d", 's p a c e d'],
      ["'123", '123'],
      ["'TRUE", 'TRUE'],
      ["'NULL", 'NULL'],
      ["'multi\nline", 'multi\nline'],
    ])('resolves %j => %j', (input, want) =>
      expectParseResolve(input).toBe(want),
    )
  })

  describe('magic text', () => {
    it.each([
      ['foobar', 'foobar'],
      ['some space', 'some space'],
      ['TRUE', true],
      ['FALSE', false],
      ['0', 0],
      ['42', 42],
      ['12.34', 12.34],
      ['-12.34', -12.34],
      ['-3e2', -300],
      ['(8)', -8],
      ['(-8)', 8],
      ['a\nb\nc', 'a\nb\nc'],
    ])('resolves %j => %j', (input, want) =>
      expectParseResolve(input).toBe(want),
    )
  })

  describe('formula', () => {
    it.each([
      ['=0', 0],
      ['=123', 123],
      ['=""', ''],
      ['="foo"', 'foo'],
      ['="fizz buzz"', 'fizz buzz'],
      ['="multi\nline"', 'multi\nline'],
      ['=TRUE', true],
      ['=FALSE', false],
    ])('resolves %j => %j', (input, want) =>
      expectParseResolve(input).toBe(want),
    )

    it.each([
      ['=A1', ''],
      ['=B5', 11],
      ['=ABC78', 'a'],
    ])('resolves cell values (%#)', (input, want) =>
      expectParseResolve(input, {
        A1: '',
        B5: 11,
        ABC78: 'a',
      }).toBe(want),
    )

    it.each([
      ['=1+2', 3],
      ['=100-1', 99],
      ['=7*7', 49],
      ['=8/16', 0.5],
      ['=2**9', 512],
    ])('resolves basic math %s => %j', (input, want) =>
      expectParseResolve(input, {
        A1: '',
        B5: 11,
        ABC78: 'a',
      }).toBe(want),
    )
    it.each([
      ['=1+2*3', 7],
      ['=1-2+3-4+5', 3],
      ['=2*3+4', 10],
      ['=4/2*3', 6],
      ['=9*2/3', 6],
      ['=10-4/2', 8],
      ['=2+4**3/8', 10],
      ['=2**10-24', 1000],
    ])('resolves math operators in correct order %s => %j', (input, want) =>
      expectParseResolve(input, {
        A1: '',
        B5: 11,
        ABC78: 'a',
      }).toBe(want),
    )
    it.each([
      ['=(1+2)*3', 9],
      ['=10-(1-2)', 11],
      ['=2*(3+4)', 14],
      ['=(10-4)/2', 3],
      ['=(2+4)**(4/2)', 36],
      ['=2**(2*(1+2)+1)', 128],
    ])('resolves brackets first %s => %j', (input, want) =>
      expectParseResolve(input, {
        A1: '',
        B5: 11,
        ABC78: 'a',
      }).toBe(want),
    )

    it.each([
      ['="a"+"B"+"c"', 'aBc'],
      ['="Zz"*3', 'ZzZzZz'],
      ['=2*"soon"', 'soonsoon'],
      ['="n"*0', ''],
    ])('resolves basic text manipulation %s => %j', (input, want) =>
      expectParseResolve(input, {
        A1: '',
        B5: 11,
        ABC78: 'a',
      }).toBe(want),
    )

    it.each([
      ['=1 + 2', 3],
      ['=   5*   (2 +3 )   ', 25],
      ['="a " + "b" + " " + "c" + " d" ', 'a b c d'],
    ])('discards arbitrary spaces %s => %j', (input, want) =>
      expectParseResolve(input).toBe(want),
    )

    it.each([['=2 * (A12 - (C8 - B3)) / 4', 3]])(
      'resolves complex formulas %s => %j',
      (input, want) =>
        expectParseResolve(input, {
          A12: 12,
          B3: 4,
          C8: 10,
        }).toBe(want),
    )

    it.each([
      ['="a"+5'],
      ['=0-"z"'],
      ['="t"*"t"*"t"'],
      ['="div"/2'],
      ['="pow"**"pow"'],
    ])('returns value error on invalid calculation %s', (input) =>
      expectParseResolve(input).toBe(ValErr),
    )
  })
})
