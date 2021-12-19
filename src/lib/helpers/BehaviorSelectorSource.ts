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

class WeakMutex<T extends object> {
  #locks = new WeakSet<T>()
  isLocked(key: T): boolean {
    return this.#locks.has(key)
  }
  lock(key: T): void {
    this.#locks.add(key)
  }
  unlock(key: T): void {
    this.#locks.delete(key)
  }
}
const globalDepsMutex = new WeakMutex<BehaviorSelectorSource<unknown>>()

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

  #evalCache?:
    | { depValues: DepsMap; value: T }
    | { depValues: DepsMap; err: unknown }
  #subscription?: Subscription

  constructor(getter: BehaviorSelectorGetter<T>) {
    super()
    this.#getter = getter
  }

  healthCheck(): void {
    this._confirmUnlocked()
  }

  protected _subscribe(subscriber: Subscriber<T>): Subscription {
    this.healthCheck()
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
  protected _confirmUnlocked(): void {
    if (globalDepsMutex.isLocked(this))
      throw new Error('todo: circular dependency')
  }

  /** @internal */
  protected _lock(): void {
    this._confirmUnlocked()
    globalDepsMutex.lock(this)
  }

  /** @internal */
  protected _unlock(): void {
    globalDepsMutex.unlock(this)
  }

  /** @internal */
  protected _eval(
    deps: Set<Subscribable<unknown>>,
    values: unknown[],
  ): readonly [value: T, mustReval: boolean] {
    const depValues = zipSetArray(deps, values) as DepsMap

    const cache = this.#evalCache
    if (cache && areMapsEqual(depValues, cache.depValues)) {
      if ('err' in cache) throw cache.err
      return [cache.value, false]
    }

    this._lock()

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
    let value: T
    let mustReval: boolean
    try {
      value = this.#getter(get)
      this.#evalCache = { depValues: nextDepValues, value }
    } catch (err) {
      this.#evalCache = { depValues: nextDepValues, err }
      throw err
    } finally {
      this._unlock()
      this._clearSubscription(nextSub)
      mustReval = !areSetsEqual(nextDeps, deps)
      if (mustReval) this.#deps.next(nextDeps)
    }
    return [value, mustReval]
  }
}

export default BehaviorSelectorSource
