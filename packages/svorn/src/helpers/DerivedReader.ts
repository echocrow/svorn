import {
  type Subscriber as RxSubscriber,
  type Subscription as RxSubscription,
  type Subscription,
  Observable,
} from 'rxjs'

import type { InteropObserver, Readable } from '../types'
import { toRxObserver } from '../utils'

abstract class DerivedReader<V> extends Observable<V> implements Readable<V> {
  constructor() {
    // NOTE: This must be here to obscure Observable's constructor.
    super()
  }

  subscribe(observerOrNext?: InteropObserver<V> | null): Subscription {
    return super.subscribe(toRxObserver(observerOrNext))
  }

  protected abstract _subscribe(subscriber: RxSubscriber<V>): RxSubscription
}

export default DerivedReader
