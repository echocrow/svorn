import { BehaviorSubject } from 'rxjs'
import type { Updater as SvelteUpdater } from 'svelte/store'

import type { Writable } from '../types'

class Writer<V> extends BehaviorSubject<V> implements Writable<V> {
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
