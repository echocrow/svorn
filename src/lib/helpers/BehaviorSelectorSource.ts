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
  #isCalcing = false
  #source = this.#deps.pipe(
    switchMap((deps) =>
      (deps.size ? combineLatest([...deps]) : of([] as unknown[])).pipe(
        map((values) => [deps, values] as const),
      ),
    ),
    filter(() => !this.#isCalcing),
    map(([deps, values]) => this._cachedCalcValue(deps, values)),
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
  protected _cachedCalcValue(
    deps: Set<Subscribable<unknown>>,
    values: unknown[],
  ): T {
    const depValues = zipSetArray(deps, values) as DepsMap

    if (this.#evalCache) {
      const [prevDepValues, prevVal] = this.#evalCache
      if (areMapsEqual(prevDepValues, depValues)) return prevVal
    }

    const { value, nextDepValues } = this._calcValue(depValues)
    this.#evalCache = [nextDepValues, value]
    return value
  }

  /** @internal */
  protected _calcValue(depValues: DepsMap) {
    this.#isCalcing = true

    const nextDeps = new Set<Subscribable<unknown>>()
    const nextDepValues = new Map() as DepsMap
    const nextSub = new Subscription()

    const get: BehaviorSelectorGet = (source) => {
      if (nextDepValues.has(source)) {
        return nextDepValues.get(source)! // eslint-disable-line @typescript-eslint/no-non-null-assertion
      }
      nextDeps.add(source)
      const [v, s] = depValues.has(source)
        ? [depValues.get(source)!, source.subscribe({})] // eslint-disable-line @typescript-eslint/no-non-null-assertion
        : requireInstantValue(source)
      nextDepValues.set(source, v)
      nextSub.add(s)
      return v
    }
    const value = this.#getter(get)

    const oldDeps = new Set(depValues.keys())
    if (!areSetsEqual(nextDeps, oldDeps)) this.#deps.next(nextDeps)

    this._clearSubscription(nextSub)

    this.#isCalcing = false
    return { value, nextDepValues }
  }
}

export default BehaviorSelectorSource
