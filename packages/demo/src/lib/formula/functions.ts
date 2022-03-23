import type { CellValue } from '#lib/cells'

import { type AnyFunc, makeFunc } from './function'
import { resolveNum } from './resolve'

const requireNum = (val: CellValue): number => {
  if (val instanceof Error) throw val
  const num = resolveNum(val)
  if (num instanceof Error) throw num
  return num
}

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

const precisionRound = (num: number, places: number): number => {
  const pow = 10 ** places
  return Math.round(num * pow) / pow
}
const roundTowardsZero = (num: number): number => num | 0
// Deal with floating-point precision issue.
// @see https://floating-point-gui.de/
const truncateFloatImprecision = (num: number): number =>
  precisionRound(num, 10)
export const Floor = makeFunc({
  name: 'FLOOR',
  args: ['value'] as const,
  optArgs: ['factor'] as const,
  resolve: (visit, args) => {
    const value = requireNum(visit(args.value))
    const factor = args.factor ? requireNum(visit(args.factor)) : 1
    const res = Math.floor(value / factor) * factor
    return truncateFloatImprecision(res)
  },
})
export const Ceiling = makeFunc({
  name: 'CEILING',
  args: ['value'] as const,
  optArgs: ['factor'] as const,
  resolve: (visit, args) => {
    const value = requireNum(visit(args.value))
    const factor = args.factor ? requireNum(visit(args.factor)) : 1
    const res = Math.ceil(value / factor) * factor
    return truncateFloatImprecision(res)
  },
})
export const Round = makeFunc({
  name: 'ROUND',
  args: ['value'] as const,
  optArgs: ['places'] as const,
  resolve: (visit, args) => {
    const value = requireNum(visit(args.value))
    const places = args.places
      ? roundTowardsZero(requireNum(visit(args.places)))
      : 0
    return truncateFloatImprecision(precisionRound(value, places))
  },
})

/** @todo: Add more functions. */

const funcsList = [If, Floor, Ceiling, Round]

const funcs = funcsList.reduce<Record<string, AnyFunc>>((funcs, f) => {
  funcs[f.name] = f
  return funcs
}, {})

export default funcs
