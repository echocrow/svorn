import {
  BehaviorSubject,
  Observable,
  type Observer,
  type Subscribable,
  Subscription,
  combineLatest,
  filter,
  map,
  of,
  shareReplay,
  switchMap,
} from 'rxjs'
import type { BehaviorSubscribable } from './types'
import DerivedBehaviorSubscribable from './DerivedBehaviorSubscribable'

const requireInstantValue = <T>(source: Subscribable<T>): T => {
  let value: [T] | undefined = undefined
  const subscription = source.subscribe({
    next: (v) => (value = [v]),
  })
  subscription.unsubscribe()
  if (!value) throw new Error('todo: value not received')
  return value[0]
}

type BehaviorSelectorGetter<T> = (
  get: <B>(bg: BehaviorSubscribable<B>) => B,
) => T

export const areMapsEqual = (
  a: Map<unknown, unknown>,
  b: Map<unknown, unknown>,
): boolean => {
  if (a.size !== b.size) return false
  for (const [k, v] of a.entries())
    if (!b.has(k) || b.get(k) !== v) return false
  return true
}

// todo: Solve this without a stack. Perhaps remove need for BehaviorSubject?
class Stack<T> {
  #values: T[] = []

  push(v: T): T {
    this.#values.push(v)
    return v
  }
  pop(): T {
    if (!this.#values.length) throw new Error('todo: stack error')
    /* eslint-disable-next-line @typescript-eslint/no-non-null-assertion */
    return this.#values.pop()!
  }
}

interface BehaviorSelectorCalc<T> {
  value: T
  newDepValues: Map<BehaviorSubscribable<unknown>, unknown>
  depsChanged: boolean
}

class BehaviorSelector<T> extends DerivedBehaviorSubscribable<T> {
  private static cstack = new Stack<BehaviorSelectorCalc<unknown>>()

  #prevDepValues = new Map<BehaviorSubscribable<unknown>, unknown>()
  #depValues = new BehaviorSubject(this.#prevDepValues)
  #getter: BehaviorSelectorGetter<T>
  #source: Observable<T> = this.#depValues.pipe(
    switchMap((v) => (v.size ? combineLatest([...v.keys()]) : of([]))),
    map((values) => {
      const depValues = new Map<BehaviorSubscribable<unknown>, unknown>()
      const deps = this.#depValues.getValue().keys()
      let i = 0
      for (const source of deps) {
        /* eslint-disable-next-line @typescript-eslint/no-non-null-assertion */
        depValues.set(source, values[i]!)
        i++
      }
      return depValues
    }),
    filter((depValues) => {
      return !areMapsEqual(depValues, this.#prevDepValues)
    }),
    map((depValues) => {
      this.#prevDepValues = depValues
      return this._calcValue(depValues)
    }),
    shareReplay(1),
  )

  constructor(getter: BehaviorSelectorGetter<T>) {
    super(
      (
        BehaviorSelector.cstack.push(
          BehaviorSelector._calcValue(getter),
        ) as BehaviorSelectorCalc<T>
      ).value,
    )
    this.#getter = getter
    const calc = BehaviorSelector.cstack.pop() as BehaviorSelectorCalc<T>
    this.#prevDepValues = calc.newDepValues
    this.#depValues.next(calc.newDepValues)
  }

  protected _calcValue(
    depValues = new Map<BehaviorSubscribable<unknown>, unknown>(),
  ): T {
    const { value, newDepValues, depsChanged } = BehaviorSelector._calcValue(
      this.#getter,
      depValues,
    )
    if (depsChanged) this.#depValues.next(newDepValues)
    return value
  }

  protected _innerSubscribe(subject: Observer<T>): Subscription {
    return this.#source.subscribe(subject)
  }

  static _calcValue<T>(
    getter: BehaviorSelectorGetter<T>,
    depValues = new Map<BehaviorSubscribable<unknown>, unknown>(),
  ): BehaviorSelectorCalc<T> {
    const newDepValues = new Map<BehaviorSubscribable<unknown>, unknown>()
    let depsChanged = false
    const get = <B>(source: BehaviorSubscribable<B>): B => {
      if (newDepValues.has(source)) {
        return newDepValues.get(source) as B
      }
      const hasValue = depValues.has(source)
      if (!hasValue) depsChanged = true
      const value = hasValue
        ? (depValues.get(source) as B)
        : requireInstantValue(source)
      newDepValues.set(source, value)
      return value
    }
    const value = getter(get)
    depsChanged = depsChanged || newDepValues.size !== depValues.size
    return { value, newDepValues, depsChanged }
  }
}

export default BehaviorSelector
