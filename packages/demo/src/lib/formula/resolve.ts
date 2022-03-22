import {
  type CstNode,
  type IToken,
  type TokenType,
  tokenMatcher,
} from 'chevrotain'

import { type CellValue, type CellValues, CellError } from '#lib/cells'
import { IS_DEV_ENV } from '#lib/utils'

import type {
  AtomicExpressionCstChildren,
  FinanceNumberCstChildren,
  FormulaCstChildren,
  FuncExpressionCstChildren,
  MagicNumberCstChildren,
  MagicTextCstChildren,
  OperationCstChildren,
  ParenExpressionCstChildren,
  ParseInputCstChildren,
  PlainCstChildren,
  TextCstChildren,
} from './cst.gen'
import funcs from './functions'
import {
  type ParseResult,
  Div,
  Equals,
  GreaterOrEqual,
  GreaterThan,
  LessOrEqual,
  LessThan,
  Minus,
  Multi,
  NotEquals,
  parser,
  Plus,
  Pow,
  True,
} from './parse'

const BaseCstVisitor = parser.getBaseCstVisitorConstructor()

export const ValErr = new CellError('VALUE', 'Value not supported')
export const DivZeroErr = new CellError('DIV/0', 'Cannot divide by zero')
export const RuntimeErr = new CellError('ERROR', 'Unexpected runtime error')
export const ParseErr = new CellError('ERROR', 'Invalid input')
export const FuncNameErr = new CellError('NAME', 'Unknown function')
export const FuncArgsErr = new CellError('N/A', 'Wrong number of arguments')

type Operation = (a: CellValue, b: CellValue) => CellValue

export const resolveCalcNum = (val: CellValue): number => {
  const newVal =
    typeof val === 'number'
      ? val
      : typeof val === 'string'
      ? val || 0
      : typeof val === 'boolean'
      ? Number(val)
      : val
  if (typeof newVal !== 'number')
    throw newVal instanceof CellError ? newVal : ValErr
  return newVal
}
const resolveCalcArgs = (a: CellValue, b: CellValue): [number, number] => {
  if (a instanceof Error) throw a
  if (b instanceof Error) throw b
  return [resolveCalcNum(a), resolveCalcNum(b)]
}
const makeOp =
  (opFn: Operation): Operation =>
  (a, b) => {
    try {
      return opFn(a, b)
    } catch (err) {
      return err instanceof CellError ? err : RuntimeErr
    }
  }

const calcPow = makeOp((a, b) => {
  ;[a, b] = resolveCalcArgs(a, b)
  return a ** b
})
const calcMultiply = makeOp((a, b) => {
  if (typeof a === 'number' && typeof b === 'string') return calcMultiply(b, a)
  ;[a, b] = resolveCalcArgs(a, b)
  return a * b
})
const calcDivide = makeOp((a, b) => {
  ;[a, b] = resolveCalcArgs(a, b)
  if (b == 0) throw DivZeroErr
  return a / b
})
const calcAdd = makeOp((a, b) => {
  if (typeof a === 'string' && typeof b === 'string') return a + b
  ;[a, b] = resolveCalcArgs(a, b)
  return a + b
})
const calcSubtract = makeOp((a, b) => {
  ;[a, b] = resolveCalcArgs(a, b)
  return a - b
})

const makeComparison = (opFn: Operation): Operation =>
  makeOp((a, b) => {
    if (a instanceof Error) throw a
    if (b instanceof Error) throw b
    if (typeof a === 'string') a = a.toLowerCase()
    if (typeof b === 'string') b = b.toLowerCase()
    return opFn(a, b)
  })
const compareLessThan = makeComparison((a, b) => a < b)
const compareLessOrEqual = makeComparison((a, b) => a <= b)
const compareGreaterThan = makeComparison((a, b) => a > b)
const compareGreaterOrEqual = makeComparison((a, b) => a >= b)
const compareEquals = makeComparison((a, b) => a === b)
const compareNotEquals = makeComparison((a, b) => !compareEquals(a, b))

const resolveNumberLiteral = (token: IToken | undefined): number => {
  const image = token?.image ?? ''
  const factor = image.slice(-1) === '%' ? 0.01 : 1
  return parseFloat(image) * factor
}

const resolveBoolean = (token: IToken | undefined): boolean =>
  token ? tokenMatcher(token, True) : false

// Resolve +/- ops to a sign multiplier based on number of Minus operators.
const resolveAdditionOps = (ops: IToken[] | undefined): number | undefined =>
  ops
    ? (ops.filter((op) => tokenMatcher(op, Minus)).length % 2) * -2 + 1
    : undefined

const resolveAdditionValue = (
  ops: IToken[] | undefined,
  rhs: CellValue,
): CellValue => {
  const sign = resolveAdditionOps(ops)
  return sign !== undefined && !(rhs instanceof Error)
    ? calcMultiply(rhs, sign)
    : rhs
}

