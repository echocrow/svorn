import type { Observer, Subscription } from 'rxjs'
import type { BehaviorSelectorGetter, FamilyKey } from '$lib/types'
import DerivedSubscribable from './DerivedSubscribable'
import FamilySourceCache from '$lib/helpers/FamilySourceCache'
import BehaviorSelectorSource from '$lib/helpers/BehaviorSelectorSource'

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

class BehaviorSelectorFamily<V, K extends FamilyKey = string> {
  #sourcesCache: FamilySourceCache<V, K>

  constructor(getter: BehaviorSelectorFamilyGetter<V, K>) {
    this.#sourcesCache = new FamilySourceCache(
      (key) => new BehaviorSelectorSource(getter(key)),
      BehaviorSelectorSource.getConnector,
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
