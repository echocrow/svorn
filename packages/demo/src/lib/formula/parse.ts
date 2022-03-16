import {
  type IMultiModeLexerDefinition,
  type TokenType,
  createToken,
  CstParser,
  Lexer,
} from 'chevrotain'

export const NumberLiteralRegEx = /-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/

const EnterFormula = createToken({
  name: 'EnterFormula',
  pattern: '=',
  push_mode: 'formula',
})
const Comma = createToken({ name: 'Comma', pattern: ',' })
const Colon = createToken({ name: 'Colon', pattern: ':' })
const LParen = createToken({ name: 'LParen', pattern: '(' })
const RParen = createToken({ name: 'RParen', pattern: ')' })

const CalcOperator = createToken({
  name: 'CalcOperator',
  pattern: Lexer.NA,
})
export const Plus = createToken({
  name: 'Plus',
  pattern: '+',
  categories: CalcOperator,
})
export const Minus = createToken({
  name: 'Minus',
  pattern: '-',
  categories: CalcOperator,
})
export const Multi = createToken({
  name: 'Multi',
  pattern: '*',
  categories: CalcOperator,
})
export const Div = createToken({
  name: 'Div',
  pattern: '/',
  categories: CalcOperator,
})
export const Pow = createToken({
  name: 'Pow',
  pattern: '**',
  categories: CalcOperator,
})

const FormulaName = createToken({
  name: 'FormulaName',
  pattern: /[A-Z]+/,
})
const StringLiteral = createToken({
  name: 'StringLiteral',
  pattern: /"(:?[^\\"]|\\["\\])*"/,
})
const NumberLiteral = createToken({
  name: 'NumberLiteral',
  pattern: NumberLiteralRegEx,
})
const CellName = createToken({
  name: 'CellName',
  pattern: /[A-Z]+[1-9]\d*/,
})
export const True = createToken({
  name: 'TRUE',
  pattern: 'TRUE',
  longer_alt: FormulaName,
})
export const False = createToken({
  name: 'FALSE',
  pattern: 'FALSE',
  longer_alt: FormulaName,
})
const WhiteSpace = createToken({
  name: 'Whitespace',
  pattern: /\s+/,
  group: Lexer.SKIPPED,
})

const EnterPlainText = createToken({
  name: 'EnterPlainText',
  pattern: "'",
  push_mode: 'plainText',
})
const PlainText = createToken({
  name: 'PlainText',
  pattern: /(?:.|\n)+/,
})

const MagicText = createToken({
  name: 'MagicText',
  pattern: PlainText.PATTERN,
})

const tokenModes: IMultiModeLexerDefinition = {
  modes: {
    formula: [
      WhiteSpace,
      Pow,
      Multi,
      Div,
      Plus,
      Minus,
      CalcOperator,
      True,
      False,
      CellName,
      FormulaName,
      NumberLiteral,
      StringLiteral,
      LParen,
      RParen,
      Comma,
      Colon,
    ],
    plainText: [PlainText],
    input: [EnterFormula, EnterPlainText, MagicText],
  },
  defaultMode: 'input',
}
const lexer = new Lexer(tokenModes, {
  positionTracking: 'onlyOffset',
})

class Parser extends CstParser {
  constructor() {
    super(tokenModes, {
      recoveryEnabled: true,
    })
    this.performSelfAnalysis()
  }

  protected canTokenTypeBeInsertedInRecovery(tokType: TokenType): boolean {
    return tokType === RParen
  }

  protected canTokenTypeBeDeletedInRecovery(): boolean {
    return false
  }

  public parseInput = this.RULE('parseInput', () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.formula) },
      { ALT: () => this.SUBRULE(this.plain) },
      { ALT: () => this.SUBRULE(this.magicText) },
    ])
  })

  private plain = this.RULE('plain', () => {
    this.CONSUME(EnterPlainText)
    this.SUBRULE(this.text, { LABEL: 'text' })
  })

  private text = this.RULE('text', () => {
    this.OPTION(() => this.CONSUME(PlainText))
  })

  private magicText = this.RULE('magicText', () => {
    this.OPTION(() => this.CONSUME(MagicText))
  })

  private formula = this.RULE('formula', () => {
    this.CONSUME(EnterFormula)
    this.SUBRULE(this.calcExpression, { LABEL: 'body' })
  })

  private calcExpression = this.RULE('calcExpression', () => {
    this.SUBRULE(this.atomicExpression, { LABEL: 'lhs' })
    this.MANY(() => {
      this.CONSUME(CalcOperator, { LABEL: 'ops' })
      this.SUBRULE1(this.atomicExpression, { LABEL: 'rhs' })
    })
  })

  private atomicExpression = this.RULE('atomicExpression', () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.parenExpression) },
      { ALT: () => this.SUBRULE(this.functionExpression) },
      { ALT: () => this.CONSUME(CellName) },
      { ALT: () => this.CONSUME(NumberLiteral) },
      { ALT: () => this.CONSUME(StringLiteral) },
      { ALT: () => this.CONSUME(True) },
      { ALT: () => this.CONSUME(False) },
    ])
  })

  private parenExpression = this.RULE('parenExpression', () => {
    this.CONSUME(LParen)
    this.SUBRULE(this.calcExpression, { LABEL: 'inner' })
    this.CONSUME(RParen)
  })

  private functionExpression = this.RULE('functionExpression', () => {
    // @todo Add different (specific) functions.
    this.CONSUME(FormulaName, { LABEL: 'fn' })
    this.CONSUME(LParen)
    this.MANY_SEP({
      DEF: () => {
        // @todo Support different arguments.
        this.SUBRULE(this.calcExpression, { LABEL: 'args' })
      },
      SEP: Comma,
    })
    this.CONSUME(RParen)
  })
}

export const parser = new Parser()
export const productions = parser.getGAstProductions()

const parse = (text: string) => {
  const lexResult = lexer.tokenize(text)
  parser.input = lexResult.tokens
  const cst = parser.parseInput()
  const cells = new Set(
    lexResult.tokens
      .filter((t) => t.tokenType === CellName)
      .map((t) => t.image),
  )
  return {
    cst,
    cells,
    lexErrors: lexResult.errors,
    parseErrors: parser.errors,
  } as const
}

export default parse
