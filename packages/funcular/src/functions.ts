import { type AnyFunc, makeFunc } from './function'
import { makeCalcOp, makeMapper, makeNumMapper } from './resolveUtils'
import { DivZeroErr } from './values'

const If = makeFunc({
  name: 'IF',
  args: ['condition', 'then'],
  optArgs: ['else'],
  resolve: (visit, args) => {
    const cond = visit(args.condition)
    return cond instanceof Error
      ? cond
      : cond
      ? visit(args.then)
      : args.else
      ? visit(args.else)
      : ''
  },
})

const _not = makeMapper((val) => !val)
const Not = makeFunc({
  name: 'NOT',
  args: ['logical_expression'],
  resolve: (visit, args) => _not(visit(args.logical_expression)),
})

const _abs = makeNumMapper(Math.abs)
const Abs = makeFunc({
  name: 'ABS',
  args: ['value'],
  resolve: (visit, args) => _abs(visit(args.value)),
})

const floatRound = (num: number, places: number): number => {
  const pow = 10 ** places
  return Math.round(num * pow) / pow
}
const roundToZero = (num: number): number => num | 0
// Deal with floating-point precision issue.
// @see https://floating-point-gui.de/
const truncateFloatImprecision = (num: number): number => floatRound(num, 10)
const makeFloatOp: typeof makeCalcOp = (calcOp) =>
  makeCalcOp((a, b) => {
    const res = calcOp(a, b)
    return res instanceof Error ? res : truncateFloatImprecision(res)
  })
const _floor = makeFloatOp((val, fac) => Math.floor(val / fac) * fac)
const Floor = makeFunc({
  name: 'FLOOR',
  args: ['value'],
  optArgs: ['factor'],
  resolve: (visit, args) =>
    _floor(visit(args.value), args.factor ? visit(args.factor) : 1),
})
const _ceil = makeFloatOp((val, fac) => Math.ceil(val / fac) * fac)
const Ceiling = makeFunc({
  name: 'CEILING',
  args: ['value'],
  optArgs: ['factor'],
  resolve: (visit, args) =>
    _ceil(visit(args.value), args.factor ? visit(args.factor) : 1),
})
const _round = makeFloatOp((val, p) => floatRound(val, roundToZero(p)))
const Round = makeFunc({
  name: 'ROUND',
  args: ['value'],
  optArgs: ['places'],
  resolve: (visit, args) =>
    _round(visit(args.value), args.places ? visit(args.places) : 0),
})

const _mod = makeCalcOp((a, b) =>
  !b
    ? DivZeroErr
    : !a
    ? 0
    : (a % b) + b * Number((a < 0 && b > 0) || (a > 0 && b < 0)),
)
const Mod = makeFunc({
  name: 'MOD',
  args: ['dividend', 'divisor'],
  resolve: (visit, args) => _mod(visit(args.dividend), visit(args.divisor)),
})

/** @todo: Add more functions. */

const funcsList = [If, Not, Abs, Floor, Ceiling, Round, Mod]

const funcs = funcsList.reduce<Record<string, AnyFunc>>((funcs, f) => {
  funcs[f.name] = f
  return funcs
}, {})

export default funcs
