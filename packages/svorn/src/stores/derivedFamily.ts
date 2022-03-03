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
  type Readables,
  type WriteDeriverAsyncBehavior,
  type WriteDeriverBehavior,
  type WriteDeriverSyncBehavior,
  behaviorIsObserver,
  Deriver,
  DeriverWriter,
} from './derived'

export interface DeriverFamilyBaseBehavior<S extends Readables, V> {
  source: S
}

export interface DeriverFamilyAsyncBehavior<S extends Readables, V>
  extends DeriverAsyncBehavior<S, V>,
    DeriverFamilyBaseBehavior<S, V> {}

export interface DeriverFamilyBehavior<S extends Readables, V>
  extends DeriverBehavior<S, V>,
    DeriverFamilyBaseBehavior<S, V> {}

interface Family<V, K extends FamilyKey> {
  subscribeTo(key: K, observer: InteropObserver<V>): Subscription
}

export class DeriverMember<
  S extends Readables,
  V,
  K extends FamilyKey,
> extends DerivedReader<V> {
  #family: Family<V, K>
  #key: K

  constructor(family: Family<V, K>, key: K) {
    super()
    this.#family = family
    this.#key = key
  }

  protected _subscribe(subject: Subscriber<V>): Subscription {
    return this.#family.subscribeTo(this.#key, subject)
  }
}

export interface WriteDeriverFamilyAsyncBehavior<S extends Readables, V>
  extends WriteDeriverAsyncBehavior<S, V>,
    DeriverFamilyBaseBehavior<S, V> {}
export interface WriteDeriverFamilySyncBehavior<S extends Readables, V>
  extends WriteDeriverSyncBehavior<S, V>,
    DeriverFamilyBaseBehavior<S, V> {}
export interface WriteDeriverFamilyBehavior<S extends Readables, V>
  extends WriteDeriverBehavior<S, V>,
    DeriverFamilyBaseBehavior<S, V> {}

export class WriteDeriverMember<S extends Readables, V, K extends FamilyKey>
  extends DeriverWriter<V>
  implements Writable<V>
{
  #readMember: DeriverMember<S, V, K>

  constructor(
    family: Family<V, K>,
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
  S extends Readables,
  V,
  B extends
    | WriteDeriverFamilyBehavior<S, V>
    | DeriverFamilyBehavior<S, V> = WriteDeriverFamilyBehavior<S, V>,
  K extends FamilyKey = string,
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

  subscribeTo(key: K, observerOrNext: InteropObserver<V>): Subscription {
    return this.#sourcesCache.subscribe(key, observerOrNext)
  }

  get(
    key: K,
  ): IsObserver<B> extends true
    ? WriteDeriverMember<S, V, K>
    : DeriverMember<S, V, K>
  get(key: K): DeriverMember<S, V, K> | WriteDeriverMember<S, V, K> {
    const behavior = this.#getBehavior(key)
    return behaviorIsObserver(behavior)
      ? new WriteDeriverMember(
          this,
          key,
          behavior as WriteDeriverFamilyBehavior<S, V>,
        )
      : new DeriverMember(this, key)
  }
}

function derivedFamily<S extends Readables, V, K extends FamilyKey = string>(
  getBehavior: (key: K) => WriteDeriverFamilyAsyncBehavior<S, V>,
): DeriverFamily<S, V, WriteDeriverFamilyAsyncBehavior<S, V>, K>
function derivedFamily<S extends Readables, V, K extends FamilyKey = string>(
  getBehavior: (key: K) => WriteDeriverFamilySyncBehavior<S, V>,
): DeriverFamily<S, V, WriteDeriverFamilySyncBehavior<S, V>, K>
function derivedFamily<S extends Readables, V, K extends FamilyKey = string>(
  getBehavior: (key: K) => WriteDeriverFamilyBehavior<S, V>,
): DeriverFamily<S, V, WriteDeriverFamilyBehavior<S, V>, K>

function derivedFamily<S extends Readables, V, K extends FamilyKey = string>(
  getBehavior: (key: K) => DeriverFamilyAsyncBehavior<S, V>,
): DeriverFamily<S, V, DeriverFamilyAsyncBehavior<S, V>, K>
function derivedFamily<S extends Readables, V, K extends FamilyKey = string>(
  getBehavior: (key: K) => DeriverFamilyBehavior<S, V>,
): DeriverFamily<S, V, DeriverFamilyBehavior<S, V>, K>

function derivedFamily<S extends Readables, V, K extends FamilyKey = string>(
  getBehavior: (key: K) => DeriverFamilyBehavior<S, V>,
): DeriverFamily<S, V, DeriverFamilyBehavior<S, V>, K> {
  return new DeriverFamily(getBehavior)
}

export default derivedFamily
