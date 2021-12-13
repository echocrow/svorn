import { type Observer, type Subscribable } from 'rxjs'

export interface BehaviorSubscribable<T> extends Subscribable<T> {
  getValue(): T
}
export interface BehaviorSubjectLike<T>
  extends Observer<T>,
    BehaviorSubscribable<T> {
  next(value: T): void
}
