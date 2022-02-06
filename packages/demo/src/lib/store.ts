import { BehaviorSubject } from 'rxjs'
import { BehaviorFamily } from 'svorn'

export const sheet = new BehaviorFamily<string | number>('', {
  B2: '!',
})

export const currCol = new BehaviorSubject(1)
export const currRow = new BehaviorSubject(0)
