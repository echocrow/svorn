import {
  BehaviorSubject,
  type ObservedValueOf,
  ReplaySubject,
  type SubjectLike,
  type Subscribable,
  type Subscriber,
  Subscription,
  combineLatest,
  filter,
  finalize,
  map,
  of,
  switchMap,
} from 'rxjs'
import type { BehaviorSelectorGet, BehaviorSelectorGetter } from '$lib/types'
import {
  areMapsEqual,
  areSetsEqual,
  requireInstantValue,
  zipSetArray,
} from '$lib/utils'
import DerivedSubscribable from '$lib/subjects/DerivedSubscribable'

interface DepsMap extends Map<Subscribable<unknown>, unknown> {
  get<S extends Subscribable<ObservedValueOf<S>>>(
    dep: S,
  ): ObservedValueOf<S> | undefined
}

class BehaviorSelectorSource<T> extends DerivedSubscribable<T> {
  #getter: BehaviorSelectorGetter<T>

  #deps = new BehaviorSubject(new Set<Subscribable<unknown>>())
  #source = this.#deps.pipe(
    switchMap((deps) =>
      (deps.size ? combineLatest([...deps]) : of([] as unknown[])).pipe(
        map((values) => [deps, values] as const),
      ),
    ),
    map(([deps, values]) => this._eval(deps, values)),
    filter(([_, mustReval]) => !mustReval),
    map(([value, _]) => value),
    finalize(() => this._clearSubscription()),
  )

  #evalCache?: [DepsMap, T]
  #subscription?: Subscription

  constructor(getter: BehaviorSelectorGetter<T>) {
    super()
    this.#getter = getter
  }

  protected _subscribe(subscriber: Subscriber<T>): Subscription {
    return this.#source.subscribe(subscriber)
  }

  static getConnector<T>(): SubjectLike<T> {
    return new ReplaySubject(1)
  }

  /** @internal */
  protected _clearSubscription(nextSub?: Subscription): void {
    this.#subscription?.unsubscribe()
    this.#subscription = nextSub
  }

  /** @internal */
  protected _eval(
    deps: Set<Subscribable<unknown>>,
    values: unknown[],
  ): readonly [value: T, mustReval: boolean] {
    const depValues = zipSetArray(deps, values) as DepsMap

    if (this.#evalCache) {
      const [prevDepValues, prevVal] = this.#evalCache
      if (areMapsEqual(prevDepValues, depValues)) return [prevVal, false]
    }

    const nextDeps = new Set<Subscribable<unknown>>()
    const nextDepValues = new Map() as DepsMap
    const nextSub = new Subscription()

    const get: BehaviorSelectorGet = (source) => {
      if (nextDepValues.has(source)) {
        return nextDepValues.get(source)! // eslint-disable-line @typescript-eslint/no-non-null-assertion
      }
      const [v, s] = depValues.has(source)
        ? [depValues.get(source)!, source.subscribe({})] // eslint-disable-line @typescript-eslint/no-non-null-assertion
        : requireInstantValue(source)
      nextDeps.add(source)
      nextDepValues.set(source, v)
      nextSub.add(s)
      return v
    }
    const value = this.#getter(get)

    this.#evalCache = [nextDepValues, value]

    this._clearSubscription(nextSub)

    const mustReval = !areSetsEqual(nextDeps, deps)
    if (mustReval) this.#deps.next(nextDeps)

    return [value, mustReval]
  }
}

export default BehaviorSelectorSource
