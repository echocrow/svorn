import { type Subscriber, Observable } from 'rxjs'

const defaultWith =
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
      if (!fired && !subscription.closed) subscriber.next(def)
      return subscription
    })

export default defaultWith
