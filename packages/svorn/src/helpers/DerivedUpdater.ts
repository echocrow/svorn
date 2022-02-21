import type { Updater as SvelteUpdater } from 'svelte/store'

import type { Updatable } from '../types'
import DerivedWriter from './DerivedWriter'

abstract class DerivedUpdater<V>
  extends DerivedWriter<V>
  implements Updatable<V>
{
  abstract getValue(): V

  /** @svelteRxjsInterop */
  update(updater: SvelteUpdater<V>): void {
    this.next(updater(this.getValue()))
  }
}

export default DerivedUpdater
