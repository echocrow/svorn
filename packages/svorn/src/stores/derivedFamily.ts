import type { Subscriber, Subscription } from 'rxjs'

import DerivedReader from '../helpers/DerivedReader'
import FamilySourceCache from '../helpers/FamilySourceCache'
import type { FamilyKey, InteropObserver, ReadableFamily } from '../types'
import {
  type DeriverAsyncBehavior,
  type DeriverBehavior,
  type Readables,
  Deriver,
} from './derived'

interface DeriverFamilyBaseBehavior<S extends Readables, V> {
  source: S
}

interface DeriverFamilyAsyncBehavior<S extends Readables, V>
  extends DeriverAsyncBehavior<S, V>,
    DeriverFamilyBaseBehavior<S, V> {}

interface DeriverFamilyBehavior<S extends Readables, V>
  extends DeriverBehavior<S, V>,
    DeriverFamilyBaseBehavior<S, V> {}

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

  constructor(getBehavior: (key: K) => DeriverFamilyAsyncBehavior<S, V>)
  constructor(getBehavior: (key: K) => DeriverFamilyBehavior<S, V>)
  constructor(getBehavior: (key: K) => DeriverFamilyBehavior<S, V>) {
    this.#sourcesCache = new FamilySourceCache((key) => {
      const behavior = getBehavior(key)
      return new Deriver(behavior.source, behavior)
    })
  }

  subscribeTo(key: K, observerOrNext: InteropObserver<V>): Subscription {
    return this.#sourcesCache.subscribe(key, observerOrNext)
  }

  get(key: K): DeriverMember<S, V, K> {
    return new DeriverMember(this, key)
  }
}

function derivedFamily<S extends Readables, V, K extends FamilyKey = string>(
  getBehavior: (key: K) => DeriverFamilyAsyncBehavior<S, V>,
): DeriverFamily<S, V, K>
function derivedFamily<S extends Readables, V, K extends FamilyKey = string>(
  getBehavior: (key: K) => DeriverFamilyBehavior<S, V>,
): DeriverFamily<S, V, K>

function derivedFamily<S extends Readables, V, K extends FamilyKey = string>(
  getBehavior: (key: K) => DeriverFamilyBehavior<S, V>,
): DeriverFamily<S, V, K> {
  return new DeriverFamily(getBehavior)
}

export default derivedFamily
