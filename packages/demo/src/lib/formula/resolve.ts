import {
  type CstNode,
  type IToken,
  type TokenType,
  tokenMatcher,
} from 'chevrotain'

import { type CellValue, type CellValues, CellError } from '$lib/cells'
import { exactMatch } from '$lib/utils'

import type {
  AtomicExpressionCstChildren,
  AtomicNumberCstChildren,
  CalcExpressionCstChildren,
  FormulaCstChildren,
  FunctionExpressionCstChildren,
  MagicTextCstChildren,
  ParenExpressionCstChildren,
  ParseInputCstChildren,
  PlainCstChildren,
  TextCstChildren,
} from './cst.gen'
import {
  Div,
  False,
  Minus,
  Multi,
  NumberLiteralRegEx,
  parser,
  Plus,
  Pow,
  True,
} from './parse'

const BaseCstVisitor = parser.getBaseCstVisitorConstructor()

export const ValErr = new CellError('VALUE', 'Value not supported')
export const RuntimeErr = new CellError('ERROR', 'Unexpected runtime error')

const resolveStringLiteral = (str: string): string => {
  const rawBody = str.slice(1, -1)
  // @todo Remove escaped quotes
  return rawBody
}

type CalcFn = (a: CellValue, b: CellValue) => CellValue

const calcPow: CalcFn = (a, b) => {
  if (typeof a !== 'number' || typeof b !== 'number') return ValErr
  return a ** b
}
const calcMultiply: CalcFn = (a, b) => {
  if (typeof a === 'string' && typeof b === 'number') return a.repeat(b)
  if (typeof a === 'number' && typeof b === 'string') return calcMultiply(b, a)
  if (typeof a !== 'number' || typeof b !== 'number') return ValErr
  return a * b
}
const calcDivide: CalcFn = (a, b) => {
  if (typeof a !== 'number' || typeof b !== 'number') return ValErr
  return a / b
}
const calcAdd: CalcFn = (a, b) => {
  if (typeof a === 'string' && typeof b === 'string') return a + b
  if (typeof a !== 'number' || typeof b !== 'number') return ValErr
  return a + b
}
const calcSubtract: CalcFn = (a, b) => {
  if (typeof a !== 'number' || typeof b !== 'number') return ValErr
  return a - b
}

const calcPhases: readonly [TokenType, CalcFn][][] = [
  [[Pow, calcPow]],
  [
    [Multi, calcMultiply],
    [Div, calcDivide],
  ],
  [
    [Plus, calcAdd],
    [Minus, calcSubtract],
  ],
]

class Interpreter extends BaseCstVisitor {
  #cellValues: CellValues = {}

  constructor() {
    super()
    this.validateVisitor()
  }

  interpret(cst: CstNode, cellValues: CellValues): CellValue {
    this.#cellValues = cellValues
    return this.visit(cst)
  }

  protected parseInput(ctx: ParseInputCstChildren): CellValue {
    return this.visit(ctx.formula ?? ctx.plain ?? ctx.magicText ?? [])
  }

  protected plain(ctx: PlainCstChildren): CellValue {
    return this.visit(ctx.text)
  }

  protected text(ctx: TextCstChildren): CellValue {
    return ctx.PlainText?.[0]?.image ?? ''
  }

  protected magicText(ctx: MagicTextCstChildren): CellValue {
    if (!ctx.MagicText) return ''
    const txt = ctx.MagicText?.[0]?.image ?? ''
    // Magic booleans.
    if (txt === True.name) return true
    if (txt === False.name) return false
    // Magic numbers.
    if (exactMatch(txt, NumberLiteralRegEx)) return parseFloat(txt)
    if (
      txt.startsWith('(') &&
      txt.endsWith(')') &&
      exactMatch(txt.slice(1, -1), NumberLiteralRegEx)
    ) {
      return -parseFloat(txt.slice(1, -1))
    }
    // Plain text.
    return txt
  }

  protected formula(ctx: FormulaCstChildren): CellValue {
    return this.visit(ctx.body)
  }

  protected calcExpression(ctx: CalcExpressionCstChildren): CellValue {
    const left = this.visit(ctx.lhs) as CellValue
    const rights = (ctx.rhs ?? []).map((r) => this.visit(r) as CellValue)

    const ops = ctx.ops ?? []
    if (ops.length !== rights.length) return RuntimeErr

    // Serialize values and operators.
    let items = ops.reduce<(CellValue | IToken)[]>(
      (items, op, i) => items.concat([op, rights[i] as CellValue]),
      [left],
    )

    for (const calcPhase of calcPhases) {
      const newItems: typeof items = []
      let buffer = items[0] as CellValue
      for (let i = 1; i < items.length; i += 2) {
        const op = items[i] as IToken
        const val = items[i + 1] as CellValue
        const [_, calc] = calcPhase.find(([tkn]) => tokenMatcher(op, tkn)) ?? []
        if (calc) {
          buffer = calc(buffer, val)
        } else {
          newItems.push(buffer, op)
          buffer = val
        }
      }
      newItems.push(buffer)
      items = newItems
    }
    if (items.length !== 1) return RuntimeErr
    return items[0] as CellValue
  }

  protected atomicExpression(ctx: AtomicExpressionCstChildren): CellValue {
    if (ctx.parenExpression) return this.visit(ctx.parenExpression)

    if (ctx.functionExpression) return this.visit(ctx.functionExpression)

    if (ctx.atomicNumber) return this.visit(ctx.atomicNumber)

    if (ctx.CellName) {
      const cellName = ctx.CellName?.[0]?.image ?? ''
      return this.#cellValues[cellName] ?? ''
    }

    if (ctx.StringLiteral)
      return resolveStringLiteral(ctx.StringLiteral?.[0]?.image ?? '')
    if (ctx.Boolean) return this.resolveBoolean(ctx.Boolean[0] as IToken)

    return RuntimeErr
  }

  protected atomicNumber(ctx: AtomicNumberCstChildren): CellValue {
    const num = parseFloat(ctx.number[0]?.image ?? '')
    // Sign multiplier based on number of Minus operators.
    const sign = ctx.ops
      ? (ctx.ops.filter((op) => tokenMatcher(op, Minus)).length % 2) * -2 + 1
      : 1
    return num * sign
  }

  protected parenExpression(ctx: ParenExpressionCstChildren): CellValue {
    return this.visit(ctx.inner)
  }

  protected functionExpression(ctx: FunctionExpressionCstChildren): CellValue {
    // @todo Implement custom functions.
    return RuntimeErr
  }

  private resolveBoolean(token: IToken): boolean {
    return tokenMatcher(token, True)
  }
}

// We only need a single interpreter instance because our interpreter has no state.
const interpreter = new Interpreter()

const resolve = (
  cst: CstNode,
  cellValues: Record<string, CellValue>,
): CellValue => {
  const cellValue = interpreter.interpret(cst, cellValues)
  return cellValue
}

export default resolve
