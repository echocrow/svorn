import {
  type Subscribable,
  type Subscriber,
  type Unsubscribable,
  combineLatest,
  filter,
  map,
  NextObserver,
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

export type Readables<V> =
  | ReadableInterop<V>
  | (Readonly<Array<unknown>> &
      Readonly<{
        [K in keyof V]: ReadableInterop<V[K]>
      }>)

export class CircularDeriverDependency extends RangeError {}

const observableFromReadable = <V>(
  readable: ReadableInterop<V> | V,
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

const makeObservable = <V>(source: Readables<V>): Observable<V> => {
  if (Array.isArray(source)) {
    const sources = source.map(observableFromReadable) as unknown as Readonly<{
      [K in keyof V]: Observable<V[K]>
    }>
    return combineLatest(sources)
  }
  return observableFromReadable(source as ReadableInterop<V>)
}
type DeriverCleanup = Unsubscribable | (() => void) | void

type DeriverSyncSet<I, O> = (value: I) => O
type DeriverAsyncSet<I, O> = (
  value: I,
  set: (value: O) => void,
) => DeriverCleanup

type DeriverSyncThen<S, V> = DeriverSyncSet<S, V>
type DeriverAsyncThen<S, V> = DeriverAsyncSet<S, V>
type DeriverThen<S, V> = DeriverSyncThen<S, V> | DeriverAsyncThen<S, V>

type DeriverSyncCatch<V> = DeriverSyncSet<unknown, V>
type DeriverAsyncCatch<V> = DeriverAsyncSet<unknown, V>
type DeriverCatch<V> = DeriverSyncCatch<V> | DeriverAsyncCatch<V>

interface DeriverBaseBehavior<S, V> {
  initial?: V
}

export interface DeriverSyncBehavior<S, V> extends DeriverBaseBehavior<S, V> {
  then: DeriverSyncThen<S, V>
  catch?: DeriverSyncCatch<V>
}
export interface DeriverAsyncBehavior<S, V> extends DeriverBaseBehavior<S, V> {
  then: DeriverAsyncThen<S, V>
  catch?: DeriverAsyncCatch<V>
}
export interface DeriverBehavior<S, V> extends DeriverBaseBehavior<S, V> {
  then: DeriverThen<S, V>
  catch?: DeriverCatch<V>
}

const runCleanup = (cleanup: Exclude<DeriverCleanup, void>): void => {
  if (typeof cleanup === 'function') cleanup()
  else if (typeof cleanup.unsubscribe === 'function') cleanup.unsubscribe()
}
const asyncMap =
  <S, V>(then: DeriverAsyncThen<S, V>) =>
  (source: Observable<S>): Observable<V> =>
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

export type DeriverOptions<S, V = S> = DeriverThen<S, V> | DeriverBehavior<S, V>

export class Deriver<S, V = S> extends DerivedReader<V> implements Readable<V> {
  #src: Observable<V>
  #ready: DeriverReady = DeriverReady.Ok
  #i = 0

  constructor(
    source: Readables<S>,
    thenOrBehavior: DeriverAsyncThen<S, V> | DeriverAsyncBehavior<S, V>,
  )
  constructor(source: Readables<S>, thenOrBehavior: DeriverOptions<S, V>)
  constructor(source: Readables<S>, thenOrBehavior: DeriverOptions<S, V>) {
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

interface WriteDeriverBaseBehavior<S, V>
  extends DeriverBaseBehavior<S, V>,
    Omit<NextObserver<V>, 'closed'> {}

export interface WriteDeriverSyncBehavior<S, V>
  extends DeriverSyncBehavior<S, V>,
    WriteDeriverBaseBehavior<S, V> {}
export interface WriteDeriverAsyncBehavior<S, V>
  extends DeriverAsyncBehavior<S, V>,
    WriteDeriverBaseBehavior<S, V> {}
export interface WriteDeriverBehavior<S, V>
  extends DeriverBehavior<S, V>,
    WriteDeriverBaseBehavior<S, V> {}

export type IsObserver<
  S,
  V,
  B extends WriteDeriverBehavior<S, V> | DeriverBehavior<S, V>,
> = B extends WriteDeriverBehavior<S, V> ? true : false

export const behaviorIsObserver = <
  S,
  V,
  B extends
    | WriteDeriverBehavior<S, V>
    | DeriverBehavior<S, V> = WriteDeriverBehavior<S, V>,
>(
  behavior: B,
): IsObserver<S, V, B> => ('next' in behavior) as any

export abstract class DeriverWriter<V>
  extends DerivedWriter<V>
  implements Writable<V>
{
  #behavior: WriteDeriverBehavior<any, V>

  constructor(behavior: WriteDeriverBehavior<any, V>) {
    super()
    this.#behavior = behavior
  }

  next(value: V): void {
    this.#behavior.next(value)
  }

  error(err: unknown): void {
    if (!this.#behavior.error) throw err
    this.#behavior.error(err)
  }

  complete(): void {
    if (!this.#behavior.complete)
      throw new TypeError('complete is not implemented')
    this.#behavior.complete()
  }
}

export class WriteDeriver<S, V = S>
  extends DeriverWriter<V>
  implements Writable<V>
{
  #src: Deriver<S, V>

  constructor(source: Readables<S>, behavior: WriteDeriverAsyncBehavior<S, V>)
  constructor(source: Readables<S>, behavior: WriteDeriverSyncBehavior<S, V>)
  constructor(source: Readables<S>, behavior: WriteDeriverBehavior<S, V>)
  constructor(source: Readables<S>, behavior: WriteDeriverBehavior<S, V>) {
    super(behavior)
    this.#src = new Deriver(source, behavior)
  }

  protected _subscribe(subscriber: Subscriber<V>): Subscription {
    return this.#src.subscribe(subscriber)
  }
}

export type DerivedOptions<S, V = S> =
  | DeriverOptions<S, V>
  | WriteDeriverBehavior<S, V>

function derived<S, V = S>(
  source: Readables<S>,
  behavior: WriteDeriverAsyncBehavior<S, V>,
  initial?: V,
): WriteDeriver<S, V>
function derived<S, V = S>(
  source: Readables<S>,
  behavior: WriteDeriverBehavior<S, V>,
  initial?: V,
): WriteDeriver<S, V>

function derived<S, V = S>(
  source: Readables<S>,
  thenOrBehavior: DeriverAsyncThen<S, V> | DeriverAsyncBehavior<S, V>,
  initial?: V,
): Deriver<S, V>
function derived<S, V = S>(
  source: Readables<S>,
  thenOrBehavior: DerivedOptions<S, V>,
  initial?: V,
): Deriver<S, V>

function derived<S, V = S>(
  source: Readables<S>,
  thenOrBehavior: DerivedOptions<S, V>,
  initial?: V,
): Deriver<S, V> | WriteDeriver<S, V> {
  let behavior: WriteDeriverBehavior<S, V> | DeriverBehavior<S, V> =
    typeof thenOrBehavior === 'object'
      ? thenOrBehavior
      : { then: thenOrBehavior }
  if (arguments.length >= 3) behavior = { ...behavior, initial }
  return behaviorIsObserver<S, V, typeof behavior>(behavior)
    ? new WriteDeriver(source, behavior as WriteDeriverBehavior<S, V>)
    : new Deriver(source, behavior)
}

export default derived
