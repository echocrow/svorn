import {
  type Subscribable,
  type Subscriber,
  type Subscription,
  Observable,
} from 'rxjs'

abstract class DerivedSubscribable<T>
  extends Observable<T>
  implements Subscribable<T>
{
  constructor() {
    super()
  }

  protected abstract _subscribe(subscriber: Subscriber<T>): Subscription
}

export default DerivedSubscribable
