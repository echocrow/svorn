import {
  type Observable,
  type ObservableNotification,
  type Observer,
  BehaviorSubject,
  config as rxConfig,
} from 'rxjs'
import { type RunHelpers, TestScheduler } from 'rxjs/testing'
import type { Readable, Writable } from 'src/types'
import { writable as svelteWritable } from 'svelte/store'

type ReadObservable<V> = Readable<V> & Observable<V>
type WriteObservable<V> = Writable<V> & Observable<V>

export const runTestScheduler = (runner: (helpers: RunHelpers) => void) => {
  const ts = new TestScheduler((actual, expected) =>
    expect(actual).toEqual(expected),
  )
  return ts.run((helpers) => {
    const { flush } = helpers

    const orgConfig = {
      onStoppedNotification: rxConfig.onStoppedNotification,
    }
    const stoppedNotifications: ObservableNotification<unknown>[] = []
    rxConfig.onStoppedNotification = (n) => stoppedNotifications.push(n)

    runner(helpers)

    flush()

    // Expect no extraneous stopped notifications.
    expect(stoppedNotifications).toHaveLength(0)

    rxConfig.onStoppedNotification = orgConfig.onStoppedNotification
  })
}

export const describeReadable = (
  setup: () => [ReadObservable<string>, Observer<string>],
) =>
  describe('Readable', () => {
    let r: ReadObservable<string>
    let s: Observer<string>
    beforeEach(() => ([r, s] = setup()))

    const expectSrcMimic = (src: string, want: string = src) => {
      runTestScheduler(({ cold, expectObservable }) => {
        cold(src).subscribe(s)
        expectObservable(r).toBe(want)
      })
    }

    it('emits values', () => expectSrcMimic('ab-c--'))

    it('emits completion', () => expectSrcMimic('|'))
    it('emits completion after value', () => expectSrcMimic('a-|'))

    it('emits error', () => expectSrcMimic('#'))
    it('emits error after value', () => expectSrcMimic('a-#'))

    it('shares latest value', () => {
      s.next('0')
      expectSrcMimic('---', '0--')
    })

    describe('subscribe', () => {
      let bucket: BehaviorSubject<string>
      beforeEach(() => (bucket = new BehaviorSubject('UNWANTED_DEFAULT')))

      it('emits values to callback', () => {
        runTestScheduler(({ cold, expectObservable }) => {
          const src = 'ab-c--'
          const want = src
          r.subscribe((v) => bucket.next(v))
          cold(src).subscribe(s)
          expectObservable(bucket).toBe(want)
        })
      })

      it('emits values to observer', () => {
        runTestScheduler(({ cold, expectObservable }) => {
          const src = 'ab-c--'
          const want = src
          r.subscribe(bucket)
          cold(src).subscribe(s)
          expectObservable(bucket).toBe(want)
        })
      })
      it('signals complete to observer', () => {
        runTestScheduler(({ cold, expectObservable }) => {
          const src = 'a-|'
          const want = src
          r.subscribe(bucket)
          cold(src).subscribe(s)
          expectObservable(bucket).toBe(want)
        })
      })
      it('signals error to observer', () => {
        runTestScheduler(({ cold, expectObservable }) => {
          const src = 'a-#'
          const want = src
          r.subscribe(bucket)
          cold(src).subscribe(s)
          expectObservable(bucket).toBe(want)
        })
      })

      it('emits values to Svelte writable', () => {
        runTestScheduler(({ cold, expectObservable }) => {
          const src = 'ab-c--'
          const want = src

          const svelteStore = svelteWritable('0')
          svelteStore.subscribe((v) => bucket.next(v))

          r.subscribe(svelteStore)
          cold(src).subscribe(s)
          expectObservable(bucket).toBe(want)
        })
      })
    })
  })

export const describeWritable = (newWritable: () => WriteObservable<string>) =>
  describe('Writable', () => {
    describeReadable(() => {
      const w = newWritable()
      return [w, w]
    })

    let w: WriteObservable<string>
    beforeEach(() => (w = newWritable()))

    it('can getValue()', () => {
      w.next('abc')
      expect(w.getValue()).toBe('abc')
    })

    it('can set(v)', () => {
      runTestScheduler(({ cold, expectObservable }) => {
        const src = 'ab-c-'
        const want = src
        cold(src).subscribe((v) => w.set(v))
        expectObservable(w).toBe(want)
      })
    })

    it('can update((p) => v)', () => {
      runTestScheduler(({ cold, expectObservable }) => {
        w.next('0')
        const src = 'ab-c-'
        const want = src
        cold(src).subscribe((v) => w.update((prev) => `${prev}.${v}`))
        expectObservable(w).toBe(want, { a: '0.a', b: '0.a.b', c: '0.a.b.c' })
      })
    })
  })
