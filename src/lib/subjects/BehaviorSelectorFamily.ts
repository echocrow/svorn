import type { BehaviorSelectorGetter, FamilyKey } from '$lib/types'
import BehaviorSelector from './BehaviorSelector'

export type BehaviorSelectorFamilyGetter<V, K extends FamilyKey> = (
  key: K,
) => BehaviorSelectorGetter<V>

class BehaviorSelectorFamily<V, K extends FamilyKey = string> {
  #getter: BehaviorSelectorFamilyGetter<V, K>

  constructor(getter: BehaviorSelectorFamilyGetter<V, K>) {
    this.#getter = getter
  }

  get(key: K): BehaviorSelector<V> {
    const getter = this.#getter(key)
    return new BehaviorSelector(getter)
  }
}

export default BehaviorSelectorFamily
