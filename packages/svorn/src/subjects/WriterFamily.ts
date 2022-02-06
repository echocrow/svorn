import {
  type Observable,
  type Observer,
  type Subscription,
  combineLatest,
  filter,
  map,
  of,
  switchMap,
} from 'rxjs'

import DerivedReader from '../helpers/DerivedReader'
import DerivedWriter from '../helpers/DerivedWriter'
import FamilySourceCache from '../helpers/FamilySourceCache'
import switchExhaustAll from '../operators/switchExhaustAll'
import type {
  FamilyKey,
  Readable,
  RxObserverOrNext,
  WritableFamily,
} from '../types'
import { isEmpty, stringify } from '../utils'
import Writer from './Writer'

class WriterMember<V, K extends FamilyKey> extends DerivedWriter<V> {
  #family: WriterFamily<V, K>
  #key: K

  constructor(family: WriterFamily<V, K>, key: K) {
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

  getValue(): V {
    return this.#family.getValue(this.#key)
  }

  protected _subscribe(subject: Observer<V>): Subscription {
    return this.#family.subscribe(this.#key, subject)
  }
}

type WriterRecord<V> = Record<string, Writer<V>>

type WriterFamilyRecord<V> = Record<string, V>

class FamilySnap<V>
  extends DerivedReader<WriterFamilyRecord<V>>
  implements Readable<WriterFamilyRecord<V>>
{
  #store: Writer<WriterRecord<V>>

  constructor(store: Writer<WriterRecord<V>>) {
    super()
    this.#store = store
  }

  protected _subscribe(subject: Observer<WriterFamilyRecord<V>>): Subscription {
    return this.#store
      .pipe(
        // combineLatest alone does not pipe when object is empty.
        switchMap((s) => (isEmpty(s) ? of({}) : combineLatest(s))),
      )
      .subscribe(subject)
  }
}

class WriterFamily<V, K extends FamilyKey = string>
  implements WritableFamily<V, K>
{
  #store = new Writer<WriterRecord<V>>({})
  #default: V
  #sourcesCache: FamilySourceCache<Observable<V>, K>

  constructor(defaultValue: V, initial?: WriterFamilyRecord<V>) {
    this.#default = defaultValue
    this.#sourcesCache = new FamilySourceCache(
      (_, k) =>
        this.#store.pipe(
          map((v) => v[k]),
          filter(Boolean),
          switchExhaustAll(),
        ),
      { connector: () => new Writer(defaultValue) },
    )
    if (initial) {
      for (const [k, v] of Object.entries(initial)) this.next(k as K, v)
    }
  }

  subscribe(key: K, observerOrNext: RxObserverOrNext<V>): Subscription {
    return this.#sourcesCache.subscribe(key, observerOrNext)
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
      data[k] = new Writer(value)
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

  get(key: K): WriterMember<V, K> {
    return new WriterMember(this, key)
  }

  getValue(key: K): V {
    const k = stringify(key)
    return this.#store.getValue()[k]?.getValue() ?? this.#default
  }

  complete(): void {
    for (const k of Object.keys(this.#store)) this.reset(k as K)
    this.#store.complete()
  }

  snap(): FamilySnap<V> {
    return new FamilySnap(this.#store)
  }
}

export const writableFamily = <V, K extends FamilyKey = string>(
  defaultValue: V,
  initial?: WriterFamilyRecord<V>,
): WriterFamily<V, K> => new WriterFamily(defaultValue, initial)

export default WriterFamily
