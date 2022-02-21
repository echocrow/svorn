import {
  type Observer,
  type Subscriber,
  finalize,
  Observable,
  share,
} from 'rxjs'

import DerivedReader from '../helpers/DerivedReader'
import defaultWith from '../operators/defaultWith'
import type { Readable } from '../types'

interface ReaderSet<V> extends Observer<V> {
  (value: V): void
}

type ReaderInit<V> = (set: ReaderSet<V>) => (() => void) | void

export class Reader<V> extends DerivedReader<V> implements Readable<V> {
  #destroy: (() => void) | void = undefined
  #src: Observable<V>

  constructor(initialValue: V, init: ReaderInit<V>) {
    super()
    this.#src = new Observable<V>((subscriber) => {
      const set = (value: V) => subscriber.next(value)
      set.next = (value: V) => subscriber.next(value)
      set.error = (err: unknown) => subscriber.error(err)
      set.complete = () => subscriber.complete()

      this.#destroy = init(set)
    }).pipe(
      finalize(() => this.destroy()),
      defaultWith(initialValue),
      share(),
    )
  }

  protected _subscribe(subscriber: Subscriber<V>) {
    return this.#src.subscribe(subscriber)
  }

  private destroy() {
    this.#destroy?.()
    this.#destroy = undefined
  }
}

const readable = <V>(initialValue: V, init: ReaderInit<V>): Reader<V> =>
  new Reader(initialValue, init)

export default readable
