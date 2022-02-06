import {
  type Observer as RxObserver,
  type Subscriber as RxSubscriber,
  type Subscription as RxSubscription,
  Observable,
} from 'rxjs'
import type {
  Subscriber as SvelteSubscriber,
  Unsubscriber as SvelteUnsubscriber,
} from 'svelte/store'

import type { Readable } from '../types'

abstract class DerivedReader<V> extends Observable<V> implements Readable<V> {
  constructor() {
    super()
  }

  protected abstract _subscribe(subscriber: RxSubscriber<V>): RxSubscription

  /** @svelteRxjsInterop */
  subscribe(next: (value: V) => void): RxSubscription
  subscribe(observer: Partial<RxObserver<V>>): RxSubscription
  subscribe(run: SvelteSubscriber<V>): SvelteUnsubscriber
  subscribe(observerOrRun: Partial<RxObserver<V>> | SvelteSubscriber<V>) {
    if (typeof observerOrRun === 'function') {
      const s = super.subscribe(observerOrRun)
      return () => s.unsubscribe()
    }
    return super.subscribe(observerOrRun)
  }
}

export default DerivedReader
