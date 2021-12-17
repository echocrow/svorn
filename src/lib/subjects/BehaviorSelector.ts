import { type Observable, type Observer, type Subscription, share } from 'rxjs'
import type { BehaviorSelectorGetter } from '$lib/types'
import DerivedSubscribable from './DerivedSubscribable'
import BehaviorSelectorSource from '$lib/helpers/BehaviorSelectorSource'

class BehaviorSelector<T> extends DerivedSubscribable<T> {
  #source: Observable<T>

  constructor(getter: BehaviorSelectorGetter<T>) {
    super()
    this.#source = new BehaviorSelectorSource(getter).pipe(
      share({ connector: () => BehaviorSelectorSource.getConnector<T>() }),
    )
  }

  protected _subscribe(subscriber: Observer<T>): Subscription {
    return this.#source.subscribe(subscriber)
  }
}

export default BehaviorSelector
