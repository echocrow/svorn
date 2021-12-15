import {
  BehaviorSubject,
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

type BehaviorSelectorGetter<T> = (get: <B>(bg: Subscribable<B>) => B) => T

class BehaviorSelector<T> extends DerivedSubscribable<T> {
  #deps = new BehaviorSubject(new Set<Subscribable<unknown>>())
  #getter: BehaviorSelectorGetter<T>
  #subscription: Subscription | void = undefined
  #isCalcing = false
  #calcCache: [Map<Subscribable<unknown>, unknown>, T] | undefined
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
    const depValues = zipSetArray(deps, values)
    if (this.#calcCache) {
      const [prevDepValues, prevVal] = this.#calcCache
      if (areMapsEqual(prevDepValues, depValues)) return prevVal
    }

    const { value, newDepValues } = this._calcValue(depValues)
    this.#calcCache = [newDepValues, value]
    return value
  }

  /** @internal */
  protected _calcValue(depValues: Map<Subscribable<unknown>, unknown>) {
    this.#isCalcing = true

    const getter = this.#getter

    const newDeps = new Set<Subscribable<unknown>>()
    const newDepValues = new Map<Subscribable<unknown>, unknown>()
    const newSub = new Subscription()

    const get = <B>(source: Subscribable<B>): B => {
      if (newDepValues.has(source)) {
        return newDepValues.get(source) as B
      }
      newDeps.add(source)
      const [v, s] = depValues.has(source)
        ? [depValues.get(source) as B, source.subscribe({})]
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
