import {
  type Observable,
  type Subscribable,
  BehaviorSubject,
  from,
  merge,
  Subject,
  switchAll,
} from 'rxjs'
import {
  describeReadable,
  describeWritable,
  noop,
  runTestScheduler,
} from 'spec/helpers'
import derived, {
  CircularDeriverDependency,
  Deriver,
  WriteDeriver,
} from 'src/stores/derived'

const pass = <V>(v: V): V => v

const describeDerivable = <D extends typeof Deriver | typeof WriteDeriver>(
  newDeriver: (
    source: ConstructorParameters<D>[0],
    then: ConstructorParameters<typeof Deriver>[1],
  ) => InstanceType<D> & Observable<any>, // eslint-disable-line @typescript-eslint/no-explicit-any
  newDeriverWithInitial: (
    source: ConstructorParameters<D>[0],
    then: ConstructorParameters<typeof Deriver>[1],
    initialValue: unknown,
  ) => InstanceType<D> & Observable<any>, // eslint-disable-line @typescript-eslint/no-explicit-any
) =>
  describe('Derivable', () => {
    it.each(['', '0', 0, 123, true, 'def'] as const)(
      'emits initial value synchronously (%j)',
      (v) => {
        runTestScheduler(({ expectObservable, cold }) => {
          const then = noop as () => typeof v
          expectObservable(newDeriverWithInitial(cold(''), then, v)).toBe('d', {
            d: v,
          })
        })
      },
    )

    describe('with observable source', () => {
      describeReadable(
        () => {
          const s = new BehaviorSubject('__INITIAL__')
          const r = newDeriver(s, pass)
          return [r, s]
        },
        { latestValue: '__INITIAL__' },
      )
    })

    describe('with observable source and initial value', () => {
      describeReadable(
        () => {
          const s = new BehaviorSubject('__INITIAL__')
          const r = newDeriverWithInitial(s, pass, '__DEFAULT__')
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
          const d = newDeriver(
            [s0, s1],
            ([v0, v1]: [string, string]) => `${v0}:${v1}`,
          )
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
          const d = newDeriver(
            [c0, c1],
            ([v0, v1]: [string, string]) => `${v0}:${v1}`,
          )
          expectObservable(d).toBe(want, { a: 'a:0' })
        })
      })

      it('errors when either source errors', () => {
        runTestScheduler(({ expectObservable, cold }) => {
          const src0 = 'a-#'
          const src1 = '0----#'
          const want = 'a-#'
          const [c0, c1] = [cold(src0), cold(src1)]
          const d = newDeriver(
            [c0, c1],
            ([v0, v1]: [string, string]) => `${v0}:${v1}`,
          )
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
          const d = newDeriver(cold(src), (v, set) => {
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
          const d = newDeriver(cold(src), (v, set) => {
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
          newDeriver(cold(src), (v, _) => {
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
          newDeriver(cold(src), (v, _) => {
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
          const d = newDeriver(cold(src), (v, set) => {
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
        const d = newDeriver(s, pass)
        expectObservable(d).toBe(want)
      })
    })

    it('detects circular dependencies', () => {
      const tick = jest.fn((n: number): number => {
        if (n > 10) throw new RangeError('Maximum test tick size exceeded')
        return n + 1
      })

      const brick = () =>
        runTestScheduler(({ hot }) => {
          const coreSrc = hot('1', { 1: 1 })

          const aSrc = new BehaviorSubject<Observable<number>>(new Subject())
          const a = newDeriver(aSrc.pipe(switchAll()), tick)

          const bSrc = new BehaviorSubject<Observable<number>>(new Subject())
          const b = newDeriver(bSrc.pipe(switchAll()), tick)

          aSrc.next(merge(b, coreSrc))
          bSrc.next(a)

          b.subscribe(noop)
        })

      expect(brick).toThrow(CircularDeriverDependency)
      expect(tick.mock.calls.length).toBeLessThan(10)
    })
  })

describe('Deriver', () => {
  describeDerivable<typeof Deriver>(
    (source, then) => new Deriver(source, then),
    (source, then, initialValue) => new Deriver(source, then, initialValue),
  )
})

describe('WriteDeriver', () => {
  describeDerivable<typeof WriteDeriver>(
    (source, then) => new WriteDeriver(source, { then }),
    (source, then, initialValue) =>
      new WriteDeriver(source, { then }, initialValue),
  )

  describe('with observable source', () => {
    describeWritable(
      () => {
        const s = new BehaviorSubject('__INITIAL__')
        const d = new WriteDeriver(s, {
          then: pass,
          next: (v: string) => s.next(v),
          error: (err) => s.error(err),
          complete: () => s.complete(),
        })
        return d
      },
      { latestValue: '__INITIAL__' },
    )
  })

  describe('with incomplete observer', () => {
    let s: BehaviorSubject<string>
    beforeEach(() => (s = new BehaviorSubject('0')))

    it.each([
      ['next', (d: WriteDeriver<typeof s, string>) => d.next('whatever')],
      ['error', (d: WriteDeriver<typeof s, string>) => d.error('whatever')],
      ['complete', (d: WriteDeriver<typeof s, string>) => d.complete()],
    ])('throws when %s is not set but called', (_, cb) => {
      const d = new WriteDeriver(s, { then: pass })
      expect(() => cb(d)).toThrow()
    })
  })
})

const describeDerivedPassingArgs = (
  makeDerivedOptions: (
    source: Subscribable<string>,
    then: (v: string) => string,
  ) => Parameters<typeof derived>[1],
) =>
  describe('derived args passing', () => {
    it('keeps the source and map fn', () => {
      runTestScheduler(({ expectObservable, cold }) => {
        const src = ' a-b--c---|'
        const want = 'A-B--C---|'
        const o = cold(src)
        const d = derived(
          o,
          makeDerivedOptions(o, (v) => v.toUpperCase()),
        )
        expectObservable(d).toBe(want)
      })
    })

    it('keeps the initial value', () => {
      runTestScheduler(({ expectObservable, cold }) => {
        const src = ' --a-|'
        const want = '0-a-|'
        const o = cold(src)
        const d = derived(o, makeDerivedOptions(o, pass), '0')
        expectObservable(d).toBe(want)
      })
    })
  })

describe('derived', () => {
  describe('as readable', () => {
    it('returns Deriver', () => {
      expect(derived(from([]), pass)).toBeInstanceOf(Deriver)
    })

    describeDerivedPassingArgs((_, then) => then)
  })

  describe('as writable', () => {
    it('returns WriteDeriver', () => {
      const s = new BehaviorSubject('0')
      const d = derived(from('0'), {
        then: pass,
        next: (v: string) => s.next(v),
      })
      expect(d).toBeInstanceOf(WriteDeriver)
    })

    describeDerivedPassingArgs((_, then) => ({ then, next: pass }))
  })
})
