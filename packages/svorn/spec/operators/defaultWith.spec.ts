import {
  BehaviorSubject,
  from,
  Observable,
  Subscription,
  throwError,
} from 'rxjs'
import { runTestScheduler } from 'spec/helpers'
import defaultWith from 'src/operators/defaultWith'

describe('defaultWith', () => {
  it('emits default synchronously once', () => {
    runTestScheduler(({ expectObservable }) => {
      const want = 'D---'
      const o = new Observable<string>().pipe(defaultWith('D'))
      expectObservable(o).toBe(want)
    })
  })

  it('skips default when some value was already emitted', () => {
    runTestScheduler(({ hot, expectObservable }) => {
      const o = new BehaviorSubject('v').pipe(defaultWith('D'))
      expectObservable(o).toBe('v---')
    })
  })

  it('emits default regardless of future values', () => {
    runTestScheduler(({ cold, expectObservable }) => {
      const o = cold('--v-').pipe(defaultWith('D'))
      expectObservable(o).toBe('D-v-')
    })
  })

  it('completes when source completes', () => {
    runTestScheduler(({ cold, expectObservable }) => {
      const src = '--|'
      const want = 'D-|'
      const o = cold(src).pipe(defaultWith('D'))
      expectObservable(o).toBe(want)
    })
  })

  it('errors when source errors', () => {
    runTestScheduler(({ cold, expectObservable }) => {
      const src = '--#'
      const want = 'D-#'
      const o = cold(src).pipe(defaultWith('D'))
      expectObservable(o).toBe(want)
    })
  })

  it('emits default before instant completion', () => {
    runTestScheduler(({ expectObservable }) => {
      const o = from([]).pipe(defaultWith('D'))
      expectObservable(o).toBe('(D|)')
    })
  })

  it('emits default before instant error', () => {
    runTestScheduler(({ expectObservable }) => {
      const o = throwError(() => 'error').pipe(defaultWith('D'))
      expectObservable(o).toBe('(D#)')
    })
  })

  it('does not emit when subscriber is already closed', () => {
    runTestScheduler(({ cold, expectObservable }) => {
      const s = cold('')
      s.subscribe = () => {
        const sub = new Subscription()
        sub.unsubscribe()
        return sub
      }
      const o = s.pipe(defaultWith('D'))
      expectObservable(o).toBe('')
    })
  })
})
