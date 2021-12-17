import type { ObservedValueOf, Subscribable } from 'rxjs'

export type FamilyKey = string | number | boolean | void | null

export type BehaviorSelectorGet = <S extends Subscribable<ObservedValueOf<S>>>(
  source: S,
) => ObservedValueOf<S>

export type BehaviorSelectorGetter<T> = (get: BehaviorSelectorGet) => T
