/* istanbul ignore file */

import {
  type Observable,
  type ObservableNotification,
  type Observer,
  BehaviorSubject,
  config as rxConfig,
} from 'rxjs'
import { type RunHelpers, TestScheduler } from 'rxjs/testing'
import type { Readable, Updatable, Writable } from 'src/types'
import { writable as svelteWritable } from 'svelte/store'

type ReadObservable<V> = Readable<V> & Observable<V>
type WriteObservable<V> = Writable<V> & Observable<V>
type UpdateObservable<V> = Updatable<V> & Observable<V>

export const noop = () => {} // eslint-disable-line @typescript-eslint/no-empty-function

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
    const hasExtraneousStoppedNotifications = stoppedNotifications.length > 0
    expect(hasExtraneousStoppedNotifications).toBeFalsy()

    rxConfig.onStoppedNotification = orgConfig.onStoppedNotification
  })
}

export const describeReadable = (
  setup: () => [ReadObservable<string>, Observer<string>],
  options: {
    defaultValue?: string
    latestValue?: string
    skipCompletion?: boolean
    skipError?: boolean
  } = {},
) =>
  describe('Readable', () => {
    let r: ReadObservable<string>
    let s: Observer<string>
    beforeEach(() => ([r, s] = setup()))

    const { defaultValue, latestValue = defaultValue } = options

    if (latestValue !== undefined) {
      it('emits latest value immediately', () => {
        runTestScheduler(({ expectObservable }) => {
          expectObservable(r).toBe('D', { D: latestValue })
        })
      })
    }

    const expectSrcMimic = (
      src: string,
      want: string = src,
      wantValues?: Record<string, string>,
    ) => {
      runTestScheduler(({ cold, expectObservable }) => {
        cold(src).subscribe(s)
        expectObservable(r).toBe(want, wantValues)
      })
    }

    it('emits values', () => expectSrcMimic('ab-c--'))
    if (!options.skipCompletion) {
      if (defaultValue !== undefined) {
        it('emits default value before immediate completion', () =>
          expectSrcMimic('|', '(D|)', { D: defaultValue }))
      } else {
        it('emits completion', () => expectSrcMimic('|'))
      }
      it('emits completion after value', () => expectSrcMimic('a-|'))
    }
    if (!options.skipError) {
      if (defaultValue !== undefined) {
        it('emits default value before immediate error', () =>
          expectSrcMimic('#', '(D#)', { D: defaultValue }))
      } else {
        it('emits error', () => expectSrcMimic('#'))
      }
      it('emits error after value', () => expectSrcMimic('a-#'))
    }

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
      if (!options.skipCompletion) {
        it('signals complete to observer', () => {
          runTestScheduler(({ cold, expectObservable }) => {
            const src = 'a-|'
            const want = src
            r.subscribe(bucket)
            cold(src).subscribe(s)
            expectObservable(bucket).toBe(want)
          })
        })
      }
      if (!options.skipError) {
        it('signals error to observer', () => {
          runTestScheduler(({ cold, expectObservable }) => {
            const src = 'a-#'
            const want = src
            r.subscribe(bucket)
            cold(src).subscribe(s)
            expectObservable(bucket).toBe(want)
          })
        })
      }

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

export const describeWritable = (
  newWritable: () => WriteObservable<string>,
  options: {
    defaultValue?: string
    latestValue?: string
  } = {},
) =>
  describe('Writable', () => {
    describeReadable(() => {
      const w = newWritable()
      return [w, w]
    }, options)

    let w: WriteObservable<string>
    beforeEach(() => (w = newWritable()))

    it('can set(v)', () => {
      runTestScheduler(({ cold, expectObservable }) => {
        const src = 'ab-c-'
        const want = src
        cold(src).subscribe((v) => w.set(v))
        expectObservable(w).toBe(want)
      })
    })
  })

export const describeUpdatable = (
  newUpdatable: () => UpdateObservable<string>,
  options: {
    defaultValue?: string
    latestValue?: string
  } = {},
) =>
  describe('Updatable', () => {
    describeWritable(newUpdatable, options)

    let w: UpdateObservable<string>
    beforeEach(() => (w = newUpdatable()))

    it('can getValue()', () => {
      w.next('abc')
      expect(w.getValue()).toBe('abc')
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
