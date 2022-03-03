import {
  type Observer,
  type Subscribable,
  type Subscriber,
  type Unsubscribable,
  combineLatest,
  filter,
  map,
  Observable,
  of,
  shareReplay,
  Subscription,
} from 'rxjs'

import DerivedReader from '../helpers/DerivedReader'
import DerivedWriter from '../helpers/DerivedWriter'
import defaultWith from '../operators/defaultWith'
import type { Readable, Writable } from '../types'

type ReadableInterop<V> = Readable<V> | Subscribable<V>

export type Readables =
  | ReadableInterop<any> // eslint-disable-line @typescript-eslint/no-explicit-any
  | Readonly<Array<ReadableInterop<any> | any>> // eslint-disable-line @typescript-eslint/no-explicit-any

type ReadablesValue<S extends Readables> = S extends ReadableInterop<infer V>
  ? V
  : Readonly<{
      [K in keyof S]: S[K] extends ReadableInterop<infer V> ? V : S[K]
    }>

export class CircularDeriverDependency extends RangeError {}

const observableFromReadable = <V>(
  readable: Readable<V> | V,
): Observable<V> => {
  if (readable instanceof Observable) return readable
  if (
    typeof readable === 'object' &&
    'subscribe' in readable &&
    typeof readable.subscribe === 'function'
  ) {
    return new Observable((subscriber) => readable.subscribe(subscriber))
  }
  return of(readable as V)
}

const makeObservable = <S extends Readables>(
  source: S,
): Observable<ReadablesValue<S>> =>
  Array.isArray(source)
    ? (combineLatest(source.map(observableFromReadable)) as Observable<
        ReadablesValue<S>
      >)
    : observableFromReadable(source)

type DeriverCleanup = Unsubscribable | (() => void) | void

type DeriverSyncSet<I, O> = (value: I) => O
type DeriverAsyncSet<I, O> = (
  value: I,
  set: (value: O) => void,
) => DeriverCleanup

type DeriverSyncThen<S extends Readables, V> = DeriverSyncSet<
  ReadablesValue<S>,
  V
>
type DeriverAsyncThen<S extends Readables, V> = DeriverAsyncSet<
  ReadablesValue<S>,
  V
>
type DeriverThen<S extends Readables, V> =
  | DeriverSyncThen<S, V>
  | DeriverAsyncThen<S, V>

type DeriverSyncCatch<V> = DeriverSyncSet<unknown, V>
type DeriverAsyncCatch<V> = DeriverAsyncSet<unknown, V>
type DeriverCatch<V> = DeriverSyncCatch<V> | DeriverAsyncCatch<V>

interface DeriverBaseBehavior<S extends Readables, V> {
  initial?: V
}

export interface DeriverSyncBehavior<S extends Readables, V>
  extends DeriverBaseBehavior<S, V> {
  then: DeriverSyncThen<S, V>
  catch?: DeriverSyncCatch<V>
}
export interface DeriverAsyncBehavior<S extends Readables, V>
  extends DeriverBaseBehavior<S, V> {
  then: DeriverAsyncThen<S, V>
  catch?: DeriverAsyncCatch<V>
}
export interface DeriverBehavior<S extends Readables, V>
  extends DeriverBaseBehavior<S, V> {
  then: DeriverThen<S, V>
  catch?: DeriverCatch<V>
}

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

const makeAsyncSet = <I, O>(
  fn: DeriverSyncSet<I, O> | DeriverAsyncSet<I, O>,
): DeriverAsyncSet<I, O> =>
  fn.length <= 1
    ? (value, set) => {
        set((fn as DeriverSyncSet<I, O>)(value))
      }
    : (fn as DeriverAsyncSet<I, O>)

enum DeriverReady {
  Ok,
  Busy,
  Error,
}

