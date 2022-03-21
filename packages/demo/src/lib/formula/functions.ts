import { type AnyFunc, makeFunc } from './function'
import { resolveCalcNum } from './resolve'

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

export const Floor = makeFunc({
  name: 'FLOOR',
  args: ['value'] as const,
  resolve: (visit, args) => Math.floor(resolveCalcNum(visit(args.value))),
})
export const Ceiling = makeFunc({
  name: 'CEILING',
  args: ['value'] as const,
  resolve: (visit, args) => Math.ceil(resolveCalcNum(visit(args.value))),
})
export const Round = makeFunc({
  name: 'ROUND',
  args: ['value'] as const,
  optArgs: ['places'] as const,
  resolve: (visit, args) => {
    const value = resolveCalcNum(visit(args.value))
    const places = args.places ? resolveCalcNum(visit(args.places)) : 0
    const pow = 10 ** places
    return Math.round(value * pow) / pow
  },
})

/** @todo: Add more functions. */

const funcsList = [If, Floor, Ceiling, Round]

const funcs = funcsList.reduce<Record<string, AnyFunc>>((funcs, f) => {
  funcs[f.name] = f
  return funcs
}, {})

export default funcs
