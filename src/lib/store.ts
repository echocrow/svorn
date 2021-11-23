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
import type { Observer, OperatorFunction, Subscribable } from 'rxjs'

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

class BehaviorMember<T> extends Observable<T> {
  #family: BehaviorFamily<T>
  #key: string

  constructor(
    family: BehaviorFamily<T>,
    key: string,
    def: T,
    store: Observable<BehaviorRecord<T>>,
  ) {
    super((subscriber) =>
      store
        .pipe(
          map((v) => v[key]),
          filter(Boolean),
          switchComplete(),
          defaultWith(def),
        )
        .subscribe(subscriber),
    )
    this.#family = family
    this.#key = key
  }

  getValue(): T {
    return this.#family.getValue(this.#key)
  }

  next(value: T) {
    this.#family.set(this.#key, value)
  }

  reset() {
    this.#family.reset(this.#key)
  }
}

type BehaviorRecord<T> = Record<string, BehaviorSubject<T>>

type BehaviorFamilyRecord<T> = Record<string, T>

class BehaviorFamily<T> implements Subscribable<BehaviorFamilyRecord<T>> {
  #store = new BehaviorSubject<BehaviorRecord<T>>({})
  #snap = this.#store.pipe(switchMap((s) => combineLatest(s)))
  #default: T

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
    return new BehaviorMember(this, key, this.#default, this.#store)
  }

  getValue(key: string): T {
    return this.#store.getValue()[key]?.getValue() ?? this.#default
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

export const sheet = new BehaviorFamily('' as string | number, {
  B2: '!',
})