export class Deriver<S extends Readables, V>
  extends DerivedReader<V>
  implements Readable<V>
{
  #src: Observable<V>
  #ready: DeriverReady = DeriverReady.Ok
  #i = 0

  constructor(
    source: S,
    thenOrBehavior: DeriverAsyncThen<S, V> | DeriverAsyncBehavior<S, V>,
  )
  constructor(
    source: S,
    thenOrBehavior: DeriverThen<S, V> | DeriverBehavior<S, V>,
  )
  constructor(
    source: S,
    thenOrBehavior: DeriverThen<S, V> | DeriverBehavior<S, V>,
  ) {
    super()

    const behavior: DeriverBehavior<S, V> =
      typeof thenOrBehavior !== 'function'
        ? thenOrBehavior
        : { then: thenOrBehavior }
    const { then, catch: catchFn } = behavior

    const asyncThen = makeAsyncSet(then)
    const asyncCatch = catchFn ? makeAsyncSet(catchFn) : undefined

    const safeThen: DeriverAsyncThen<S, V> = (value, set) => {
      if (this.#ready === DeriverReady.Error) return

      if (this.#ready !== DeriverReady.Ok) {
        this.#ready = DeriverReady.Error
        const error = new CircularDeriverDependency(
          'New Deriver value received while still processing the previous value',
        )
        if (!asyncCatch) throw error
        return asyncCatch(error, set)
      }

      this.#ready = DeriverReady.Busy
      const cleanup = asyncThen(value, set)
      this.#ready = DeriverReady.Ok

      return cleanup
    }

    this.#src = makeObservable(source).pipe(asyncMap(safeThen))

    if ('initial' in behavior) {
      this.#src = this.#src.pipe(defaultWith(behavior.initial as V))
    }

    this.#src = this.#src.pipe(
      map((v) => ({ v: v, i: ++this.#i })),
      shareReplay({ bufferSize: 1, refCount: true }),
      // Filter potential duplicate emissions from earlier loops.
      filter(({ i }) => i === this.#i),
      map(({ v }) => v),
    )
  }

  protected _subscribe(subscriber: Subscriber<V>) {
    return this.#src.subscribe(subscriber)
  }
}

export interface WriteDeriverSyncBehavior<S extends Readables, V>
  extends DeriverSyncBehavior<S, V>,
    Partial<Observer<V>> {}
export interface WriteDeriverAsyncBehavior<S extends Readables, V>
  extends DeriverAsyncBehavior<S, V>,
    Partial<Observer<V>> {}
export interface WriteDeriverBehavior<S extends Readables, V>
  extends DeriverBehavior<S, V>,
    Partial<Observer<V>> {}

export class WriteDeriver<S extends Readables, V>
  extends DerivedWriter<V>
  implements Writable<V>
{
  #src: Deriver<S, V>
  #next: Observer<V>['next'] | undefined
  #error: Observer<V>['error'] | undefined
  #complete: Observer<V>['complete'] | undefined

  constructor(source: S, behavior: WriteDeriverAsyncBehavior<S, V>)
  constructor(source: S, behavior: WriteDeriverSyncBehavior<S, V>)
  constructor(source: S, behavior: WriteDeriverBehavior<S, V>)
  constructor(source: S, behavior: WriteDeriverBehavior<S, V>) {
    super()
    this.#src = new Deriver(source, behavior)
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
  | DeriverBehavior<S, V>
  | WriteDeriverBehavior<S, V>

export const behaviorIsObserver = <S extends Readables, V>(
  behavior: WriteDeriverBehavior<S, V>,
): boolean =>
  'next' in behavior || 'error' in behavior || 'complete' in behavior

function derived<S extends Readables, V>(
  source: S,
  behavior: WriteDeriverAsyncBehavior<S, V>,
  initial?: V,
): WriteDeriver<S, V>
function derived<S extends Readables, V>(
  source: S,
  behavior: WriteDeriverBehavior<S, V>,
  initial?: V,
): WriteDeriver<S, V>

function derived<S extends Readables, V>(
  source: S,
  thenOrBehavior: DeriverAsyncThen<S, V> | DeriverAsyncBehavior<S, V>,
  initial?: V,
): Deriver<S, V>
function derived<S extends Readables, V>(
  source: S,
  thenOrBehavior: DerivedOptions<S, V>,
  initial?: V,
): Deriver<S, V> | WriteDeriver<S, V>

function derived<S extends Readables, V>(
  source: S,
  thenOrBehavior: DerivedOptions<S, V>,
  initial?: V,
): Deriver<S, V> | WriteDeriver<S, V> {
  let behavior =
    typeof thenOrBehavior === 'object'
      ? thenOrBehavior
      : { then: thenOrBehavior }
  if (arguments.length >= 3) behavior = { ...behavior, initial }
  return behaviorIsObserver(behavior)
    ? new WriteDeriver(source, behavior)
    : new Deriver(source, behavior)
}

export default derived
