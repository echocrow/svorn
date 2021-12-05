import {
  BehaviorSubject,
  combineLatest,
  filter,
  finalize,
  map,
  Observable,
  shareReplay,
  switchMap,
} from 'rxjs'
import { switchExhaustAll } from './rxjs'

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

export const sheet = new BehaviorFamily('' as string | number, {
  B2: '!',
})
