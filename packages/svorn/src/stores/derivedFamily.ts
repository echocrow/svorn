import type { Subscriber, Subscription } from 'rxjs'

import DerivedReader from '../helpers/DerivedReader'
import FamilySourceCache from '../helpers/FamilySourceCache'
import type { FamilyKey, ReadableFamily, Writable } from '../types'
import {
  type DeriverAsyncBehavior,
  type DeriverBehavior,
  type IsObserver,
  type WriteDeriverAsyncBehavior,
  type WriteDeriverBehavior,
  type WriteDeriverSyncBehavior,
  behaviorIsObserver,
  Deriver,
  DeriverWriter,
  Readables,
} from './derived'

export interface DeriverFamilyBaseBehavior<S, V> {
  source: Readables<S>
}

export interface DeriverFamilyAsyncBehavior<S, V>
  extends DeriverAsyncBehavior<S, V>,
    DeriverFamilyBaseBehavior<S, V> {}

export interface DeriverFamilyBehavior<S, V>
  extends DeriverBehavior<S, V>,
    DeriverFamilyBaseBehavior<S, V> {}

export class DeriverMember<
  S,
  V,
  K extends FamilyKey,
  B extends DeriverFamilyBehavior<S, V>,
> extends DerivedReader<V> {
  #familySource: FamilySourceCache<Deriver<S, V>, K, B>
  #key: K
  #behavior: B

  constructor(
    familySource: FamilySourceCache<Deriver<S, V>, K, B>,
    key: K,
    behavior: B,
  ) {
    super()
    this.#familySource = familySource
    this.#key = key
    this.#behavior = behavior
  }

  protected _subscribe(subject: Subscriber<V>): Subscription {
    return this.#familySource.subscribe(this.#key, subject, this.#behavior)
  }
}

export interface WriteDeriverFamilyAsyncBehavior<S, V>
  extends WriteDeriverAsyncBehavior<S, V>,
    DeriverFamilyBaseBehavior<S, V> {}
export interface WriteDeriverFamilySyncBehavior<S, V>
  extends WriteDeriverSyncBehavior<S, V>,
    DeriverFamilyBaseBehavior<S, V> {}
export interface WriteDeriverFamilyBehavior<S, V>
  extends WriteDeriverBehavior<S, V>,
    DeriverFamilyBaseBehavior<S, V> {}

export class WriteDeriverMember<
    S,
    V,
    K extends FamilyKey,
    B extends WriteDeriverFamilyBehavior<S, V>,
  >
  extends DeriverWriter<V>
  implements Writable<V>
{
  #readMember: DeriverMember<S, V, K, B>

  constructor(
    familySource: FamilySourceCache<Deriver<S, V>, K, B>,
    key: K,
    behavior: B,
  ) {
    super(behavior)
    this.#readMember = new DeriverMember(familySource, key, behavior)
  }

  protected _subscribe(subscriber: Subscriber<V>): Subscription {
    return this.#readMember.subscribe(subscriber)
  }
}

export class DeriverFamily<
  S,
  V = S,
  K extends FamilyKey = string,
  B extends
    | WriteDeriverFamilyBehavior<S, V>
    | DeriverFamilyBehavior<S, V> = WriteDeriverFamilyBehavior<S, V>,
> implements ReadableFamily<V, K>
{
  #sourcesCache: FamilySourceCache<
    Deriver<S, V>,
    K,
    DeriverFamilyBehavior<S, V>
  >
  #getBehavior: (key: K) => B

  constructor(getBehavior: (key: K) => WriteDeriverFamilyAsyncBehavior<S, V>)
  constructor(getBehavior: (key: K) => WriteDeriverFamilySyncBehavior<S, V>)
  constructor(getBehavior: (key: K) => WriteDeriverFamilyBehavior<S, V>)
  constructor(getBehavior: (key: K) => DeriverFamilyAsyncBehavior<S, V>)
  constructor(getBehavior: (key: K) => DeriverFamilyBehavior<S, V>)
  constructor(getBehavior: (key: K) => B) {
    this.#getBehavior = getBehavior
    this.#sourcesCache = new FamilySourceCache(
      (_key, _k, behavior) => new Deriver(behavior.source, behavior),
    )
  }

  get(
    key: K,
  ): IsObserver<S, V, B> extends true
    ? WriteDeriverMember<S, V, K, B & WriteDeriverFamilyBehavior<S, V>>
    : DeriverMember<S, V, K, B>
  get(key: K) {
    const behavior = this.#getBehavior(key)
    return behaviorIsObserver<S, V, B>(behavior)
      ? new WriteDeriverMember(
          this.#sourcesCache,
          key,
          behavior as B & WriteDeriverFamilyBehavior<S, V>,
        )
      : new DeriverMember(this.#sourcesCache, key, behavior)
  }
}

function derivedFamily<S, V = S, K extends FamilyKey = string>(
  getBehavior: (key: K) => WriteDeriverFamilyAsyncBehavior<S, V>,
): DeriverFamily<S, V, K, WriteDeriverFamilyAsyncBehavior<S, V>>
function derivedFamily<S, V = S, K extends FamilyKey = string>(
  getBehavior: (key: K) => WriteDeriverFamilySyncBehavior<S, V>,
): DeriverFamily<S, V, K, WriteDeriverFamilySyncBehavior<S, V>>
function derivedFamily<S, V = S, K extends FamilyKey = string>(
  getBehavior: (key: K) => WriteDeriverFamilyBehavior<S, V>,
): DeriverFamily<S, V, K, WriteDeriverFamilyBehavior<S, V>>

function derivedFamily<S, V = S, K extends FamilyKey = string>(
  getBehavior: (key: K) => DeriverFamilyAsyncBehavior<S, V>,
): DeriverFamily<S, V, K, DeriverFamilyAsyncBehavior<S, V>>
function derivedFamily<S, V = S, K extends FamilyKey = string>(
  getBehavior: (key: K) => DeriverFamilyBehavior<S, V>,
): DeriverFamily<S, V, K, DeriverFamilyBehavior<S, V>>

function derivedFamily<
  S,
  V = S,
  K extends FamilyKey = string,
  B extends
    | WriteDeriverFamilyBehavior<S, V>
    | DeriverFamilyBehavior<S, V> = WriteDeriverFamilyBehavior<S, V>,
>(getBehavior: (key: K) => B): DeriverFamily<S, V, K, B> {
  return new DeriverFamily(getBehavior)
}

export default derivedFamily
