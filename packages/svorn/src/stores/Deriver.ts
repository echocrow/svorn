import {
  type Subscribable,
  type Subscriber,
  type Unsubscribable,
  combineLatest,
  map,
  Observable,
  Subscription,
} from 'rxjs'

import DerivedReader from '../helpers/DerivedReader'
import defaultWith from '../operators/defaultWith'
import type { Readable } from '../types'

type ReadableInterop<V> = Readable<V> | Subscribable<V>

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Readables = ReadableInterop<any> | ReadableInterop<any>[]

type ReadablesValue<S extends Readables> = S extends Readable<infer V>
  ? V
  : { [K in keyof S]: S[K] extends Readable<infer V> ? V : never }

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

const runCleanup = (cleanup: DeriverCleanup): void => {
  if (typeof cleanup === 'function') cleanup()
  else if (typeof cleanup?.unsubscribe === 'function') cleanup.unsubscribe()
}
const asyncMap =
  <S extends Readables, V>(then: DeriverAsyncThen<S, V>) =>
  (source: Observable<ReadablesValue<S>>): Observable<V> =>
    new Observable((subscriber: Subscriber<V>) => {
      let cleanupOp: DeriverCleanup = undefined
      const cleanup = () => (cleanupOp = runCleanup(cleanupOp))
      const subscription = new Subscription(cleanup)
      subscription.add(
        source.subscribe({
          next: (v) => {
            cleanup()
            cleanupOp = then(v, (v) => !subscriber.closed && subscriber.next(v))
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

class Deriver<S extends Readables, V>
  extends DerivedReader<V>
  implements Readable<V>
{
  #src: Observable<V>

  constructor(source: S, then: DeriverAsyncThen<S, V>, initialValue?: V)
  constructor(source: S, then: DeriverSyncThen<S, V>, initialValue?: V)
  constructor(source: S, then: DeriverThen<S, V>, initialValue?: V)
  constructor(source: S, then: DeriverThen<S, V>, initialValue?: V) {
    super()

    this.#src = makeObservable(source).pipe(
      then.length <= 1
        ? map(then as DeriverSyncThen<S, V>)
        : asyncMap(then as DeriverAsyncThen<S, V>),
    )

    if (!(arguments.length <= 2)) {
      this.#src = this.#src.pipe(defaultWith(initialValue as V))
    }
  }

  protected _subscribe(subscriber: Subscriber<V>) {
    return this.#src.subscribe(subscriber)
  }
}

export function derived<S extends Readables, V>(
  source: S,
  then: DeriverAsyncThen<S, V>,
  initialValue?: V,
): Deriver<S, V>
export function derived<S extends Readables, V>(
  source: S,
  then: DeriverSyncThen<S, V>,
  initialValue?: V,
): Deriver<S, V>
export function derived<S extends Readables, V>(
  source: S,
  then: DeriverThen<S, V>,
  initialValue?: V,
): Deriver<S, V> {
  return arguments.length <= 2
    ? new Deriver(source, then)
    : new Deriver(source, then, initialValue)
}

export default Deriver
