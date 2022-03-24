import type { CstNode, ICstVisitor } from 'chevrotain'

import type { CellValue } from './values'

type ArgNames = ReadonlyArray<string>

type VisitFn = ICstVisitor<never, CellValue>['visit']

export interface Func<A extends ArgNames, O extends ArgNames> {
  readonly name: string
  readonly minArgs: number
  readonly maxArgs: number
  readonly argNames: ReadonlyArray<string>
  readonly resolve: (
    visit: VisitFn,
    args: ResolveAllArgs<A, O> | Record<string, CstNode | undefined>,
    restArgs: ReadonlyArray<CstNode>,
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
  args: Readonly<A & ArgNames>
  optArgs?: Readonly<O & ArgNames>
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
