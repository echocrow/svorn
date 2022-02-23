import {
  type Observer,
  type Subscribable,
  type Subscriber,
  type Unsubscribable,
  combineLatest,
  Observable,
  Subscription,
} from 'rxjs'

import DerivedReader from '../helpers/DerivedReader'
import DerivedWriter from '../helpers/DerivedWriter'
import defaultWith from '../operators/defaultWith'
import type { Readable, Writable } from '../types'

type ReadableInterop<V> = Readable<V> | Subscribable<V>

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Readables = ReadableInterop<any> | ReadableInterop<any>[]

type ReadablesValue<S extends Readables> = S extends Readable<infer V>
  ? V
  : { [K in keyof S]: S[K] extends Readable<infer V> ? V : never }

export class CircularDeriverDependency extends RangeError {}

const observableFromReadable = <V>(readable: Readable<V>): Observable<V> =>
  readable instanceof Observable
    ? readable
    : new Observable((subscriber) => readable.subscribe(subscriber))

const makeObservable = <S extends Readables>(
  source: S,
): Observable<ReadablesValue<S>> =>
  Array.isArray(source)
    ? (combineLatest(source.map(observableFromReadable)) as Observable<
        ReadablesValue<S>
      >)
    : observableFromReadable(source)

type DeriverCleanup = Unsubscribable | (() => void) | void

type DeriverSyncThen<S extends Readables, V> = (value: ReadablesValue<S>) => V
type DeriverAsyncThen<S extends Readables, V> = (
  value: ReadablesValue<S>,
  set: (value: V) => void,
) => DeriverCleanup

type DeriverThen<S extends Readables, V> =
  | DeriverSyncThen<S, V>
  | DeriverAsyncThen<S, V>

const runCleanup = (cleanup: Exclude<DeriverCleanup, void>): void => {
  if (typeof cleanup === 'function') cleanup()
  else if (typeof cleanup.unsubscribe === 'function') cleanup.unsubscribe()
}
const asyncMap =
  <S extends Readables, V>(then: DeriverAsyncThen<S, V>) =>
  (source: Observable<ReadablesValue<S>>): Observable<V> =>
    new Observable((subscriber: Subscriber<V>) => {
      let cleanupOp: DeriverCleanup = undefined
      const cleanup = () => (cleanupOp = cleanupOp && runCleanup(cleanupOp))
      const subscription = new Subscription(cleanup)
      const next = (v: V) => !subscriber.closed && subscriber.next(v)
      subscription.add(
        source.subscribe({
          next: (v) => {
            cleanup()
            cleanupOp = then(v, next)
          },
          error: (e) => {
            cleanup()
            subscriber.error(e)
          },
          complete: () => {
            cleanup(), subscriber.complete()
          },
        }),
      )
      return subscription
    })

const makeAsyncThen = <S extends Readables, V>(
  then: DeriverThen<S, V>,
): DeriverAsyncThen<S, V> =>
  then.length <= 1
    ? (value, set) => {
        set((then as DeriverSyncThen<S, V>)(value))
      }
    : (then as DeriverAsyncThen<S, V>)

export class Deriver<S extends Readables, V>
  extends DerivedReader<V>
  implements Readable<V>
{
  #src: Observable<V>
  #locked = false

  constructor(source: S, then: DeriverAsyncThen<S, V>, initialValue?: V)
  constructor(source: S, then: DeriverSyncThen<S, V>, initialValue?: V)
  constructor(source: S, then: DeriverThen<S, V>, initialValue?: V)
  constructor(source: S, then: DeriverThen<S, V>, initialValue?: V) {
    super()

    const asyncThen = makeAsyncThen(then)

    const safeThen: DeriverAsyncThen<S, V> = (value, set) => {
      if (this.#locked) {
        throw new CircularDeriverDependency(
          'New Deriver value received while still processing the previous value',
        )
      }
      this.#locked = true
      const cleanup = asyncThen(value, set)
      this.#locked = false
      return cleanup
    }

    this.#src = makeObservable(source).pipe(asyncMap(safeThen))

    if (!(arguments.length <= 2)) {
      this.#src = this.#src.pipe(defaultWith(initialValue as V))
    }
  }

  protected _subscribe(subscriber: Subscriber<V>) {
    return this.#src.subscribe(subscriber)
  }
}

