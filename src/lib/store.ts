import type { Observer, OperatorFunction, Subscribable } from 'rxjs'
import {
  BehaviorSubject,
  combineLatest,
  filter,
  finalize,
  map,
  Observable,
  shareReplay,
  Subscriber,
  Subscription,
  switchMap,
} from 'rxjs'

const switchComplete =
  <T>(): OperatorFunction<Observable<T>, T> =>
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

interface BehaviorGettable<T> extends Subscribable<T> {
  getValue(): T
}
interface BehaviorSettable<T> extends BehaviorGettable<T> {
  next(value: T): void
}

class BehaviorMember<T> extends Observable<T> implements BehaviorSettable<T> {
  #family: BehaviorFamily<T>
  #key: string

  constructor(family: BehaviorFamily<T>, key: string, source: Observable<T>) {
    super((subscriber) => source.subscribe(subscriber))
    this.#family = family
    this.#key = key
  }

  getValue(): T {
    return this.#family.getValue(this.#key)
  }

  next(value: T) {
    this.#family.next(this.#key, value)
  }

  reset() {
    this.#family.reset(this.#key)
  }
}

type BehaviorRecord<T> = Record<string, BehaviorSubject<T>>

type BehaviorFamilyRecord<T> = Record<string, T>

class BehaviorFamilySnap<T>
  implements BehaviorGettable<BehaviorFamilyRecord<T>>
{
  #store: BehaviorSubject<BehaviorRecord<T>>
  #snap: Observable<BehaviorFamilyRecord<T>>

  constructor(store: BehaviorSubject<BehaviorRecord<T>>) {
    this.#store = store
    this.#snap = this.#store.pipe(switchMap((s) => combineLatest(s)))
  }

  getValue(): BehaviorFamilyRecord<T> {
    return Object.entries(this.#store.getValue()).reduce((values, [k, v]) => {
      values[k] = v.getValue()
      return values
    }, {} as BehaviorFamilyRecord<T>)
  }

  subscribe(
    observerOrNext?:
      | Partial<Observer<BehaviorFamilyRecord<T>>>
      | ((value: BehaviorFamilyRecord<T>) => void)
      | null,
  ): Subscription {
    // TypeScript is struggling.
    return typeof observerOrNext === 'function'
      ? this.#snap.subscribe(observerOrNext)
      : this.#snap.subscribe(observerOrNext ?? undefined)
  }
}

class BehaviorFamily<T> {
  #store = new BehaviorSubject<BehaviorRecord<T>>({})
  #default: T
  #membersCache: Record<string, BehaviorMember<T>> = {}

  constructor(defaultValue: T, initial?: BehaviorFamilyRecord<T>) {
    this.#default = defaultValue
    if (initial) {
      for (const [k, v] of Object.entries(initial)) this.set(k, v)
    }
  }

  reset(key: string): void {
    const data = this.#store.getValue()
    const sub = data[key]
    if (sub) {
      sub.next(this.#default)
      delete data[key]
      this.#store.next(data)
      sub.complete()
    }
  }

  next(key: string, value: T): void {
    const data = this.#store.getValue()
    if (value === this.#default) return this.reset(key)

    const sub = data[key]
    if (sub) {
      sub.next(value)
    } else {
      data[key] = new BehaviorSubject(value)
      this.#store.next(data)
    }
  }

  set(key: string, value: T): void {
    return this.next(key, value)
  }

  get(key: string): BehaviorMember<T> {
    const cached = this.#membersCache[key]
    if (cached) return cached

    const source = this.#store.pipe(
      map((v) => v[key]),
      filter(Boolean),
      switchComplete(),
      defaultWith(this.#default),
      finalize(() => delete this.#membersCache[key]),
      shareReplay(1),
    )
    const member = new BehaviorMember(this, key, source)
    this.#membersCache[key] = member
    return member
  }

  getValue(key: string): T {
    return this.#store.getValue()[key]?.getValue() ?? this.#default
  }

  snap(): BehaviorFamilySnap<T> {
    return new BehaviorFamilySnap(this.#store)
  }
}

export const sheet = new BehaviorFamily('' as string | number, {
  B2: '!',
})
