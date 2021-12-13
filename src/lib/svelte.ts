import { subscribe } from 'svelte/internal'
import type { NextObserver, Subscribable } from 'rxjs'
import type { Updater, Writable } from 'svelte/store'

interface BehaviorSubjectLike<T> extends NextObserver<T>, Subscribable<T> {
  getValue(): T
}

class RxWritable<T> implements Writable<T> {
  #subject: BehaviorSubjectLike<T>

  constructor(subject: BehaviorSubjectLike<T>) {
    this.#subject = subject
  }

  subscribe(next: (value: T) => void) {
    return subscribe(this.#subject, next)
  }

  set(value: T): void {
    this.#subject.next(value)
  }

  update(updater: Updater<T>) {
    this.set(updater(this.#subject.getValue()))
  }
}

export const writableFromRx = <T>(
  subject: BehaviorSubjectLike<T>,
): Writable<T> => new RxWritable(subject)
