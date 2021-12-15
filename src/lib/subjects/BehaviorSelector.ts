import {
  BehaviorSubject,
  type ObservedValueOf,
  type Observer,
  type Subscribable,
  Subscription,
  combineLatest,
  filter,
  finalize,
  map,
  of,
  shareReplay,
  switchMap,
} from 'rxjs'
import DerivedSubscribable from './DerivedSubscribable'
import {
  areMapsEqual,
  areSetsEqual,
  requireInstantValue,
  zipSetArray,
} from '$lib/utils'

type BehaviorSelectorGet = <S extends Subscribable<ObservedValueOf<S>>>(
  source: S,
) => ObservedValueOf<S>
type BehaviorSelectorGetter<T> = (get: BehaviorSelectorGet) => T

interface DepsMap extends Map<Subscribable<unknown>, unknown> {
  get<S extends Subscribable<ObservedValueOf<S>>>(
    dep: S,
  ): ObservedValueOf<S> | undefined
}

class BehaviorSelector<T> extends DerivedSubscribable<T> {
  #deps = new BehaviorSubject(new Set<Subscribable<unknown>>())
  #getter: BehaviorSelectorGetter<T>
  #subscription: Subscription | void = undefined
  #isCalcing = false
  #calcCache: [DepsMap, T] | undefined
  #source = this.#deps.pipe(
    switchMap((deps) =>
      (deps.size ? combineLatest([...deps]) : of([] as unknown[])).pipe(
        map((values) => [deps, values] as const),
      ),
    ),
    filter(() => !this.#isCalcing),
    map(([deps, values]) => this._cachedCalcValue(deps, values)),
    finalize(() => this._clearSubscription()),
    shareReplay({ bufferSize: 1, refCount: true }),
  )

  constructor(getter: BehaviorSelectorGetter<T>) {
    super()
    this.#getter = getter
  }

  protected _subscribe(subscriber: Observer<T>): Subscription {
    return this.#source.subscribe(subscriber)
  }

  /** @internal */
  protected _clearSubscription(): void {
    this.#subscription = this.#subscription?.unsubscribe()
  }

  /** @internal */
  protected _cachedCalcValue(
    deps: Set<Subscribable<unknown>>,
    values: unknown[],
  ): T {
    const depValues = zipSetArray(deps, values) as DepsMap
    if (this.#calcCache) {
      const [prevDepValues, prevVal] = this.#calcCache
      if (areMapsEqual(prevDepValues, depValues)) return prevVal
    }

    const { value, newDepValues } = this._calcValue(depValues)
    this.#calcCache = [newDepValues, value]
    return value
  }

  /** @internal */
  protected _calcValue(depValues: DepsMap) {
    this.#isCalcing = true

    const getter = this.#getter

    const newDeps = new Set<Subscribable<unknown>>()
    const newDepValues = new Map() as DepsMap
    const newSub = new Subscription()

    const get: BehaviorSelectorGet = (source) => {
      if (newDepValues.has(source)) {
        return newDepValues.get(source)! // eslint-disable-line @typescript-eslint/no-non-null-assertion
      }
      newDeps.add(source)
      const [v, s] = depValues.has(source)
        ? [depValues.get(source)!, source.subscribe({})] // eslint-disable-line @typescript-eslint/no-non-null-assertion
        : requireInstantValue(source)
      newDepValues.set(source, v)
      newSub.add(s)
      return v
    }
    const value = getter(get)

    const oldDeps = new Set(depValues.keys())
    if (!areSetsEqual(newDeps, oldDeps)) this.#deps.next(newDeps)

    this._clearSubscription()
    this.#subscription = newSub

    this.#isCalcing = false
    return { value, newDepValues }
  }
}

export default BehaviorSelector
