import { BehaviorSubject } from 'rxjs'
import { nameCell } from './cells'
import { BehaviorFamily, BehaviorSelector } from 'rxcoil'

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
