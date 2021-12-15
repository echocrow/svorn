import {
  Observable,
  type Subscribable,
  type Subscriber,
  type Subscription,
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
