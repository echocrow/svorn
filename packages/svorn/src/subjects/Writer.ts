import type {
  Observer as RxObserver,
  Subscription as RxSubscription,
} from 'rxjs'
import { BehaviorSubject } from 'rxjs'
import type {
  Subscriber as SvelteSubscriber,
  Unsubscriber as SvelteUnsubscriber,
  Updater as SvelteUpdater,
} from 'svelte/store'

import type { Writable } from '../types'

class Writer<V> extends BehaviorSubject<V> implements Writable<V> {
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

  /** @svelteRxjsInterop */
  set(value: V): void {
    this.next(value)
  }
  /** @svelteRxjsInterop */
  update(updater: SvelteUpdater<V>): void {
    this.next(updater(this.getValue()))
  }
}

export const writable = <V>(value: V): Writer<V> => new Writer(value)

export default Writer
