import type { Writable } from '../types'
import DerivedReader from './DerivedReader'

abstract class DerivedWriter<V>
  extends DerivedReader<V>
  implements Writable<V>
{
  abstract next(value: V): void

  abstract error(err: unknown): void

  abstract complete(): void

  /** @svelteRxjsInterop */
  set(value: V): void {
    this.next(value)
  }
}

export default DerivedWriter
