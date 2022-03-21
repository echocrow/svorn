import {
  type CstNode,
  type ILexingError,
  type IMultiModeLexerDefinition,
  type IRecognitionException,
  type TokenType,
  createToken,
  CstParser,
  EOF,
  Lexer,
} from 'chevrotain'

import { IS_DEV_ENV } from '#lib/utils'

const EnterFormula = createToken({
  name: 'EnterFormula',
  pattern: '=',
  push_mode: 'formula',
})
const Comma = createToken({ name: 'Comma', pattern: ',' })
const Colon = createToken({ name: 'Colon', pattern: ':' })
const LParen = createToken({ name: 'LParen', pattern: '(' })
const RParen = createToken({ name: 'RParen', pattern: ')' })

const Operator = createToken({
  name: 'Operator',
  pattern: Lexer.NA,
})
const AdditionOperator = createToken({
  name: 'AdditionOperator',
  pattern: Lexer.NA,
  categories: Operator,
})
export const Plus = createToken({
  name: 'Plus',
  pattern: '+',
  categories: AdditionOperator,
})
export const Minus = createToken({
  name: 'Minus',
  pattern: '-',
  categories: AdditionOperator,
})
export const Multi = createToken({
  name: 'Multi',
  pattern: '*',
  categories: Operator,
})
export const Div = createToken({
  name: 'Div',
  pattern: '/',
  categories: Operator,
})
export const Pow = createToken({
  name: 'Pow',
  pattern: '**',
  categories: Operator,
})
export const Equals = createToken({
  name: 'Equals',
  pattern: '=',
  categories: Operator,
})
export const NotEquals = createToken({
  name: 'NotEquals',
  pattern: /(?:!=)|(?:<>)/,
  categories: Operator,
})
export const LessThan = createToken({
  name: 'LessThan',
  pattern: '<',
  categories: Operator,
})
export const LessOrEqual = createToken({
  name: 'LessOrEqual',
  pattern: '<=',
  categories: Operator,
})
export const GreaterThan = createToken({
  name: 'GreaterThan',
  pattern: '>',
  categories: Operator,
})
export const GreaterOrEqual = createToken({
  name: 'GreaterOrEqual',
  pattern: '>=',
  categories: Operator,
})

const FuncName = createToken({
  name: 'FuncName',
  pattern: /[A-Z]+/,
})
const StringLiteral = createToken({
  name: 'StringLiteral',
  pattern: /"(:?[^"]|"")*"/,
})
const NumberLiteral = createToken({
  name: 'NumberLiteral',
  pattern: /(?:(?:\d+\.?\d*)|(?:\.\d+))(?:[eE][+-]?\d+)?/,
})
const CellName = createToken({
  name: 'CellName',
  pattern: /[A-Z]+[1-9]\d*/,
})
const Boolean = createToken({
  name: 'Boolean',
  pattern: Lexer.NA,
})
export const True = createToken({
  name: 'TRUE',
  pattern: 'TRUE',
  categories: Boolean,
  longer_alt: FuncName,
})
export const False = createToken({
  name: 'FALSE',
  pattern: 'FALSE',
  categories: Boolean,
  longer_alt: FuncName,
})
const WhiteSpace = createToken({
  name: 'Whitespace',
  pattern: /\s+/,
  group: Lexer.SKIPPED,
})

const Anything = createToken({
  name: 'PlainText',
  pattern: Lexer.NA,
})

const EnterPlainText = createToken({
  name: 'EnterPlainText',
  pattern: "'",
  push_mode: 'plainText',
})
const PlainText = createToken({
  name: 'PlainText',
  pattern: /(?:.|\n)+/,
  categories: Anything,
  line_breaks: true,
})

