import type {
  ObservedValueOf,
  Observer,
  Subscribable,
  Subscription,
} from 'rxjs'

export type FamilyKey = string | number | boolean | void | null

export interface Family<V, K extends FamilyKey> {
  subscribe(key: K, observer: Partial<Observer<V>>): Subscription
  get(key: K): Subscribable<V>
}

export type BehaviorSelectorGet = <S extends Subscribable<ObservedValueOf<S>>>(
  source: S,
) => ObservedValueOf<S>

export type BehaviorSelectorGetter<T> = (get: BehaviorSelectorGet) => T
