import {
  BehaviorSubject,
  Observable,
  type Observer,
  type Subscriber,
  type Subscription,
} from 'rxjs'
import type { BehaviorSubscribable } from './types'

abstract class DerivedBehaviorSubscribable<T>
  extends Observable<T>
  implements BehaviorSubscribable<T>
{
  #subject: BehaviorSubject<T>
  #refCount = 0
  #subscription: Subscription | null = null

  constructor(defaultValue: T) {
    super()
    this.#subject = new BehaviorSubject(defaultValue)
  }

  getValue(): T {
    return this.#subscription ? this.#subject.getValue() : this._calcValue()
  }

  /** @final */
  protected _subscribe(subscriber: Subscriber<T>): Subscription {
    this.#refCount++
    if (!this.#subscription) {
      this.#subject.next(this._calcValue())
      this.#subscription = this._innerSubscribe(this.#subject)
    }
    const subscription = this.#subject.subscribe(subscriber)
    subscription.add(() => {
      this.#refCount--
      if (!this.#refCount) {
        this.#subscription?.unsubscribe()
        this.#subscription = null
      }
    })
    return subscription
  }

  /** @internal */
  protected abstract _calcValue(): T

  /** @internal */
  protected abstract _innerSubscribe(subject: Observer<T>): Subscription
}

export default DerivedBehaviorSubscribable
