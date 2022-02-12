import { type Observable, combineLatest, of, switchMap } from 'rxjs'

import { isEmpty } from '../utils'

const switchCombineLatest = <T>() =>
  switchMap<Record<string, Observable<T>>, Observable<Record<string, T>>>((s) =>
    // combineLatest alone does not pipe when object is empty.
    isEmpty(s) ? of({}) : combineLatest(s),
  )

export default switchCombineLatest
