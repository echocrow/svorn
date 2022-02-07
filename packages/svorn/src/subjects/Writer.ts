import { type Subscription, BehaviorSubject } from 'rxjs'
import type { Updater as SvelteUpdater } from 'svelte/store'

import type { InteropObserver, Writable } from '../types'
import { toRxObserver } from '../utils'

class Writer<V> extends BehaviorSubject<V> implements Writable<V> {
  /** @svelteRxjsInterop */
  set(value: V): void {
    this.next(value)
  }
  /** @svelteRxjsInterop */
  update(updater: SvelteUpdater<V>): void {
    this.next(updater(this.getValue()))
  }

  subscribe(observerOrNext?: InteropObserver<V> | null): Subscription {
    return super.subscribe(toRxObserver(observerOrNext))
  }
}

export const writable = <V>(value: V): Writer<V> => new Writer(value)

export default Writer
