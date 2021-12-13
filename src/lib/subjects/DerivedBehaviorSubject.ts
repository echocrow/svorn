import type { BehaviorSubjectLike } from './types'
import DerivedBehaviorSubscribable from './DerivedBehaviorSubscribable'

abstract class DerivedBehaviorSubject<T>
  extends DerivedBehaviorSubscribable<T>
  implements BehaviorSubjectLike<T>
{
  abstract next(value: T): void

  abstract error(err: unknown): void

  abstract complete(): void
}

export default DerivedBehaviorSubject
