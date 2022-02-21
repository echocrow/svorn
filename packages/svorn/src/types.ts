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

export type InteropObserver<V> =
  | SvelteWritable<V>
  | Partial<RxObserver<V>>
  | ((value: V) => void)

export interface Readable<V>
  extends Omit<RxSubscribable<V>, 'subscribe'>,
    Omit<SvelteReadable<V>, 'subscribe'> {
  subscribe(observer: InteropObserver<V>): RxUnsubscribable
}

export interface Writable<V>
  extends Readable<V>,
    Omit<RxSubjectLike<V>, 'subscribe'>,
    Omit<SvelteWritable<V>, 'subscribe' | 'update'> {}

export interface Updatable<V>
  extends Writable<V>,
    Omit<SvelteWritable<V>, 'subscribe'> {
  getValue(): V
}

export type FamilyKey = string | number | boolean | void | null

export type WriterFamilyRecord<V> = Record<string, V>

export interface ReadableFamily<V, K extends FamilyKey>
  extends Readable<WriterFamilyRecord<V>> {
  subscribeTo(key: K, observer: InteropObserver<V>): RxUnsubscribable
  get(key: K): Readable<V>
}

export interface WritableFamily<V, K extends FamilyKey>
  extends ReadableFamily<V, K> {
  get(key: K): Writable<V>
  next: (key: K, value: V) => void
  complete: () => void
  error: (err: unknown) => void
}
