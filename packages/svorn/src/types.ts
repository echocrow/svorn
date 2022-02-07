import type {
  Observer as RxObserver,
  SubjectLike as RxSubjectLike,
  Subscribable as RxSubscribable,
  Unsubscribable as RxUnsubscribable,
} from 'rxjs'
import type {
  Readable as SvelteReadable,
  Writable as SvelteWritable,
} from 'svelte/store'

interface RxBehaviorSubjectLike<T> extends RxSubjectLike<T> {
  getValue(): T
}

export type InteropObserver<V> =
  | SvelteWritable<V>
  | Partial<RxObserver<V>>
  | ((value: V) => void)

export interface Readable<V>
  extends Omit<RxSubscribable<V>, 'subscribe'>,
    Omit<SvelteReadable<V>, 'subscribe'>,
    Omit<SvelteStore<V>, 'subscribe'> {
  subscribe(observer: InteropObserver<V>): RxUnsubscribable
}

export interface Writable<V>
  extends Readable<V>,
    Omit<RxBehaviorSubjectLike<V>, 'subscribe'>,
    Omit<SvelteWritable<V>, 'subscribe'> {}

export type FamilyKey = string | number | boolean | void | null

export interface ReadableFamily<V, K extends FamilyKey> {
  subscribe(key: K, observer: InteropObserver<V>): RxUnsubscribable
  get(key: K): Readable<V>
}

export interface WritableFamily<V, K extends FamilyKey>
  extends ReadableFamily<V, K> {
  get(key: K): Writable<V>
  getValue(key: K): V
  next: (key: K, value: V) => void
  error: (key: K, err: unknown) => void
  complete: () => void
}
