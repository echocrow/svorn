import { type AnyFunc, makeFunc } from './function'
import { makeCalcOp } from './resolveUtils'

export const If = makeFunc({
  name: 'IF',
  args: ['condition', 'then'] as const,
  optArgs: ['else'] as const,
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
export const Floor = makeFunc({
  name: 'FLOOR',
  args: ['value'] as const,
  optArgs: ['factor'] as const,
  resolve: (visit, args) =>
    _floor(visit(args.value), args.factor ? visit(args.factor) : 1),
})
const _ceil = makeFloatOp((val, fac) => Math.ceil(val / fac) * fac)
export const Ceiling = makeFunc({
  name: 'CEILING',
  args: ['value'] as const,
  optArgs: ['factor'] as const,
  resolve: (visit, args) =>
    _ceil(visit(args.value), args.factor ? visit(args.factor) : 1),
})
const _round = makeFloatOp((val, p) => floatRound(val, roundToZero(p)))
export const Round = makeFunc({
  name: 'ROUND',
  args: ['value'] as const,
  optArgs: ['places'] as const,
  resolve: (visit, args) =>
    _round(visit(args.value), args.places ? visit(args.places) : 0),
})

/** @todo: Add more functions. */

const funcsList = [If, Floor, Ceiling, Round]

const funcs = funcsList.reduce<Record<string, AnyFunc>>((funcs, f) => {
  funcs[f.name] = f
  return funcs
}, {})

export default funcs
