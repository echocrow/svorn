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

type Readables =
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

interface DeriverSyncBehavior<S extends Readables, V> {
  then: DeriverSyncThen<S, V>
  catch?: DeriverSyncCatch<V>
}
interface DeriverAsyncBehavior<S extends Readables, V> {
  then: DeriverAsyncThen<S, V>
  catch?: DeriverAsyncCatch<V>
}
interface DeriverBehavior<S extends Readables, V> {
  then: DeriverThen<S, V>
  catch?: DeriverCatch<V>
}

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

  constructor(source: S, then: DeriverAsyncThen<S, V>, initialValue?: V)
  constructor(source: S, then: DeriverSyncThen<S, V>, initialValue?: V)
  constructor(source: S, behavior: DeriverAsyncBehavior<S, V>, initialValue?: V)
  constructor(source: S, behavior: DeriverSyncBehavior<S, V>, initialValue?: V)
  constructor(
    source: S,
    thenOrBehavior: DeriverThen<S, V> | DeriverBehavior<S, V>,
    initialValue?: V,
  )
  constructor(
    source: S,
    thenOrBehavior: DeriverThen<S, V> | DeriverBehavior<S, V>,
    initialValue?: V,
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

    if (!(arguments.length <= 2)) {
      this.#src = this.#src.pipe(defaultWith(initialValue as V))
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

interface WriteDeriverSyncBehavior<S extends Readables, V>
  extends DeriverSyncBehavior<S, V>,
    Partial<Observer<V>> {}
interface WriteDeriverAsyncBehavior<S extends Readables, V>
  extends DeriverAsyncBehavior<S, V>,
    Partial<Observer<V>> {}
interface WriteDeriverBehavior<S extends Readables, V>
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
        ? new Deriver(source, behavior)
        : new Deriver(source, behavior, initialValue)
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
