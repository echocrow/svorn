import { type IToken, type TokenType, tokenMatcher } from 'chevrotain'

import {
  Div,
  Equals,
  GreaterOrEqual,
  GreaterThan,
  LessOrEqual,
  LessThan,
  Minus,
  Multi,
  NotEquals,
  Plus,
  Pow,
  True,
} from './parse'
import { type CellValue, CellError, DivZeroErr, ValErr } from './values'

export type Operation<
  I extends CellValue = CellValue,
  O extends CellValue = CellValue,
> = (a: I, b: I) => O
export type OperationDecor<
  I extends CellValue = CellValue,
  O extends CellValue = CellValue,
> = (opFn: Operation<I, O>) => Operation<CellValue, O>
export type HOOperation<
  I extends CellValue = CellValue,
  O extends CellValue = CellValue,
> = (a: Operation<I>, b: Operation<I>) => Operation<O>

export const resolveNum = (val: CellValue): number | CellError => {
  if (val instanceof Error) return val
  const newVal =
    typeof val === 'number' || val === null
      ? val ?? 0
      : typeof val === 'string'
      ? val || 0
      : typeof val === 'boolean'
      ? Number(val)
      : val
  return typeof newVal === 'number' && !isNaN(newVal) ? newVal : ValErr
}

export const makeCalcOp: OperationDecor<number, number | CellError> =
  (opFn) => (a, b) => {
    if (a instanceof Error) return a
    if (b instanceof Error) return b
    a = resolveNum(a)
    b = resolveNum(b)
    if (a instanceof Error) return a
    if (b instanceof Error) return b
    return opFn(a, b)
  }

const calcPow = makeCalcOp((a, b) => a ** b)
const calcMultiply = makeCalcOp((a, b) => a * b)
const calcDivide = makeCalcOp((a, b) => (b == 0 ? DivZeroErr : a / b))
const _calcNumAdd = makeCalcOp((a, b) => a + b)
const calcAdd: Operation = (a, b) =>
  typeof a === 'string' && typeof b === 'string' ? a + b : _calcNumAdd(a, b)
const calcSubtract = makeCalcOp((a, b) => a - b)

const makeComparison: OperationDecor = (opFn) => (a, b) => {
  if (a instanceof Error) return a
  if (b instanceof Error) return b
  if (typeof a === 'string') a = a.toLowerCase()
  if (typeof b === 'string') b = b.toLowerCase()
  return opFn(a, b)
}
const _compareLessThan: Operation = (a, b) => (a ?? 0) < (b ?? 0)
const _compareEquals: Operation = (a, b) =>
  a === b || (a === null && !b) || (!a && b === null)
const _compareEither: HOOperation = (opFnA, opFnB) => (a, b) =>
  opFnA(a, b) || opFnB(a, b)
const _notOp: OperationDecor = (opFn) => (a, b) => !opFn(a, b)
const _compareLessOrEqual = _compareEither(_compareLessThan, _compareEquals)
const compareLessThan = makeComparison(_compareLessThan)
const compareLessOrEqual = makeComparison(_compareLessOrEqual)
const compareGreaterThan = makeComparison(_notOp(_compareLessOrEqual))
const compareGreaterOrEqual = makeComparison(_notOp(_compareLessThan))
const compareEquals = makeComparison(_compareEquals)
const compareNotEquals = makeComparison(_notOp(_compareEquals))

export const resolveNumberLiteral = (token: IToken | undefined): number => {
  const image = token?.image ?? ''
  const factor = image.slice(-1) === '%' ? 0.01 : 1
  return parseFloat(image) * factor
}

export const resolveBoolean = (token: IToken | undefined): boolean =>
  token ? tokenMatcher(token, True) : false

// Resolve +/- ops to a sign multiplier based on number of Minus operators.
const resolveAdditionOps = (ops: IToken[] | undefined): number | undefined =>
  ops
    ? (ops.filter((op) => tokenMatcher(op, Minus)).length % 2) * -2 + 1
    : undefined

export const resolveAdditionValue = (
  ops: IToken[] | undefined,
  rhs: CellValue,
): CellValue => {
  const sign = resolveAdditionOps(ops)
  return sign !== undefined && !(rhs instanceof Error)
    ? calcMultiply(rhs, sign)
    : rhs
}

export const opPhases: readonly [TokenType, Operation][][] = [
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
