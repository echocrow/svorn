import type { CellValues } from '#lib/cells'

import parse from './parse'
import resolve, { DivZeroErr, ParseErr, ValErr } from './resolve'

const expectEmptyArray = (val: unknown) => expect(val).toEqual([])

const expectParseResolve = (input: string, values: CellValues = {}) => {
  const parsed = parse(input)
  const resolved = resolve(parsed, values)
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
      ['a\nb\nc', 'a\nb\nc'],
      ['TRUE', true],
      ['FALSE', false],
      ['TRUEfoo', 'TRUEfoo'],
      ['0', 0],
      ['42', 42],
      ['prefix8', 'prefix8'],
      ['16suffix', '16suffix'],
      ['12.34', 12.34],
      ['-12.34', -12.34],
      ['-3e2', -300],
      ['+1', 1],
      ['--3', 3],
      ['--++3', 3],
      ['-+-+-+3', -3],
      ['+', '+'],
      ['-', '-'],
      ['+-+', '+-+'],
      ['(8)', -8],
      ['(12.5)', -12.5],
      ['(1e2)', -100],
      ['(1e2))foo', '(1e2))foo'],
      ['(+8)', '(+8)'],
      ['(-8)', '(-8)'],
      ['((8))', '((8))'],
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
      expectParseResolve(input).toBe(want),
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
      expectParseResolve(input).toBe(want),
    )
    it.each([
      ['=(1+2)*3', 9],
      ['=10-(1-2)', 11],
      ['=2*(3+4)', 14],
      ['=(10-4)/2', 3],
      ['=(2+4)**(4/2)', 36],
      ['=2**(2*(1+2)+1)', 128],
    ])('resolves brackets first %s => %j', (input, want) =>
      expectParseResolve(input).toBe(want),
    )
    it.each([
      ['=+1', 1],
      ['=++5', 5],
      ['=+++4', 4],
      ['=++++8', 8],
      ['=-2', -2],
      ['=+-3', -3],
      ['=+--1', 1],
      ['=-+-+-8', -8],
      ['=11*-2', -22],
      ['=11*--3', 33],
      ['=--++-(2*(2--4))', -12],
    ])('supports consecutive +/- operators %s => %j', (input, want) =>
      expectParseResolve(input).toBe(want),
    )

    it.each([
      ['=""+""', ''],
      ['="a"+"B"+"c"', 'aBc'],
    ])('resolves basic text manipulation %s => %j', (input, want) =>
      expectParseResolve(input).toBe(want),
    )

    it.each([
      ['=""""', '"'],
      ['=""""""', '""'],
      ['="foo""bar"', 'foo"bar'],
      ['="foo""""""bar"', 'foo"""bar'],
    ])('resolves escaped double-quotes in strings %s => %j', (input, want) =>
      expectParseResolve(input).toBe(want),
    )

    it.each([
      ['=5+""', 5],
      ['=5+FALSE', 5],
      ['=5+TRUE', 6],
      ['=5-""', 5],
      ['=5-FALSE', 5],
      ['=5-TRUE', 4],
      ['=-""', -0],
      ['=-FALSE', -0],
      ['=-TRUE', -1],
      ['=""*100', 0],
      ['=FALSE*100', 0],
      ['=TRUE*100', 100],
      ['=""/2', 0],
      ['=8/TRUE', 8],
      ['=FALSE/TRUE', 0],
      ['=4**""', 1],
      ['=4**FALSE', 1],
      ['=4**TRUE', 4],
      ['=""**4', 0],
      ['=TRUE*TRUE', 1],
      ['=""--""', 0],
      ['=""-TRUE', -1],
      ['=(""-TRUE)', -1],
      ['=(FALSE-"")**TRUE', 0],
      ['=-+-(++""---TRUE)-FALSE', -1],
    ])('resolves num-like values in calc %s => %j', (input, want) =>
      expectParseResolve(input).toBe(want),
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
      ['=-"foo"'],
      ['="Zz"*3'],
      ['=2*"soon"'],
      ['="n"*0'],
      ['="t"*"t"*"t"'],
      ['="div"/2'],
      ['="pow"**"pow"'],
    ])('returns value error in invalid calc %s', (input) =>
      expectParseResolve(input).toBe(ValErr),
    )
    it.each([['=4/0'], ['=0/0'], ['=(4-4)/(8-8)'], ['=42/""']])(
      'returns div/0 error when dividing by zero %s',
      (input) => expectParseResolve(input).toBe(DivZeroErr),
    )
    it.each([
      ['="foo"+5/0', DivZeroErr],
      ['="foo"-5/0', DivZeroErr],
      ['="foo"*(5/0)', DivZeroErr],
      ['="foo"/(5/0)', DivZeroErr],
      ['="foo"**(5/0)', DivZeroErr],
      ['=5/0+"foo"', DivZeroErr],
      ['=5/0-"foo"', DivZeroErr],
      ['=5/0*"foo"', DivZeroErr],
      ['=5/0/"foo"', DivZeroErr],
      ['="foo"+TRUE+5/0', ValErr],
    ])('tracks and propagates errors in calc %s => %s', (input, err) =>
      expectParseResolve(input).toBe(err),
    )

    it.each([
      '=',
      '==',
      '="',
      '=5+',
      '=()',
      '="foo""',
      '="foo"bar"',
      '="foo\\"bar"',
      '="foo"""bar"',
    ])('returns ParseErr on invalid input %s => %j', (input) =>
      expectParseResolve(input).toBe(ParseErr),
    )

    it.todo('formulas')
  })
})
