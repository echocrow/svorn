import {
  BehaviorSubject,
  Observable,
  type Observer,
  Subscription,
  combineLatest,
  filter,
  finalize,
  map,
  of,
  shareReplay,
  switchMap,
} from 'rxjs'
import DerivedBehaviorSubject from './DerivedBehaviorSubject'
import DerivedBehaviorSubscribable from './DerivedBehaviorSubscribable'
import switchExhaustAll from '$lib/operators/switchExhaustAll'
import { isEmpty } from '$lib/utils'

class BehaviorMember<T> extends DerivedBehaviorSubject<T> {
  #family: BehaviorFamily<T>
  #key: string

  constructor(family: BehaviorFamily<T>, key: string, defaultValue: T) {
    super(defaultValue)
    this.#family = family
    this.#key = key
  }

  next(value: T) {
    this.#family.next(this.#key, value)
  }

  error(err: unknown) {
    this.#family.error(this.#key, err)
  }

  complete() {
    this.#family.reset(this.#key)
  }

  protected _calcValue(): T {
    return this.#family.getValue(this.#key)
  }

  protected _innerSubscribe(subject: Observer<T>): Subscription {
    return this.#family.subscribe(this.#key, subject)
  }
}

type BehaviorRecord<T> = Record<string, BehaviorSubject<T>>

type BehaviorFamilyRecord<T> = Record<string, T>

class BehaviorFamilySnap<T> extends DerivedBehaviorSubscribable<
  BehaviorFamilyRecord<T>
> {
  #store: BehaviorSubject<BehaviorRecord<T>>

  constructor(store: BehaviorSubject<BehaviorRecord<T>>) {
    super({})
    this.#store = store
  }

  protected _calcValue(): BehaviorFamilyRecord<T> {
    return Object.entries(this.#store.getValue()).reduce((values, [k, v]) => {
      values[k] = v.getValue()
      return values
    }, {} as BehaviorFamilyRecord<T>)
  }

  protected _innerSubscribe(
    subject: Observer<BehaviorFamilyRecord<T>>,
  ): Subscription {
    return this.#store
      .pipe(
        // combineLatest alone does not pipe when object is empty.
        switchMap((s) => (isEmpty(s) ? of({}) : combineLatest(s))),
      )
      .subscribe(subject)
  }
}

class BehaviorFamily<T> {
  #store = new BehaviorSubject<BehaviorRecord<T>>({})
  #default: T
  #sourcesCache: Record<string, Observable<T>> = {}

  constructor(defaultValue: T, initial?: BehaviorFamilyRecord<T>) {
    this.#default = defaultValue
    if (initial) {
      for (const [k, v] of Object.entries(initial)) this.set(k, v)
    }
  }

  subscribe(key: string, observer: Partial<Observer<T>>): Subscription {
    let src = this.#sourcesCache[key]
    if (!src) {
      src = this.#sourcesCache[key] = this.#store.pipe(
        map((v) => v[key]),
        filter(Boolean),
        switchExhaustAll(),
        finalize(() => delete this.#sourcesCache[key]),
        shareReplay({ bufferSize: 1, refCount: true }),
      )
    }
    return src.subscribe(observer)
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

  error(key: string, err: unknown): void {
    const data = this.#store.getValue()
    const sub = data[key]
    if (sub) sub.error(err)
    else this.#store.error(err)
  }

  set(key: string, value: T): void {
    return this.next(key, value)
  }

  get(key: string): BehaviorMember<T> {
    return new BehaviorMember(this, key, this.#default)
  }

  getValue(key: string): T {
    return this.#store.getValue()[key]?.getValue() ?? this.#default
  }

  complete(): void {
    for (const k of Object.keys(this.#store)) this.reset(k)
    this.#store.complete()
  }

  snap(): BehaviorFamilySnap<T> {
    return new BehaviorFamilySnap(this.#store)
  }
}

export default BehaviorFamily
