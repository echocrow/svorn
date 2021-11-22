import {
  BehaviorSubject,
  combineLatest,
  filter,
  map,
  Observable,
  Subscriber,
  Subscription,
  switchMap,
} from 'rxjs'
import type { TeardownLogic } from 'rxjs'

const switchComplete =
  <T>() =>
  (outer: Observable<Observable<T>>) =>
    new Observable((subscriber: Subscriber<T>) => {
      let outerSub: Subscription | void
      let innerSub: Subscription | void

      const reset = () => {
        outerSub = outerSub?.unsubscribe()
        innerSub = innerSub?.unsubscribe()
      }

      const restart = () => {
        reset()
        let outerFired = false
        outerSub = outer.subscribe({
          next: (inner) => {
            outerFired = true
            reset()
            innerSub = inner.subscribe({
              next: (v) => subscriber.next(v),
              error: (e) => subscriber.error(e),
              complete: restart,
            })
          },
          error: (e) => subscriber.error(e),
          complete: () => subscriber.complete(),
        })
        if (outerFired) outerSub = outerSub?.unsubscribe()
      }
      restart()

      return reset
    })

const defaultWith =
  <T>(def: T) =>
  (source: Observable<T>) =>
    new Observable((subscriber: Subscriber<T>) => {
      let fired = false
      const subscription = source.subscribe({
        next: (v) => {
          fired = true
          subscriber.next(v)
        },
        error: (e) => subscriber.error(e),
        complete: () => subscriber.complete(),
      })
      if (!fired) subscriber.next(def)
      return subscription
    })

class WriteObservable<T> extends Observable<T> {
  constructor(
    private _next: (value: T) => void,
    subscribe?: (
      this: Observable<T>,
      subscriber: Subscriber<T>,
    ) => TeardownLogic,
  ) {
    super(subscribe)
  }

  next(value: T) {
    this._next(value)
  }
}

interface AtomFamilyOptions<T> {
  default: T
  initial?: Record<string, T>
}

const atomFamily = <T>({ default: def, initial }: AtomFamilyOptions<T>) => {
  const store = new BehaviorSubject<Record<string, BehaviorSubject<T>>>({})

  const snap = store.pipe(switchMap((s) => combineLatest(s)))

  const del = (key: string) => {
    const data = store.getValue()
    const sub = data[key]
    if (sub) {
      sub.next(def)
      delete data[key]
      store.next(data)
      sub.complete()
    }
  }

  const set = (key: string, value: T) => {
    const data = store.getValue()
    if (value === def) return del(key)

    const sub = data[key]
    if (sub) {
      sub.next(value)
    } else {
      data[key] = new BehaviorSubject(value)
      store.next(data)
    }
  }
  const update = (key: string, getValue: (curr: T) => T) => {
    const data = store.getValue()
    const value = getValue(data[key]?.getValue() ?? def)
    return set(key, value)
  }

  const get = (key: string) => {
    const observable = store.pipe(
      map((v) => v[key]),
      filter(Boolean),
      switchComplete(),
      defaultWith(def),
    )
    const next = (v: T) => set(key, v)
    return new WriteObservable(next, (subscriber: Subscriber<T>) =>
      observable.subscribe(subscriber),
    )
  }

  if (initial) for (const [k, v] of Object.entries(initial)) set(k, v)

  return { get, set, del, update, store, snap }
}

export const sheet = atomFamily<string | number>({
  default: '',
  initial: {
    B2: '!',
  },
})
