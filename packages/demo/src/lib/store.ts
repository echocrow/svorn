import { BehaviorSubject } from 'rxjs'
import { BehaviorFamily, BehaviorSelector, BehaviorSelectorFamily } from 'svorn'

import { nameCell, parseCellName } from './cells'

export const sheet = new BehaviorFamily<string | number>('', {
  B2: '!',
})

export const currCol = new BehaviorSubject(1)
export const currRow = new BehaviorSubject(0)

export const currCellName = new BehaviorSelector((get) =>
  nameCell(get(currRow), get(currCol)),
)

export const currCell = new BehaviorSelector((get) =>
  sheet.get(get(currCellName)),
)

export const numberSheet = new BehaviorSelectorFamily(
  (cellName: string) => (get) => {
    const cell = sheet.get(cellName)
    const v = get(cell)
    return typeof v === 'number' ? v : parseInt(v, 10) || 0
  },
)

export const derivedSheet = new BehaviorSelectorFamily(
  (cellName: string) =>
    (get): number => {
      const cell = numberSheet.get(cellName)
      const v = get(cell)
      const [row, col] = parseCellName(cellName)
      if (col === 0) return v
      const prevCol = col - 1
      const prevCellName = nameCell(row, prevCol)
      const prevCell = derivedSheet.get(prevCellName)
      const prevV = get(prevCell)
      return v + prevV
    },
)
