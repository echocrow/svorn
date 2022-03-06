import type { Subscriber, Subscription } from 'rxjs'

import DerivedReader from '../helpers/DerivedReader'
import FamilySourceCache from '../helpers/FamilySourceCache'
import type {
  FamilyKey,
  InteropObserver,
  ReadableFamily,
  Writable,
} from '../types'
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

export class DeriverMember<S, V, K extends FamilyKey> extends DerivedReader<V> {
  #family: DeriverFamily<S, V, K, DeriverFamilyBehavior<S, V>>
  #key: K

  constructor(
    family: DeriverFamily<S, V, K, DeriverFamilyBehavior<S, V>>,
    key: K,
  ) {
    super()
    this.#family = family
    this.#key = key
  }

  protected _subscribe(subject: Subscriber<V>): Subscription {
    return this.#family.subscribeTo(this.#key, subject)
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

export class WriteDeriverMember<S, V, K extends FamilyKey>
  extends DeriverWriter<V>
  implements Writable<V>
{
  #readMember: DeriverMember<S, V, K>

  constructor(
    family: DeriverFamily<S, V, K, DeriverFamilyBehavior<S, V>>,
    key: K,
    behavior: WriteDeriverFamilyBehavior<S, V>,
  ) {
    super(behavior)
    this.#readMember = new DeriverMember(family, key)
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
  #sourcesCache: FamilySourceCache<Deriver<S, V>, K>
  #getBehavior: (key: K) => B

  constructor(getBehavior: (key: K) => WriteDeriverFamilyAsyncBehavior<S, V>)
  constructor(getBehavior: (key: K) => WriteDeriverFamilySyncBehavior<S, V>)
  constructor(getBehavior: (key: K) => WriteDeriverFamilyBehavior<S, V>)
  constructor(getBehavior: (key: K) => DeriverFamilyAsyncBehavior<S, V>)
  constructor(getBehavior: (key: K) => DeriverFamilyBehavior<S, V>)
  constructor(getBehavior: (key: K) => B) {
    this.#getBehavior = getBehavior
    this.#sourcesCache = new FamilySourceCache((key) => {
      const behavior = getBehavior(key)
      return new Deriver(behavior.source, behavior)
    })
  }

  /** @internal */
  subscribeTo(key: K, observerOrNext: InteropObserver<V>): Subscription {
    return this.#sourcesCache.subscribe(key, observerOrNext)
  }

  get(
    key: K,
  ): IsObserver<S, V, B> extends true
    ? WriteDeriverMember<S, V, K>
    : DeriverMember<S, V, K>
  get(key: K): DeriverMember<S, V, K> | WriteDeriverMember<S, V, K> {
    const behavior = this.#getBehavior(key)
    return behaviorIsObserver<S, V, typeof behavior>(behavior)
      ? new WriteDeriverMember(
          this,
          key,
          behavior as WriteDeriverFamilyBehavior<S, V>,
        )
      : new DeriverMember(this, key)
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

function derivedFamily<S, V = S, K extends FamilyKey = string>(
  getBehavior: (key: K) => DeriverFamilyBehavior<S, V>,
): DeriverFamily<S, V, K, DeriverFamilyBehavior<S, V>> {
  return new DeriverFamily(getBehavior)
}

export default derivedFamily
