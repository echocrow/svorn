import {
  BehaviorSubject,
  Observable,
  type Observer,
  Subscription,
  combineLatest,
  map,
  of,
  shareReplay,
  switchMap,
} from 'rxjs'
import type { BehaviorSubscribable } from './types'
import DerivedBehaviorSubscribable from './DerivedBehaviorSubscribable'
import { areSetsEqual } from '$lib/utils'

type BehaviorSelectorGetter<T> = (
  get: <B>(bg: BehaviorSubscribable<B>) => B,
) => T

class BehaviorSelector<T> extends DerivedBehaviorSubscribable<T> {
  #deps = new BehaviorSubject(new Set<BehaviorSubscribable<unknown>>())
  #getter: BehaviorSelectorGetter<T>
  #source: Observable<T> = this.#deps.pipe(
    switchMap((v) => (v.size ? combineLatest([...v]) : of(undefined))),
    map(() => this._calcValue()),
    shareReplay(1),
  )

  constructor(getter: BehaviorSelectorGetter<T>) {
    super(BehaviorSelector._calcValue(getter).value)
    this.#getter = getter
  }

  protected _calcValue(): T {
    const { value, deps } = BehaviorSelector._calcValue(this.#getter)
    const oldDeps = this.#deps.getValue()
    if (!areSetsEqual(oldDeps, deps)) this.#deps.next(deps)
    return value
  }

  protected _innerSubscribe(subject: Observer<T>): Subscription {
    return this.#source.subscribe(subject)
  }

  static _calcValue<T>(getter: BehaviorSelectorGetter<T>): {
    value: T
    deps: Set<BehaviorSubscribable<unknown>>
  } {
    const deps = new Set<BehaviorSubscribable<unknown>>()
    const get = <B>(source: BehaviorSubscribable<B>): B => {
      deps.add(source)
      return source.getValue()
    }
    const value = getter(get)
    return { value, deps }
  }
}

export default BehaviorSelector
