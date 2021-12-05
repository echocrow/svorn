import type { OperatorFunction, Subscriber, Subscription } from 'rxjs'
import { Observable } from 'rxjs'

export const switchExhaustAll =
  <T>(): OperatorFunction<Observable<T>, T> =>
  (outer: Observable<Observable<T>>) =>
    new Observable((subscriber: Subscriber<T>) => {
      let outerSub: Subscription | void
      let innerSub: Subscription | void

      const reset = () => {
        outerSub = outerSub?.unsubscribe()
        innerSub = innerSub?.unsubscribe()
      }

      const restart = () => {
        reset()
        let outerFired = false
        outerSub = outer.subscribe({
          next: (inner) => {
            outerFired = true
            reset()
            innerSub = inner.subscribe({
              next: (v) => subscriber.next(v),
              error: (e) => subscriber.error(e),
              complete: restart,
            })
          },
          error: (e) => subscriber.error(e),
          complete: () => subscriber.complete(),
        })
        if (outerFired) outerSub = outerSub?.unsubscribe()
      }
      restart()

      return reset
    })

export const defaultWith =
  <T>(def: T) =>
  (source: Observable<T>): Observable<T> =>
    new Observable((subscriber: Subscriber<T>) => {
      let fired = false
      const subscription = source.subscribe({
        next: (v) => {
          fired = true
          subscriber.next(v)
        },
        error: (e) => subscriber.error(e),
        complete: () => subscriber.complete(),
      })
      if (!fired) subscriber.next(def)
      return subscription
    })