export const PlainTrue = createToken({
  name: 'TRUE',
  pattern: True.PATTERN,
  categories: [True, Anything],
})
export const PlainFalse = createToken({
  name: 'FALSE',
  pattern: False.PATTERN,
  categories: [False, Anything],
})
export const PlainPlus = createToken({
  name: 'Plus',
  pattern: Plus.PATTERN,
  categories: [Plus, Anything],
})
export const PlainMinus = createToken({
  name: 'Minus',
  pattern: Minus.PATTERN,
  categories: [Minus, Anything],
})
const PlainNumberLiteral = createToken({
  name: 'NumberLiteral',
  pattern: NumberLiteral.PATTERN,
  categories: [NumberLiteral, Anything],
})
const PlainLParen = createToken({
  name: 'PlainLParen',
  pattern: LParen.PATTERN,
  categories: [LParen, Anything],
})
const PlainRParen = createToken({
  name: 'PlainRParen',
  pattern: RParen.PATTERN,
  categories: [RParen, Anything],
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
      Equals,
      NotEquals,
      LessOrEqual,
      LessThan,
      GreaterOrEqual,
      GreaterThan,
      True,
      False,
      CellName,
      FuncName,
      NumberLiteral,
      StringLiteral,
      LParen,
      RParen,
      Comma,
      Colon,
    ],
    plainText: [PlainText],
    input: [
      EnterFormula,
      EnterPlainText,
      PlainTrue,
      PlainFalse,
      PlainPlus,
      PlainMinus,
      PlainNumberLiteral,
      PlainLParen,
      PlainRParen,
      PlainText,
    ],
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
      skipValidations: !IS_DEV_ENV,
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
      {
        GATE: this.BACKTRACK(this.magicText),
        ALT: () => this.SUBRULE(this.magicText),
      },
      { ALT: () => this.SUBRULE(this.text) },
    ])
  })

  private plain = this.RULE('plain', () => {
    this.CONSUME(EnterPlainText)
    this.SUBRULE(this.text, { LABEL: 'text' })
  })

  private text = this.RULE('text', () => {
    this.MANY(() => this.CONSUME(Anything))
  })

  private magicText = this.RULE('magicText', () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.magicNumber) },
      { ALT: () => this.SUBRULE(this.financeNumber) },
      { ALT: () => this.CONSUME(Boolean) },
    ])
    this.CONSUME(EOF)
  })
  private magicNumber = this.RULE('magicNumber', () => {
    this.MANY(() => this.CONSUME(AdditionOperator, { LABEL: 'ops' }))
    this.CONSUME(NumberLiteral, { LABEL: 'number' })
  })
  private financeNumber = this.RULE('financeNumber', () => {
    this.CONSUME(LParen)
    this.CONSUME(PlainNumberLiteral, { LABEL: 'number' })
    this.CONSUME(RParen)
  })

  private formula = this.RULE('formula', () => {
    this.CONSUME(EnterFormula)
    this.SUBRULE(this.operation, { LABEL: 'body' })
  })

  private operation = this.RULE('operation', () => {
    this.SUBRULE(this.atomicExpression, { LABEL: 'lhs' })
    this.MANY(() => {
      this.CONSUME(Operator, { LABEL: 'ops' })
      this.SUBRULE1(this.atomicExpression, { LABEL: 'rhs' })
    })
  })

  private atomicExpression = this.RULE('atomicExpression', () => {
    this.MANY(() => this.CONSUME(AdditionOperator, { LABEL: 'ops' }))
    this.OR([
      { ALT: () => this.SUBRULE(this.parenExpression) },
      { ALT: () => this.SUBRULE(this.funcExpression) },
      { ALT: () => this.CONSUME(CellName) },
      { ALT: () => this.CONSUME(NumberLiteral) },
      { ALT: () => this.CONSUME(StringLiteral) },
      { ALT: () => this.CONSUME(Boolean) },
    ])
  })

  private parenExpression = this.RULE('parenExpression', () => {
    this.CONSUME(LParen)
    this.SUBRULE(this.operation, { LABEL: 'inner' })
    this.CONSUME(RParen)
  })

  private funcExpression = this.RULE('funcExpression', () => {
    this.CONSUME(FuncName, { LABEL: 'fn' })
    this.CONSUME(LParen)
    this.MANY_SEP({
      DEF: () => this.SUBRULE(this.operation, { LABEL: 'args' }),
      SEP: Comma,
    })
    this.CONSUME(RParen)
  })
}

export const parser = new Parser()
export const productions = parser.getGAstProductions()

export interface ParseResult {
  readonly cst: CstNode
  readonly cells: Set<string>
  readonly lexErrors: ILexingError[]
  readonly parseErrors: IRecognitionException[]
}

const parse = (text: string): ParseResult => {
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
  }
}

export default parse
