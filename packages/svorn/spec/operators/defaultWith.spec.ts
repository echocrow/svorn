import { BehaviorSubject, from, Observable } from 'rxjs'
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

  it('does not emit when subscription was closed', () => {
    runTestScheduler(() => {
      // Extra notifications are checked by runTestScheduler().
      const o = from([]).pipe(defaultWith('D'))
      const bucket = new BehaviorSubject('0')
      o.subscribe(bucket)
      expect(bucket.getValue()).toBe('0')
    })
  })
})
