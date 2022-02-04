import {
  type Observable,
  type ObservedValueOf,
  type Observer,
  type SubjectLike,
  type Subscription,
  finalize,
  share,
  Subject,
} from 'rxjs'

import type { FamilyKey } from '../types'
import { stringify } from '../utils'

interface FamilySourceCacheConfig<
  S extends Observable<unknown>,
  K extends FamilyKey,
> {
  connector?: () => SubjectLike<ObservedValueOf<S>>
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

  #connector: NonNullable<FamilySourceCacheConfig<S, K>['connector']>
  #preSubscribe?: FamilySourceCacheConfig<S, K>['preSubscribe']
  #finalize?: FamilySourceCacheConfig<S, K>['finalize']

  constructor(
    source: (key: K, k: string) => S,
    {
      connector = () => new Subject<ObservedValueOf<S>>(),
      preSubscribe,
      finalize,
    }: FamilySourceCacheConfig<S, K>,
  ) {
    this.#source = source
    this.#connector = connector
    this.#preSubscribe = preSubscribe
    this.#finalize = finalize
  }

  subscribe(
    key: K,
    observer: Partial<Observer<ObservedValueOf<S>>>,
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
            this.#finalize?.(key, k)
          }),
          share({ connector: this.#connector }),
        ),
      ]
    }
    const [source, subject] = cached
    this.#preSubscribe?.({ source: source, key, k, isFirst })
    return subject.subscribe(observer)
  }
}

export default FamilySourceCache
