import {
  BehaviorSubject,
  type Observer,
  type SubjectLike,
  Subscription,
  combineLatest,
  filter,
  map,
  of,
  switchMap,
} from 'rxjs'
import type { FamilyKey } from '$lib/types'
import DerivedSubscribable from './DerivedSubscribable'
import switchExhaustAll from '$lib/operators/switchExhaustAll'
import { isEmpty, stringify } from '$lib/utils'
import FamilySourceCache from '$lib/helpers/FamilySourceCache'

class BehaviorMember<V, K extends FamilyKey>
  extends DerivedSubscribable<V>
  implements SubjectLike<V>
{
  #family: BehaviorFamily<V, K>
  #key: K

  constructor(family: BehaviorFamily<V, K>, key: K) {
    super()
    this.#family = family
    this.#key = key
  }

  next(value: V) {
    this.#family.next(this.#key, value)
  }

  error(err: unknown) {
    this.#family.error(this.#key, err)
  }

  complete() {
    this.#family.reset(this.#key)
  }

  protected _subscribe(subject: Observer<V>): Subscription {
    return this.#family.subscribe(this.#key, subject)
  }
}

type BehaviorRecord<V> = Record<string, BehaviorSubject<V>>

type BehaviorFamilyRecord<V> = Record<string, V>

class BehaviorFamilySnap<V> extends DerivedSubscribable<
  BehaviorFamilyRecord<V>
> {
  #store: BehaviorSubject<BehaviorRecord<V>>

  constructor(store: BehaviorSubject<BehaviorRecord<V>>) {
    super()
    this.#store = store
  }

  protected _subscribe(
    subject: Observer<BehaviorFamilyRecord<V>>,
  ): Subscription {
    return this.#store
      .pipe(
        // combineLatest alone does not pipe when object is empty.
        switchMap((s) => (isEmpty(s) ? of({}) : combineLatest(s))),
      )
      .subscribe(subject)
  }
}

class BehaviorFamily<V, K extends FamilyKey = string> {
  #store = new BehaviorSubject<BehaviorRecord<V>>({})
  #default: V
  #sourcesCache: FamilySourceCache<V, K>

  constructor(defaultValue: V, initial?: BehaviorFamilyRecord<V>) {
    this.#default = defaultValue
    this.#sourcesCache = new FamilySourceCache(
      (_, k) =>
        this.#store.pipe(
          map((v) => v[k]),
          filter(Boolean),
          switchExhaustAll(),
        ),
      () => new BehaviorSubject(defaultValue),
    )
    if (initial) {
      for (const [k, v] of Object.entries(initial)) this.set(k as K, v)
    }
  }

  subscribe(key: K, observer: Partial<Observer<V>>): Subscription {
    return this.#sourcesCache.subscribe(key, observer)
  }

  reset(key: K): void {
    const k = stringify(key)
    const data = this.#store.getValue()
    const sub = data[k]
    if (sub) {
      sub.next(this.#default)
      delete data[k]
      this.#store.next(data)
      sub.complete()
    }
  }

  next(key: K, value: V): void {
    const k = stringify(key)
    const data = this.#store.getValue()
    if (value === this.#default) return this.reset(key)

    const sub = data[k]
    if (sub) {
      sub.next(value)
    } else {
      data[k] = new BehaviorSubject(value)
      this.#store.next(data)
    }
  }

  error(key: K, err: unknown): void {
    const k = stringify(key)
    const data = this.#store.getValue()
    const sub = data[k]
    if (sub) sub.error(err)
    else this.#store.error(err)
  }

  set(key: K, value: V): void {
    return this.next(key, value)
  }

  get(key: K): BehaviorMember<V, K> {
    return new BehaviorMember(this, key)
  }

  getValue(key: K): V {
    const k = stringify(key)
    return this.#store.getValue()[k]?.getValue() ?? this.#default
  }

  complete(): void {
    for (const k of Object.keys(this.#store)) this.reset(k as K)
    this.#store.complete()
  }

  snap(): BehaviorFamilySnap<V> {
    return new BehaviorFamilySnap(this.#store)
  }
}

export default BehaviorFamily
