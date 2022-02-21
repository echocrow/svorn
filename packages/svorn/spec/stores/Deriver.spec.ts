import { BehaviorSubject, from, Subject, Subscribable } from 'rxjs'
import { describeReadable, noop, runTestScheduler } from 'spec/helpers'
import Deriver, { derived } from 'src/stores/Deriver'

describe('Deriver', () => {
  it.each(['', '0', 0, 123, true, 'def'] as const)(
    'emits initial value synchronously (%j)',
    (v) => {
      runTestScheduler(({ expectObservable, cold }) => {
        const then = noop as () => typeof v
        expectObservable(new Deriver(cold(''), then, v)).toBe('d', { d: v })
      })
    },
  )

  describe('with observable source', () => {
    describeReadable(
      () => {
        const s = new BehaviorSubject('__INITIAL__')
        const r = new Deriver(s, (v) => v)
        return [r, s]
      },
      { latestValue: '__INITIAL__' },
    )
  })

  describe('with observable source and initial value', () => {
    describeReadable(
      () => {
        const s = new BehaviorSubject('__INITIAL__')
        const r = new Deriver(s, (v) => v, '__DEFAULT__')
        return [r, s]
      },
      { defaultValue: '__DEFAULT__', latestValue: '__INITIAL__' },
    )
  })

  describe('with an array of observables', () => {
    it('emits values when either source emits', () => {
      runTestScheduler(({ expectObservable, cold }) => {
        const s0 = cold('a-b----c-----')
        const s1 = cold('0-1------2--3')
        const want = '   a-(bc)-d-e--f'
        const d = new Deriver([s0, s1], ([v0, v1]) => `${v0}:${v1}`)
        expectObservable(d).toBe(want, {
          a: 'a:0',
          b: 'b:0',
          c: 'b:1',
          d: 'c:1',
          e: 'c:2',
          f: 'c:3',
        })
      })
    })

    it('completes when all sources completed', () => {
      runTestScheduler(({ expectObservable, cold }) => {
        const src0 = 'a-|'
        const src1 = '0----|'
        const want = 'a----|'
        const [c0, c1] = [cold(src0), cold(src1)]
        const d = new Deriver([c0, c1], ([v0, v1]) => `${v0}:${v1}`)
        expectObservable(d).toBe(want, { a: 'a:0' })
      })
    })

    it('errors when either source errors', () => {
      runTestScheduler(({ expectObservable, cold }) => {
        const src0 = 'a-#'
        const src1 = '0----#'
        const want = 'a-#'
        const [c0, c1] = [cold(src0), cold(src1)]
        const d = new Deriver([c0, c1], ([v0, v1]) => `${v0}:${v1}`)
        expectObservable(d).toBe(want, { a: 'a:0' })
      })
    })
  })

  describe('with async set function', () => {
    it('emits values asynchronously via set', () => {
      runTestScheduler(({ expectObservable, cold }) => {
        const src = ' a-b--c-----|'
        const push = '--x'
        const want = '--a-b--c---|'
        const delay = cold(push)
        const d = new Deriver(cold(src), (v, set) => {
          delay.subscribe(() => set(v))
        })
        expectObservable(d).toBe(want)
      })
    })

    it('skips async emission when source closed meanwhile', () => {
      runTestScheduler(({ expectObservable, cold }) => {
        // Extra notifications are checked by runTestScheduler().
        const src = ' a|'
        const push = '--x'
        const want = '-|'
        const delay = cold(push)
        const d = new Deriver(cold(src), (v, set) => {
          delay.subscribe(() => set(v))
        })
        expectObservable(d).toBe(want)
      })
    })

    it('executes cleanup returned by set on next emit', () => {
      runTestScheduler(({ expectObservable, cold }) => {
        const src = ' a-b--c----'
        const want = '--a--b----'
        const bucket = new Subject<string>()
        expectObservable(bucket).toBe(want)
        new Deriver(cold(src), (v, _) => {
          return () => bucket.next(v)
        }).subscribe()
      })
    })

    it.each([
      { m: '|', type: 'completion' },
      { m: '#', type: 'error' },
    ])('executes last cleanup on $type', ({ m }) => {
      runTestScheduler(({ expectObservable, cold }) => {
        const src = ` a-b--${m}`
        const want = '--a--b   '
        const bucket = new Subject<string>()
        expectObservable(bucket).toBe(want)
        new Deriver(cold(src), (v, _) => {
          return () => bucket.next(v)
        }).subscribe({ error: noop })
      })
    })

    it('closes cleanup subscription on next emit & completion', () => {
      runTestScheduler(({ expectObservable, cold }) => {
        const src = ' a-b----d-e-f----g-h-|'
        const push = '--x'
        const want = '----b--------f------|'
        const throttle = cold(push)
        const d = new Deriver(cold(src), (v, set) => {
          return throttle.subscribe(() => set(v))
        })
        expectObservable(d).toBe(want)
      })
    })
  })

  it('supports custom RxJS subscribable', () => {
    runTestScheduler(({ expectObservable, cold }) => {
      const src = ' a-b--c--|'
      const want = 'a-b--c--|'
      const s: Subscribable<string> = {
        subscribe: (observer) => cold(src).subscribe(observer),
      }
      const d = new Deriver(s, (v) => v)
      expectObservable(d).toBe(want)
    })
  })
})

describe('derived', () => {
  it('returns Deriver', () => {
    expect(derived(from([]), (v) => v)).toBeInstanceOf(Deriver)
  })

  it('keeps the source and map fn', () => {
    runTestScheduler(({ expectObservable, cold }) => {
      const src = ' a-b--c---|'
      const want = 'A-B--C---|'
      const d = derived(cold(src), (v) => v.toUpperCase())
      expectObservable(d).toBe(want)
    })
  })

  it('keeps the initial value', () => {
    runTestScheduler(({ expectObservable, cold }) => {
      const src = ' --a-|'
      const want = '0-a-|'
      const d = derived(cold(src), (v) => v, '0')
      expectObservable(d).toBe(want)
    })
  })
})
