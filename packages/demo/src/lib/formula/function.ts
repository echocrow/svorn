import type { CstNode, ICstVisitor } from 'chevrotain'

import type { CellValue } from '#lib/cells'

type ArgNames = ReadonlyArray<string>

type VisitFn = ICstVisitor<never, CellValue>['visit']

export interface Func<A extends ArgNames, O extends ArgNames> {
  name: string
  minArgs: number
  maxArgs: number
  argNames: string[]
  resolve: (
    visit: VisitFn,
    args: ResolveAllArgs<A, O> | Record<string, CstNode | undefined>,
    restArgs: CstNode[],
  ) => CellValue
}

export type AnyFunc = Func<ArgNames, ArgNames>

type ResolveArgs<A extends ArgNames> = {
  [K in A[number]]: CstNode
}
type ResolveOptArgs<O extends ArgNames> = {
  [K in O[number]]: CstNode | undefined
}
type ResolveAllArgs<A extends ArgNames, O extends ArgNames> = ResolveArgs<A> &
  ResolveOptArgs<O>

interface MakeFuncOptions<A extends ArgNames, O extends ArgNames> {
  name: string
  args: A
  optArgs?: O
  restArgs?: boolean
  resolve: (
    visit: VisitFn,
    args: ResolveAllArgs<A, O>,
    restArgs: CstNode[],
  ) => CellValue
}

export const makeFunc = <A extends ArgNames, O extends ArgNames>({
  name,
  args,
  optArgs,
  restArgs,
  resolve,
}: MakeFuncOptions<A, O>): Func<A, O> => {
  const minArgs = args.length
  const maxArgs = restArgs ? Infinity : minArgs + (optArgs?.length ?? 0)
  return {
    name,
    minArgs,
    maxArgs,
    argNames: [...args, ...(optArgs ?? [])],
    resolve: resolve as Func<A, O>['resolve'],
  }
}
