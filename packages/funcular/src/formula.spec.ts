import parse from './parse'
import resolve from './resolve'
import {
  type CellValues,
  CircularDepErr,
  DivZeroErr,
  FuncArgsErr,
  FuncNameErr,
  ParseErr,
  RuntimeErr,
  ValErr,
} from './values'

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
    expectParseResolve('').toBe(null)
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
      ['true', true],
      ['tRuE', true],
      ['FALSE', false],
      ['false', false],
      ['fAlsE', false],
      ['TRUEfoo', 'TRUEfoo'],
      ['0', 0],
      ['42', 42],
      ['0.123', 0.123],
      ['0000.5', 0.5],
      ['.75', 0.75],
      ['-.101', -0.101],
      ['100.', 100],
      ['.', '.'],
      ['1.0.0', '1.0.0'],
      ['1..0', '1..0'],
      ['prefix8', 'prefix8'],
      ['16suffix', '16suffix'],
      ['12.34', 12.34],
      ['-12.34', -12.34],
      ['-3e2', -300],
      ['9000%', 90],
      ['01%', 0.01],
      ['-.1%', -0.001],
      ['10%%', '10%%'],
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
      ['=0.1', 0.1],
      ['=000.101', 0.101],
      ['=.5', 0.5],
      ['=4.', 4],
      ['=-8', -8],
      ['=50%', 0.5],
      ['=""', ''],
      ['="foo"', 'foo'],
      ['="fizz buzz"', 'fizz buzz'],
      ['="multi\nline"', 'multi\nline'],
      ['=TRUE', true],
      ['=true', true],
      ['=True', true],
      ['=FALSE', false],
      ['=false', false],
      ['=False', false],
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
      ['=Z1+2', 2],
      ['=4+Z1', 4],
      ['=Y1+Z1', 0],
      ['=Z1*123', 0],
      ['=7/Z1', DivZeroErr],
      ['=Z1/7', 0],
      ['=Z1**4', 0],
      ['=4**Z1', 1],
      ['=Y1**Z1', 1],
    ])('resolves empty cell operations %s => %j', (input, want) =>
      expectParseResolve(input).toBe(want),
    )
    it.each([
      ['=4<5', true],
      ['=10<1', false],
      ['=TRUE<TRUE', false],

      ['=1<=1', true],
      ['=-1<=1', true],
      ['=1<=-1', false],
      ['=TRUE<=TRUE', true],

      ['=5>4', true],
      ['=1>10', false],
      ['=TRUE>TRUE', false],

      ['=1>=1', true],
      ['=1>=-1', true],
      ['=-1>=1', false],
      ['=TRUE>=TRUE', true],

      ['=123=123', true],
      ['=123=124', false],
      ['=""=""', true],
      ['=0=0', true],
      ['=0=-0', true],
      ['=""=0', false],
      ['=0=""', false],
      ['=TRUE=TRUE', true],
      ['=TRUE=FALSE', false],

      ['=123!=123', false],
      ['=123!=124', true],
      ['=0!=0', false],
      ['=0!=""', true],
      ['=123<>123', false],
      ['=123<>124', true],
      ['=0<>0', false],
      ['=0<>""', true],
      ['=TRUE!=TRUE', false],
      ['=TRUE!=FALSE', true],

      ['=4<5=TRUE<>FALSE', true],
      ['=4<5<>FALSE=TRUE', true],

      ['=FALSE<TRUE', true],
      ['=TRUE<FALSE', false],
      ['=0<TRUE', true],
      ['=0<=TRUE', true],
      ['="a"<"b"', true],
      ['="a"<"a"', false],
      ['="z"<"y"', false],
      ['="A"<"b"', true],

      ['="foo"="foo"', true],
      ['="foo"="bar"', false],
      ['="BAR"="bar"', true],
      ['="fOoBaR"="fooBAR"', true],

      ['=4<0/0', DivZeroErr],
      ['="a"+1<=0', ValErr],
      ['="a"+1="a"+1', ValErr],
    ])('resolves comparison operators %s => %j', (input, want) =>
      expectParseResolve(input).toBe(want),
    )
    it.each([
      ['=Y1=Z1', true],
      ['=Y1<Z1', false],
      ['=Y1>Z1', false],
      ['=Y1<=Z1', true],
      ['=Y1>=Z1', true],
      ['=Y1!=Z1', false],

      ['=Z1=0', true],
      ['=Z1<0', false],
      ['=Z1>0', false],
      ['=Z1<=0', true],
      ['=Z1>=0', true],
      ['=Z1!=0', false],

      ['=0=Z1', true],
      ['=0<Z1', false],
      ['=0>Z1', false],
      ['=0<=Z1', true],
      ['=0>=Z1', true],
      ['=0!=Z1', false],

      ['=Z1=""', true],
      ['=Z1<""', false],
      ['=Z1>""', false],
      ['=Z1<=""', true],
      ['=Z1>=""', true],
      ['=Z1!=""', false],

      ['=Z1=FALSE', true],
      ['=Z1=TRUE', false],
      ['=Z1="0"', false],

      ['=Z1=1', false],
      ['=Z1<1', true],
      ['=Z1>1', false],
      ['=Z1<=1', true],
      ['=Z1>=1', false],
      ['=Z1!=1', true],

      ['=Z1=-1', false],
      ['=Z1<-1', false],
      ['=Z1>-1', true],
      ['=Z1<=-1', false],
      ['=Z1>=-1', true],
      ['=Z1!=-1', true],
    ])('resolves empty cell comparisons %s => %j', (input, want) =>
      expectParseResolve(input).toBe(want),
    )
    it.each([
      ['=(1+2)*3', 9],
      ['=10-(1-2)', 11],
      ['=2*(3+4)', 14],
      ['=(10-4)/2', 3],
      ['=(2+4)**(4/2)', 36],
      ['=2**(2*(1+2)+1)', 128],

      ['=(4<5)=(0<1)', true],
      ['=(4<5)<>(0<1)', false],
      ['=(4<5)<>(0>1)', true],
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

    it.each([
      [ValErr, '#VALUE!'],
      [DivZeroErr, '#DIV/0!'],
      [RuntimeErr, '#ERROR!'],
      [ParseErr, '#ERROR!'],
      [FuncNameErr, '#NAME?'],
      [FuncArgsErr, '#N/A'],
      [CircularDepErr, '#REF!'],
    ])('formats error %s => %j', (err, msg) => expect(`${err}`).toBe(msg))

    describe('functions', () => {
      it.each(['=AAAAAAAA()', '=AAAAAAAA(1, 2, 3)'])(
        'returns error when function does not exist %s',
        (input) => expectParseResolve(input).toBe(FuncNameErr),
      )

      describe('if', () => {
        it.each([
          ['=IF(TRUE, 4, 5)', 4],
          ['=IF(FALSE, 4, 5)', 5],
          ['=IF(1, "yes", "no")', 'yes'],
          ['=IF(0, "yes", "no")', 'no'],
          ['=IF("txt", TRUE, FALSE)', true],
          ['=IF("", TRUE, FALSE)', false],
          ['=IF(B1, C1, C2)', 1],
          ['=IF(B2, C1, C2)', 2],
          ['=IF(C1-1, "foo", "bar")', 'bar'],
          ['=IF(C2-1, "foo", "bar")', 'foo'],
          ['=IF(TRUE, 1, 0/0)', 1],
          ['=IF(Z9, "foo"+2, 2)', 2],

          ['=IF(TRUE, "foo"+2, "")', ValErr],
          ['=IF(FALSE, 1, 0/0)', DivZeroErr],

          ['=IF("bar"+2, 3, 4)', ValErr],
          ['=IF(0/0, 3, 4)', DivZeroErr],
          ['=IF(AAAAAAAA(), 3, 4)', FuncNameErr],
          ['=IF(TRUE, 3, 0/0)', 3],
          ['=IF(FALSE, 0/0, 3)', 3],
          ['=IF(TRUE, 0/0, 3)', DivZeroErr],
          ['=IF(FALSE, 3, 0/0)', DivZeroErr],

          ['=IF()', FuncArgsErr],
          ['=IF(1, 2, 3, 4)', FuncArgsErr],

          ['=IF(TRUE, "a")', 'a'],
          ['=IF(FALSE, "a")', ''],
        ])('resolves %s => %j', (input, want) =>
          expectParseResolve(input, {
            B1: true,
            B2: false,
            C1: 1,
            C2: 2,
          }).toBe(want),
        )
      })

      describe('not', () => {
        it.each([
          ['=NOT(0)', true],
          ['=NOT(1)', false],
          ['=NOT(-0)', true],

          ['=NOT(TRUE)', false],
          ['=NOT(FALSE)', true],

          ['=NOT("")', true],
          ['=NOT("foo")', false],

          ['=NOT(Z9)', true],

          ['=NOT(0/0)', DivZeroErr],

          ['=NOT()', FuncArgsErr],
          ['=NOT(1, 2)', FuncArgsErr],
        ])('resolves %s => %j', (input, want) =>
          expectParseResolve(input, {
            B1: true,
            B2: false,
            C1: 1,
            C2: 2,
          }).toBe(want),
        )
      })

      describe('abs', () => {
        it.each([
          ['=ABS(0)', 0],
          ['=ABS(-0)', 0],
          ['=ABS(1)', 1],
          ['=ABS(-1)', 1],

          ['=ABS(FALSE)', 0],
          ['=ABS(TRUE)', 1],

          ['=ABS("")', 0],
          ['=ABS("foo")', ValErr],
          ['=ABS(0/0)', DivZeroErr],
          ['=ABS(Z9)', 0],

          ['=ABS()', FuncArgsErr],
          ['=ABS(1, 2)', FuncArgsErr],
        ])('resolves %s => %j', (input, want) =>
          expectParseResolve(input, {
            B1: true,
            B2: false,
            C1: 1,
            C2: 2,
          }).toBe(want),
        )
      })

      describe('floor', () => {
        it.each([
          ['=FLOOR(4)', 4],
          ['=FLOOR(11.5)', 11],
          ['=FLOOR(0.001)', 0],
          ['=FLOOR(-1.2)', -2],
          ['=FLOOR(-1.9)', -2],

          ['=FLOOR(1.23456, 0.1)', 1.2],
          ['=FLOOR(1.23456, 0.02)', 1.22],
          ['=FLOOR(1.23456, 0.5)', 1],
          ['=FLOOR(1.23456, 0.0005)', 1.2345],

          ['=FLOOR(FALSE)', 0],
          ['=FLOOR("")', 0],
          ['=FLOOR(TRUE)', 1],

          ['=FLOOR("txt")', ValErr],
          ['=FLOOR("txt", 2)', ValErr],
          ['=FLOOR(2, "txt")', ValErr],
          ['=FLOOR(0/0)', DivZeroErr],
          ['=FLOOR(0/0, 4)', DivZeroErr],
          ['=FLOOR(0/0, "txt")', DivZeroErr],
          ['=FLOOR(4, 0/0)', DivZeroErr],
          ['=FLOOR("txt", 0/0)', DivZeroErr],
          ['=FLOOR(AAAAAAAA())', FuncNameErr],

          ['=FLOOR()', FuncArgsErr],
          ['=FLOOR(1, 2, 3)', FuncArgsErr],
        ])('resolves %s => %j', (input, want) =>
          expectParseResolve(input, {
            B1: true,
            B2: false,
            C1: 1,
            C2: 2,
          }).toBe(want),
        )
      })
      describe('ceiling', () => {
        it.each([
          ['=CEILING(4)', 4],
          ['=CEILING(11.5)', 12],
          ['=CEILING(0.001)', 1],
          ['=CEILING(-1.2)', -1],
          ['=CEILING(-1.9)', -1],

          ['=CEILING(1.23456, 0.1)', 1.3],
          ['=CEILING(1.23456, 0.02)', 1.24],
          ['=CEILING(1.23456, 0.5)', 1.5],
          ['=CEILING(1.23456, 0.0005)', 1.235],

          ['=CEILING(FALSE)', 0],
          ['=CEILING("")', 0],
          ['=CEILING(TRUE)', 1],

          ['=CEILING("txt")', ValErr],
          ['=CEILING("txt", 2)', ValErr],
          ['=CEILING(2, "txt")', ValErr],
          ['=CEILING(0/0)', DivZeroErr],
          ['=CEILING(0/0, 4)', DivZeroErr],
          ['=CEILING(0/0, "txt")', DivZeroErr],
          ['=CEILING(4, 0/0)', DivZeroErr],
          ['=CEILING("txt", 0/0)', DivZeroErr],
          ['=CEILING(AAAAAAAA())', FuncNameErr],

          ['=CEILING()', FuncArgsErr],
          ['=CEILING(1, 2, 3)', FuncArgsErr],
        ])('resolves %s => %j', (input, want) =>
          expectParseResolve(input, {
            B1: true,
            B2: false,
            C1: 1,
            C2: 2,
          }).toBe(want),
        )
      })
      describe('round', () => {
        it.each([
          ['=ROUND(4)', 4],
          ['=ROUND(11.4999)', 11],
          ['=ROUND(11.5)', 12],
          ['=ROUND(0.001)', 0],
          ['=ROUND(-2.34)', -2],
          ['=ROUND(-7.89)', -8],

          ['=ROUND(4, 2)', 4],
          ['=ROUND(1.23456, 2)', 1.23],
          ['=ROUND(1.23456, 3)', 1.235],
          ['=ROUND(11.4999, 2)', 11.5],

          ['=ROUND(Z1, 2)', 0],
          ['=ROUND(12.34, Z1)', 12],

          ['=ROUND(123456, -2)', 123500],
          ['=ROUND(123456, -2.1)', 123500],
          ['=ROUND(123456, -2.99)', 123500],
          ['=ROUND(123456, -4)', 120000],
          ['=ROUND(123456, -4.5)', 120000],

          ['=ROUND(FALSE)', 0],
          ['=ROUND("")', 0],
          ['=ROUND(TRUE)', 1],

          ['=ROUND("txt")', ValErr],
          ['=ROUND("txt", 2)', ValErr],
          ['=ROUND(2, "txt")', ValErr],
          ['=ROUND(0/0)', DivZeroErr],
          ['=ROUND(0/0, 4)', DivZeroErr],
          ['=ROUND(0/0, "txt")', DivZeroErr],
          ['=ROUND(4, 0/0)', DivZeroErr],
          ['=ROUND("txt", 0/0)', DivZeroErr],
          ['=ROUND(AAAAAAAA())', FuncNameErr],

          ['=ROUND()', FuncArgsErr],
          ['=ROUND(1, 2, 3)', FuncArgsErr],
        ])('resolves %s => %j', (input, want) =>
          expectParseResolve(input, {
            B1: true,
            B2: false,
            C1: 1,
            C2: 2,
          }).toBe(want),
        )
      })

      describe('mod', () => {
        it.each([
          ['=MOD(1, 0)', DivZeroErr],
          ['=MOD(1, 1)', 0],
          ['=MOD(123, 7)', 4],

          ['=MOD(0, 8)', 0],
          ['=MOD(-0, 8)', 0],
          ['=MOD(0, -8)', 0],
          ['=MOD(-0, -8)', 0],

          ['=MOD(-10, 3)', 2],
          ['=MOD(23, -4)', -1],
          ['=MOD(-40, -7)', -5],

          ['=MOD(TRUE, 2)', 1],
          ['=MOD(FALSE, 3)', 0],

          ['=MOD()', FuncArgsErr],
          ['=MOD(1, 2, 3)', FuncArgsErr],
        ])('resolves %s => %j', (input, want) =>
          expectParseResolve(input, {
            B1: true,
            B2: false,
            C1: 1,
            C2: 2,
          }).toBe(want),
        )
      })
    })
  })
})
