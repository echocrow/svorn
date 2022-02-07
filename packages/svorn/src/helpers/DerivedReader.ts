import {
  type Subscriber as RxSubscriber,
  type Subscription as RxSubscription,
  Observable,
} from 'rxjs'

import type { Readable } from '../types'

abstract class DerivedReader<V> extends Observable<V> implements Readable<V> {
  constructor() {
    // NOTE: This must be here to obscure Observable's constructor.
    super()
  }

  protected abstract _subscribe(subscriber: RxSubscriber<V>): RxSubscription
}

export default DerivedReader
