import type { Subscriber, Subscription } from 'rxjs'

import DerivedReader from '../helpers/DerivedReader'
import FamilySourceCache from '../helpers/FamilySourceCache'
import type { FamilyKey, InteropObserver, ReadableFamily } from '../types'
import {
  Deriver,
  DeriverAsyncBehavior,
  DeriverAsyncThen,
  DeriverBehavior,
  DeriverSyncBehavior,
  DeriverSyncThen,
  DeriverThen,
  Readables,
} from './derived'

type DeriverFamilySyncThen<S extends Readables, V> = DeriverSyncThen<S, V>
type DeriverFamilyAsyncThen<S extends Readables, V> = DeriverAsyncThen<S, V>
type DeriverFamilyThen<S extends Readables, V> = DeriverThen<S, V>

type DeriverFamilySyncBehavior<S extends Readables, V> = DeriverSyncBehavior<
  S,
  V
>
type DeriverFamilyAsyncBehavior<S extends Readables, V> = DeriverAsyncBehavior<
  S,
  V
>
type DeriverFamilyBehavior<S extends Readables, V> = DeriverBehavior<S, V>

export class DeriverMember<
  S extends Readables,
  V,
  K extends FamilyKey,
> extends DerivedReader<V> {
  #family: DeriverFamily<S, V, K>
  #key: K

  constructor(family: DeriverFamily<S, V, K>, key: K) {
    super()
    this.#family = family
    this.#key = key
  }

  protected _subscribe(subject: Subscriber<V>): Subscription {
    return this.#family.subscribeTo(this.#key, subject)
  }
}

export class DeriverFamily<S extends Readables, V, K extends FamilyKey = string>
  implements ReadableFamily<V, K>
{
  #sourcesCache: FamilySourceCache<Deriver<S, V>, K>

  constructor(
    getSource: (key: K) => S,
    thenOrBehavior:
      | DeriverFamilyAsyncThen<S, V>
      | DeriverFamilyAsyncBehavior<S, V>,
    initialValue?: V,
  )
  constructor(
    getSource: (key: K) => S,
    thenOrBehavior: DeriverFamilyThen<S, V> | DeriverFamilyBehavior<S, V>,
    initialValue?: V,
  )
  constructor(
    getSource: (key: K) => S,
    thenOrBehavior: DeriverFamilyThen<S, V> | DeriverFamilyBehavior<S, V>,
    initialValue?: V,
  ) {
    const hasInitialValue = arguments.length >= 3
    this.#sourcesCache = new FamilySourceCache((key) =>
      hasInitialValue
        ? new Deriver(getSource(key), thenOrBehavior, initialValue)
        : new Deriver(getSource(key), thenOrBehavior),
    )
  }

  subscribeTo(key: K, observerOrNext: InteropObserver<V>): Subscription {
    return this.#sourcesCache.subscribe(key, observerOrNext)
  }

  get(key: K): DeriverMember<S, V, K> {
    return new DeriverMember(this, key)
  }
}

type DerivedFamilyOptions<S extends Readables, V> =
  | DeriverFamilyThen<S, V>
  | DeriverFamilyBehavior<S, V>

function derivedFamily<S extends Readables, V, K extends FamilyKey = string>(
  getSource: (key: K) => S,
  thenOrBehavior?:
    | DeriverFamilyAsyncThen<S, V>
    | DeriverFamilyAsyncBehavior<S, V>,
  initialValue?: V,
): DeriverFamily<S, V, K>
function derivedFamily<S extends Readables, V, K extends FamilyKey = string>(
  getSource: (key: K) => S,
  behavior?: DerivedFamilyOptions<S, V>,
  initialValue?: V,
): DeriverFamily<S, V, K>

function derivedFamily<S extends Readables, V, K extends FamilyKey = string>(
  getSource: (key: K) => S,
  thenOrBehavior: DerivedFamilyOptions<S, V> = (v: V) => v,
  initialValue?: V,
): DeriverFamily<S, V, K> {
  const hasInitialValue = arguments.length >= 3
  return hasInitialValue
    ? new DeriverFamily(getSource, thenOrBehavior, initialValue)
    : new DeriverFamily(getSource, thenOrBehavior)
}

export default derivedFamily
