import type { Updater as SvelteUpdater } from 'svelte/store'

import type { Writable } from '../types'
import DerivedReader from './DerivedReader'

abstract class DerivedWriter<V>
  extends DerivedReader<V>
  implements Writable<V>
{
  abstract next(value: V): void

  abstract error(err: unknown): void

  abstract complete(): void

  abstract getValue(): V

  /** @svelteRxjsInterop */
  set(value: V): void {
    this.next(value)
  }
  /** @svelteRxjsInterop */
  update(updater: SvelteUpdater<V>): void {
    this.next(updater(this.getValue()))
  }
}

export default DerivedWriter