interface WriteDeriverSyncBehavior<S extends Readables, V>
  extends Partial<Observer<V>> {
  then: DeriverSyncThen<S, V>
}
interface WriteDeriverAsyncBehavior<S extends Readables, V>
  extends Partial<Observer<V>> {
  then: DeriverAsyncThen<S, V>
}
interface WriteDeriverBehavior<S extends Readables, V>
  extends Partial<Observer<V>> {
  then: DeriverThen<S, V>
}

export class WriteDeriver<S extends Readables, V>
  extends DerivedWriter<V>
  implements Writable<V>
{
  #src: Deriver<S, V>
  #next: Observer<V>['next'] | undefined
  #error: Observer<V>['error'] | undefined
  #complete: Observer<V>['complete'] | undefined

  constructor(
    source: S,
    behavior: WriteDeriverSyncBehavior<S, V>,
    initialValue?: V,
  )
  constructor(
    source: S,
    behavior: WriteDeriverAsyncBehavior<S, V>,
    initialValue?: V,
  )
  constructor(source: S, behavior: WriteDeriverBehavior<S, V>, initialValue?: V)
  constructor(
    source: S,
    behavior: WriteDeriverBehavior<S, V>,
    initialValue?: V,
  ) {
    super()
    this.#src =
      arguments.length <= 2
        ? new Deriver(source, behavior.then)
        : new Deriver(source, behavior.then, initialValue)
    this.#next = behavior.next
    this.#error = behavior.error
    this.#complete = behavior.complete
  }

  protected _subscribe(subscriber: Subscriber<V>): Subscription {
    return this.#src.subscribe(subscriber)
  }

  next(value: V): void {
    if (!this.#next) throw new TypeError('next is not implemented')
    this.#next?.(value)
  }

  error(err: unknown): void {
    if (!this.#error) throw err
    this.#error(err)
  }

  complete(): void {
    if (!this.#complete) throw new TypeError('complete is not implemented')
    this.#complete()
  }
}

type DerivedOptions<S extends Readables, V> =
  | DeriverThen<S, V>
  | WriteDeriverBehavior<S, V>

function derived<S extends Readables, V>(
  source: S,
  behavior: WriteDeriverAsyncBehavior<S, V>,
  initialValue?: V,
): WriteDeriver<S, V>

function derived<S extends Readables, V>(
  source: S,
  behavior: WriteDeriverSyncBehavior<S, V>,
  initialValue?: V,
): WriteDeriver<S, V>

function derived<S extends Readables, V>(
  source: S,
  behavior: WriteDeriverBehavior<S, V>,
  initialValue?: V,
): WriteDeriver<S, V>

function derived<S extends Readables, V>(
  source: S,
  then: DeriverAsyncThen<S, V>,
  initialValue?: V,
): Deriver<S, V>

function derived<S extends Readables, V>(
  source: S,
  then: DeriverSyncThen<S, V>,
  initialValue?: V,
): Deriver<S, V>

function derived<S extends Readables, V>(
  source: S,
  thenOrBehavior: DerivedOptions<S, V>,
  initialValue?: V,
): Deriver<S, V> | WriteDeriver<S, V>

function derived<S extends Readables, V>(
  source: S,
  thenOrBehavior: DerivedOptions<S, V>,
  initialValue?: V,
): Deriver<S, V> | WriteDeriver<S, V> {
  // Make writable derived.
  if (typeof thenOrBehavior === 'object') {
    const behavior = thenOrBehavior
    return arguments.length <= 2
      ? new WriteDeriver(source, behavior)
      : new WriteDeriver(source, behavior, initialValue)
  }
  // Make readable derived.
  const then = thenOrBehavior
  return arguments.length <= 2
    ? new Deriver(source, then)
    : new Deriver(source, then, initialValue)
}

export default derived
