import {
  type Observable,
  type ObservedValueOf,
  type Subscription,
  finalize,
} from 'rxjs'

import type { FamilyKey, InteropObserver } from '../types'
import { stringify, toRxObserver } from '../utils'

interface FamilySourceCacheConfig<
  S extends Observable<unknown>,
  K extends FamilyKey,
> {
  preSubscribe?: (connection: {
    source: S
    key: K
    k: string
    isFirst: boolean
  }) => void
  finalize?: (key: K, k: string) => void
}

class FamilySourceCache<S extends Observable<unknown>, K extends FamilyKey> {
  #cache: Record<string, [source: S, subject: Observable<ObservedValueOf<S>>]> =
    {}

  #source: (key: K, k: string) => S

  #options: FamilySourceCacheConfig<S, K>

  constructor(
    source: (key: K, k: string) => S,
    options: FamilySourceCacheConfig<S, K> = {},
  ) {
    this.#source = source
    this.#options = options
  }

  subscribe(
    key: K,
    observerOrNext: InteropObserver<ObservedValueOf<S>>,
  ): Subscription {
    const k = stringify(key)
    let cached = this.#cache[k]
    const isFirst = !cached
    if (!cached) {
      const src = this.#source(key, k)
      cached = this.#cache[k] = [
        src,
        (src as Observable<ObservedValueOf<S>>).pipe(
          finalize(() => {
            delete this.#cache[k]
            this.#options.finalize?.(key, k)
          }),
        ),
      ]
    }
    const [source, subject] = cached
    this.#options.preSubscribe?.({ source: source, key, k, isFirst })
    return subject.subscribe(toRxObserver(observerOrNext))
  }
}

export default FamilySourceCache
