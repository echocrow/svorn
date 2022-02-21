import { derived, writable, writableFamily } from 'svorn'

import { type CellCoord, nameCell, parseCellName } from './cells'

export const sheet = writableFamily<string | number>('', {
  B2: '!',
})

export const currCellCoords = writable<CellCoord>([0, 1])

export const currCellName = derived(currCellCoords, {
  then: ([row, col]) => nameCell(row, col),
  next: (name: string) => currCellCoords.next(parseCellName(name)),
})

export const currCol = derived(currCellCoords, {
  then: ([_, col]) => col,
  next: (col: number) => {
    const [row, _] = currCellCoords.getValue()
    currCellCoords.next([row, col])
  },
})
export const currRow = derived(currCellCoords, {
  then: ([row, _]) => row,
  next: (row: number) => {
    const [_, col] = currCellCoords.getValue()
    currCellCoords.next([row, col])
  },
})

export const currCell = derived(currCellName, (cellName) => sheet.get(cellName))
