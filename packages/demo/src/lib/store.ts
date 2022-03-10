import { derived, derivedFamily, writable, writableFamily } from 'svorn'

import { type CellCoord, nameCell, parseCellName } from './cells'
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

export const outputCells = derivedFamily((cell: string) => ({
  source: cells.get(cell),
  then: (txt) => `[${txt}]`,
}))