const opPhases: readonly [TokenType, Operation][][] = [
  [[Pow, calcPow]],
  [
    [Multi, calcMultiply],
    [Div, calcDivide],
  ],
  [
    [Plus, calcAdd],
    [Minus, calcSubtract],
  ],
  [
    [LessThan, compareLessThan],
    [LessOrEqual, compareLessOrEqual],
    [GreaterThan, compareGreaterThan],
    [GreaterOrEqual, compareGreaterOrEqual],
    [Equals, compareEquals],
    [NotEquals, compareNotEquals],
  ],
]

class Interpreter extends BaseCstVisitor {
  #cellValues: CellValues = {}

  constructor() {
    super()
    if (IS_DEV_ENV) this.validateVisitor()
  }

  interpret(cst: CstNode, cellValues: CellValues): CellValue {
    this.#cellValues = cellValues
    return this.visit(cst)
  }

  protected parseInput(ctx: ParseInputCstChildren): CellValue {
    return this.visit(
      ctx.formula ?? ctx.plain ?? ctx.magicText ?? ctx.text ?? [],
    )
  }

  protected plain(ctx: PlainCstChildren): CellValue {
    return this.visit(ctx.text)
  }

  protected text(ctx: TextCstChildren): CellValue {
    return (ctx.PlainText ?? []).map((t) => t.image).join('')
  }

  protected magicText(ctx: MagicTextCstChildren): CellValue {
    if (ctx.magicNumber) return this.visit(ctx.magicNumber)
    if (ctx.financeNumber) return this.visit(ctx.financeNumber)
    if (ctx.Boolean) return resolveBoolean(ctx.Boolean[0])
    return RuntimeErr
  }
  protected magicNumber(ctx: MagicNumberCstChildren): CellValue {
    return resolveAdditionValue(ctx.ops, resolveNumberLiteral(ctx.number[0]))
  }
  protected financeNumber(ctx: FinanceNumberCstChildren): CellValue {
    return -resolveNumberLiteral(ctx.number[0])
  }

  protected formula(ctx: FormulaCstChildren): CellValue {
    return this.visit(ctx.body)
  }

  protected operation(ctx: OperationCstChildren): CellValue {
    const left = this.visit(ctx.lhs) as CellValue
    const rights = (ctx.rhs ?? []).map((r) => this.visit(r) as CellValue)

    const ops = ctx.ops ?? []
    if (ops.length !== rights.length) return RuntimeErr

    // Serialize values and operators.
    let items = ops.reduce<(CellValue | IToken)[]>(
      (items, op, i) => items.concat([op, rights[i] as CellValue]),
      [left],
    )

    for (const opPhase of opPhases) {
      const newItems: typeof items = []
      let buffer = items[0] as CellValue
      for (let i = 1; i < items.length; i += 2) {
        const op = items[i] as IToken
        const val = items[i + 1] as CellValue
        const [_, opFn] = opPhase.find(([tkn]) => tokenMatcher(op, tkn)) ?? []
        if (opFn) {
          buffer = opFn(buffer, val)
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
    return resolveAdditionValue(ctx.ops, this.resolveAtomicExpression(ctx))
  }
  private resolveAtomicExpression(ctx: AtomicExpressionCstChildren): CellValue {
    if (ctx.parenExpression) return this.visit(ctx.parenExpression)

    if (ctx.funcExpression) return this.visit(ctx.funcExpression)

    if (ctx.CellName) {
      const cellName = ctx.CellName?.[0]?.image ?? ''
      return this.#cellValues[cellName] ?? ''
    }

    if (ctx.NumberLiteral) return resolveNumberLiteral(ctx.NumberLiteral[0])

    if (ctx.StringLiteral) {
      return (ctx.StringLiteral?.[0]?.image ?? '')
        .slice(1, -1)
        .replace(/""/g, '"')
    }

    if (ctx.Boolean) return resolveBoolean(ctx.Boolean[0])

    return RuntimeErr
  }

  protected parenExpression(ctx: ParenExpressionCstChildren): CellValue {
    return this.visit(ctx.inner)
  }

  protected funcExpression(ctx: FuncExpressionCstChildren): CellValue {
    const fnName = ctx.fn[0]?.image ?? ''
    const func = funcs[fnName]
    if (!func) return FuncNameErr

    const args = ctx.args ?? []
    if (args.length < func.minArgs) return FuncArgsErr
    if (args.length > func.maxArgs) return FuncArgsErr

    const visit = (ctx: CstNode) => this.visit(ctx)

    const namedArgs = func.argNames.reduce((namedArgs, argName, i) => {
      namedArgs[argName] = args[i]
      return namedArgs
    }, {} as Record<string, CstNode | undefined>)
    const restArgs = args.slice(func.argNames.length)

    try {
      return func.resolve(visit, namedArgs, restArgs)
    } catch (err) {
      return err instanceof CellError ? err : RuntimeErr
    }
  }
}

// We only need a single interpreter instance because our interpreter has no state.
const interpreter = new Interpreter()

const resolve = (
  parsed: ParseResult,
  cellValues: Record<string, CellValue>,
): CellValue =>
  parsed.lexErrors.length || parsed.parseErrors.length
    ? ParseErr
    : interpreter.interpret(parsed.cst, cellValues)

export default resolve
