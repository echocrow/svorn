import {
  type Observable,
  type Subscriber,
  type Subscription,
  filter,
  map,
} from 'rxjs'

import DerivedReader from '../helpers/DerivedReader'
import DerivedWriter from '../helpers/DerivedWriter'
import FamilySourceCache from '../helpers/FamilySourceCache'
import defaultWith from '../operators/defaultWith'
import switchCombineLatest from '../operators/switchCombineLatest'
import switchExhaustAll from '../operators/switchExhaustAll'
import type {
  FamilyKey,
  InteropObserver,
  WritableFamily,
  WriterFamilyRecord,
} from '../types'
import { stringify } from '../utils'
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
    this.#family.error(err)
  }

  complete() {
    this.#family.complete()
  }

  getValue(): V {
    return this.#family.getValue(this.#key)
  }

  protected _subscribe(subject: Subscriber<V>): Subscription {
    return this.#family.subscribeTo(this.#key, subject)
  }
}

class WriterFamily<V, K extends FamilyKey = string>
  extends DerivedReader<WriterFamilyRecord<V>>
  implements WritableFamily<V, K>
{
  #store = new Writer<Record<string, Writer<V>>>({})
  #default: V
  #sourcesCache: FamilySourceCache<Observable<V>, K>

  constructor(defaultValue: V, initial?: WriterFamilyRecord<V>) {
    super()
    this.#default = defaultValue
    this.#sourcesCache = new FamilySourceCache((_, k) =>
      this.#store.pipe(
        map((v) => v[k]),
        filter(Boolean),
        switchExhaustAll(),
        defaultWith(defaultValue),
      ),
    )
    if (initial) {
      for (const [k, v] of Object.entries(initial)) this.next(k as K, v)
    }
  }

  protected _subscribe(
    subscriber: Subscriber<WriterFamilyRecord<V>>,
  ): Subscription {
    return this.#store.pipe(switchCombineLatest()).subscribe(subscriber)
  }

  subscribeTo(key: K, observerOrNext: InteropObserver<V>): Subscription {
    return this.#sourcesCache.subscribe(key, observerOrNext)
  }

  reset(key: K): void {
    const k = stringify(key)
    const data = this.#store.getValue()
    const sub = data[k]
    if (sub) {
      delete data[k]
      this.#store.next(data)
      sub.next(this.#default)
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

  get(key: K): WriterMember<V, K> {
    return new WriterMember(this, key)
  }

  getValue(key: K): V {
    const k = stringify(key)
    return this.#store.getValue()[k]?.getValue() ?? this.#default
  }

  complete(): void {
    this.#store.complete()
    const data = this.#store.getValue()
    for (const sub of Object.values(data)) sub.complete()
  }

  error(err: unknown): void {
    const data = this.#store.getValue()
    for (const sub of Object.values(data)) sub.error(err)
    this.#store.error(err)
  }
}

export const writableFamily = <V, K extends FamilyKey = string>(
  defaultValue: V,
  initial?: WriterFamilyRecord<V>,
): WriterFamily<V, K> => new WriterFamily(defaultValue, initial)

export default WriterFamily
