import {
  BehaviorSubject,
  combineLatest,
  filter,
  finalize,
  map,
  Observable,
  of,
  shareReplay,
  switchMap,
} from 'rxjs'
import { nameCell } from './cells'
import { defaultWith, switchExhaustAll } from './rxjs'

interface BehaviorGettable<T> extends Observable<T> {
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
  extends Observable<BehaviorFamilyRecord<T>>
  implements BehaviorGettable<BehaviorFamilyRecord<T>>
{
  #store: BehaviorSubject<BehaviorRecord<T>>

  constructor(store: BehaviorSubject<BehaviorRecord<T>>) {
    super((subscriber) =>
      store.pipe(switchMap((s) => combineLatest(s))).subscribe(subscriber),
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
      switchExhaustAll(),
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

const checkSetsEqual = <T>(a: Set<T>, b: Set<T>): boolean => {
  if (a.size !== b.size) return false
  for (const v of a) if (!b.has(v)) return false
  return true
}

type BehaviorSelectorGetter<T> = (get: <B>(bg: BehaviorGettable<B>) => B) => T

class BehaviorSelector<T>
  extends Observable<T>
  implements BehaviorGettable<T>
{
  #deps = new BehaviorSubject(new Set<BehaviorGettable<unknown>>())
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
    const deps = new Set<BehaviorGettable<unknown>>()
    const handleGet = <B>(source: BehaviorGettable<B>): B => {
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
