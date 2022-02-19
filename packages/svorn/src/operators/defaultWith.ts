import { type Subscriber, Observable, Subscription } from 'rxjs'

const defaultWith =
  <T>(def: T) =>
  (source: Observable<T>): Observable<T> =>
    new Observable((subscriber: Subscriber<T>) => {
      let subscription: Subscription | undefined = undefined
      let fired = false
      const sendDefault = () => {
        if (fired) return
        if (subscription && subscription.closed) return
        fired = true
        subscriber.next(def)
      }
      subscription = source.subscribe({
        next: (v) => {
          fired = true
          subscriber.next(v)
        },
        error: (e) => {
          sendDefault()
          subscriber.error(e)
        },
        complete: () => {
          sendDefault()
          subscriber.complete()
        },
      })
      sendDefault()
      return subscription
    })

export default defaultWith
