import {
  BehaviorSubject,
  Observable,
  Subscription,
  combineLatest,
  filter,
  map,
  of,
  shareReplay,
  switchMap,
} from 'rxjs'
import type { Observer, Subscribable, Unsubscribable } from 'rxjs'
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

class BehaviorMember<T> implements BehaviorSubjectLike<T> {
  #family: BehaviorFamily<T>
  #key: string
  #source: Observable<T>

  #subject: BehaviorSubject<T>
  #refCount = 0
  #subscription: Subscription | null = null

  constructor(
    family: BehaviorFamily<T>,
    key: string,
    source: Observable<T>,
    defaultValue: T,
  ) {
    this.#family = family
    this.#key = key
    this.#source = source
    this.#subject = new BehaviorSubject(defaultValue)
  }

  getValue(): T {
    return this.#subscription ? this.#subject.getValue() : this._calcValue()
  }

  next(value: T) {
    this.#family.next(this.#key, value)
  }

  error(err: unknown) {
    this.#subject.error(err)
  }

  complete() {
    this.#family.reset(this.#key)
  }

  subscribe(observer: Partial<Observer<T>>): Unsubscribable {
    this.#refCount++
    if (!this.#subscription) {
      this.#subject.next(this._calcValue())
      this.#subscription = this.#source.subscribe(this.#subject)
    }
    const subscription = this.#subject.subscribe(observer)
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
  protected _calcValue(): T {
    return this.#family.getValue(this.#key)
  }
}

type BehaviorRecord<T> = Record<string, BehaviorSubject<T>>

type BehaviorFamilyRecord<T> = Record<string, T>

class BehaviorFamilySnap<T>
  extends Observable<BehaviorFamilyRecord<T>>
  implements BehaviorSubscribable<BehaviorFamilyRecord<T>>
{
  #store: BehaviorSubject<BehaviorRecord<T>>

  constructor(store: BehaviorSubject<BehaviorRecord<T>>) {
    super((subscriber) =>
      store
        .pipe(
          // combineLatest alone does not pipe when object is empty.
          switchMap((s) => (objIsEmpty(s) ? of({}) : combineLatest(s))),
        )
        .subscribe(subscriber),
    )
    this.#store = store
  }

  getValue(): BehaviorFamilyRecord<T> {
    return Object.entries(this.#store.getValue()).reduce((values, [k, v]) => {
      values[k] = v.getValue()
      return values
    }, {} as BehaviorFamilyRecord<T>)
  }
}

class BehaviorFamily<T> {
  #store = new BehaviorSubject<BehaviorRecord<T>>({})
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
    const source = this.#store.pipe(
      map((v) => v[key]),
      filter(Boolean),
      switchExhaustAll(),
    )
    return new BehaviorMember(this, key, source, this.#default)
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

class BehaviorSelector<T>
  extends Observable<T>
  implements BehaviorSubscribable<T>
{
  #deps = new BehaviorSubject(new Set<BehaviorSubscribable<unknown>>())
  #source: Observable<T> | undefined = undefined
  #get: BehaviorSelectorGetter<T>

  constructor(get: BehaviorSelectorGetter<T>) {
    super((subscriber) => this._source().subscribe(subscriber))
    this.#get = get
  }

  private _source() {
    if (this.#source) return this.#source

    // Collect dependencies for the first time.
    this.getValue()

    return (this.#source = this.#deps.pipe(
      switchMap((v) => (v.size ? combineLatest([...v]) : of(undefined))),
      map(() => this.getValue()),
      shareReplay(1),
    ))
  }

  getValue(): T {
    // todo: cache in behavior
    const deps = new Set<BehaviorSubscribable<unknown>>()
    const handleGet = <B>(source: BehaviorSubscribable<B>): B => {
      deps.add(source)
      return source.getValue()
    }
    const value = this.#get(handleGet)

    const oldDeps = this.#deps.getValue()
    if (!checkSetsEqual(oldDeps, deps)) {
      this.#deps.next(deps)
    }

    return value
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
