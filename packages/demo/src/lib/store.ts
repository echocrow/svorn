import { combineLatest, Observable, of, switchMap } from 'rxjs'
import { derived, derivedFamily, writable, writableFamily } from 'svorn'

import {
  type CellCoord,
  type CellValue,
  type CellValues,
  CellError,
  nameCell,
  parseCellName,
} from './cells'
import parse, { type ParseResult } from './formula/parse'
import resolve from './formula/resolve'
import { clamp } from './utils'

export const cells = writableFamily('')

export const colsLen = writable(5)
export const rowsLen = writable(10)

export const currCellCoords = writable<CellCoord>([0, 0])
export const setCurrCellCoords = (col: number, row: number) =>
  currCellCoords.next([
    clamp(0, col, colsLen.getValue() - 1),
    clamp(0, row, rowsLen.getValue() - 1),
  ])
export const moveCurrCellCoords = (col: number, row: number) => {
  const [currCol, currRow] = currCellCoords.getValue()
  setCurrCellCoords(currCol + col, currRow + row)
}

export const currCellName = derived(currCellCoords, {
  then: ([col, row]) => nameCell(col, row),
  next: (name: string) => setCurrCellCoords(...parseCellName(name)),
})

export const currCol = derived(currCellCoords, {
  then: ([col, _]) => col,
  next: (col: number) => {
    const [_, row] = currCellCoords.getValue()
    setCurrCellCoords(col, row)
  },
})
export const currRow = derived(currCellCoords, {
  then: ([_, row]) => row,
  next: (row: number) => {
    const [col, _] = currCellCoords.getValue()
    setCurrCellCoords(col, row)
  },
})

export const currCell = derived(currCellName, (cellName) => cells.get(cellName))

export const parsedCells = derivedFamily((cell: string) => ({
  source: cells.get(cell),
  then: (txt) => parse(txt),
}))

const CircularDepErr = new CellError('LOOP', 'Circular dependency')

export const resolvedCells = derivedFamily((cell: string) => ({
  source: parsedCells
    .get(cell)
    .pipe(
      switchMap((parsed) =>
        combineLatest([of(parsed), combineCellDeps(parsed.cells)]),
      ),
    ),
  then: ([parsed, vals]: [ParseResult, CellValues]) => resolve(parsed, vals),
  catch: () => CircularDepErr,
}))

const combineCellDeps = (
  deps: Set<string>,
): Observable<Record<string, CellValue>> => {
  if (!deps.size) return of({})
  const obs: Record<string, Observable<CellValue>> = {}
  for (const dep of deps) obs[dep] = resolvedCells.get(dep)
  return combineLatest(obs)
}
