import { subscribe } from 'svelte/internal'
import type { NextObserver, Subscribable } from 'rxjs'
import type { Writable } from 'svelte/store'

interface NextObservable<T> extends NextObserver<T>, Subscribable<T> {}

type WritableStore<T> = Omit<Writable<T>, 'update'>

class RxWritable<T> implements WritableStore<T> {
  #subject: NextObservable<T>

  constructor(subject: NextObservable<T>) {
    this.#subject = subject
  }

  subscribe(next: (value: T) => void) {
    return subscribe(this.#subject, next)
  }

  set(value: T): void {
    this.#subject.next(value)
  }
}

export const writableFromRx = <T>(
  subject: NextObservable<T>,
): WritableStore<T> => new RxWritable(subject)
