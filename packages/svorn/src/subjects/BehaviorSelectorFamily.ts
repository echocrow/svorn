import type { Observer, Subscription } from 'rxjs'

import BehaviorSelectorSource from '../helpers/BehaviorSelectorSource'
import FamilySourceCache from '../helpers/FamilySourceCache'
import type { BehaviorSelectorGetter, Family, FamilyKey } from '../types'
import DerivedSubscribable from './DerivedSubscribable'

class BehaviorSelectorMember<
  V,
  K extends FamilyKey,
> extends DerivedSubscribable<V> {
  #family: BehaviorSelectorFamily<V, K>
  #key: K

  constructor(family: BehaviorSelectorFamily<V, K>, key: K) {
    super()
    this.#family = family
    this.#key = key
  }

  protected _subscribe(subject: Observer<V>): Subscription {
    return this.#family.subscribe(this.#key, subject)
  }
}

export type BehaviorSelectorFamilyGetter<V, K extends FamilyKey> = (
  key: K,
) => BehaviorSelectorGetter<V>

class BehaviorSelectorFamily<V, K extends FamilyKey = string>
  implements Family<V, K>
{
  #sourcesCache: FamilySourceCache<BehaviorSelectorSource<V>, K>

  constructor(getter: BehaviorSelectorFamilyGetter<V, K>) {
    this.#sourcesCache = new FamilySourceCache(
      (key): BehaviorSelectorSource<V> =>
        new BehaviorSelectorSource(getter(key)),
      {
        connector: BehaviorSelectorSource.getConnector,
        preSubscribe: ({ source, isFirst }) => {
          if (!isFirst) source.healthCheck()
        },
      },
    )
  }

  subscribe(key: K, observer: Partial<Observer<V>>): Subscription {
    return this.#sourcesCache.subscribe(key, observer)
  }

  get(key: K): BehaviorSelectorMember<V, K> {
    return new BehaviorSelectorMember(this, key)
  }
}

export default BehaviorSelectorFamily
