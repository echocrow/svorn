import {
  BehaviorSubject,
  Observable,
  type Observer,
  type Subscribable,
  Subscriber,
  Subscription,
  combineLatest,
  filter,
  finalize,
  map,
  of,
  shareReplay,
  switchMap,
} from 'rxjs'
import { nameCell } from './cells'
import { switchExhaustAll } from './rxjs'

const objIsEmpty = (
  obj: Record<string | number | symbol, unknown>,
): boolean => {
  for (const _ in obj) return false
  return true
}

interface BehaviorSubscribable<T> extends Subscribable<T> {
  getValue(): T
}
interface BehaviorSubjectLike<T>
  extends Observer<T>,
    BehaviorSubscribable<T> {
  next(value: T): void
}

abstract class DerivedBehaviorSubscribable<T>
  extends Observable<T>
  implements BehaviorSubscribable<T>
{
  #subject: BehaviorSubject<T>
  #refCount = 0
  #subscription: Subscription | null = null

  constructor(defaultValue: T) {
    super()
    this.#subject = new BehaviorSubject(defaultValue)
  }

  getValue(): T {
    return this.#subscription ? this.#subject.getValue() : this._calcValue()
  }

  /** @final */
  protected _subscribe(subscriber: Subscriber<T>): Subscription {
    this.#refCount++
    if (!this.#subscription) {
      this.#subject.next(this._calcValue())
      this.#subscription = this._innerSubscribe(this.#subject)
    }
    const subscription = this.#subject.subscribe(subscriber)
    subscription.add(() => {
      this.#refCount--
      if (!this.#refCount) {
        this.#subscription?.unsubscribe()
        this.#subscription = null
      }
    })
    return subscription
  }

  /** @internal */
  protected abstract _calcValue(): T

  /** @internal */
  protected abstract _innerSubscribe(subject: Observer<T>): Subscription
}

abstract class DerivedBehaviorSubject<T>
  extends DerivedBehaviorSubscribable<T>
  implements BehaviorSubjectLike<T>
{
  abstract next(value: T): void

  abstract error(err: unknown): void

  abstract complete(): void
}

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
        switchMap((s) => (objIsEmpty(s) ? of({}) : combineLatest(s))),
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

const checkSetsEqual = <T>(a: Set<T>, b: Set<T>): boolean => {
  if (a.size !== b.size) return false
  for (const v of a) if (!b.has(v)) return false
  return true
}

type BehaviorSelectorGetter<T> = (
  get: <B>(bg: BehaviorSubscribable<B>) => B,
) => T

class BehaviorSelector<T> extends DerivedBehaviorSubscribable<T> {
  #deps = new BehaviorSubject(new Set<BehaviorSubscribable<unknown>>())
  #getter: BehaviorSelectorGetter<T>
  #source: Observable<T> = this.#deps.pipe(
    switchMap((v) => (v.size ? combineLatest([...v]) : of(undefined))),
    map(() => this._calcValue()),
    shareReplay(1),
  )

  constructor(getter: BehaviorSelectorGetter<T>) {
    super(BehaviorSelector._calcValue(getter).value)
    this.#getter = getter
  }

  protected _calcValue(): T {
    const { value, deps } = BehaviorSelector._calcValue(this.#getter)
    const oldDeps = this.#deps.getValue()
    if (!checkSetsEqual(oldDeps, deps)) this.#deps.next(deps)
    return value
  }

  protected _innerSubscribe(subject: Observer<T>): Subscription {
    return this.#source.subscribe(subject)
  }

  static _calcValue<T>(getter: BehaviorSelectorGetter<T>): {
    value: T
    deps: Set<BehaviorSubscribable<unknown>>
  } {
    const deps = new Set<BehaviorSubscribable<unknown>>()
    const get = <B>(source: BehaviorSubscribable<B>): B => {
      deps.add(source)
      return source.getValue()
    }
    const value = getter(get)
    return { value, deps }
  }
}

export const sheet = new BehaviorFamily('' as string | number, {
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
