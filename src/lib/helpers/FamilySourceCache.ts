import {
  type Observable,
  type Observer,
  type SubjectLike,
  type Subscription,
  finalize,
  share,
} from 'rxjs'
import type { FamilyKey } from '$lib/types'
import { stringify } from '$lib/utils'

class FamilySourceCache<V, K extends FamilyKey> {
  #cache: Record<string, Observable<V>> = {}
  #getSource: (key: K, k: string) => Observable<V>
  #getConnector: () => SubjectLike<V>

  constructor(
    getSource: (key: K, k: string) => Observable<V>,
    getConnector: () => SubjectLike<V>,
  ) {
    this.#getSource = getSource
    this.#getConnector = getConnector
  }

  subscribe(key: K, observer: Partial<Observer<V>>): Subscription {
    const k = stringify(key)
    let src = this.#cache[k]
    if (!src) {
      src = this.#cache[k] = this.#getSource(key, k).pipe(
        finalize(() => delete this.#cache[k]),
        share({ connector: this.#getConnector }),
      )
    }
    return src.subscribe(observer)
  }
}

export default FamilySourceCache
