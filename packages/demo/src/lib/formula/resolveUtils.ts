import type { CellError, CellValue } from '#lib/cells'

import { ValErr } from './errors'

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
