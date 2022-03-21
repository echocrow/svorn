import { type AnyFunc, makeFunc } from './function'

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

/** @todo: Add more functions. */

const funcsList = [If]

const funcs = funcsList.reduce<Record<string, AnyFunc>>((funcs, f) => {
  funcs[f.name] = f
  return funcs
}, {})

export default funcs
