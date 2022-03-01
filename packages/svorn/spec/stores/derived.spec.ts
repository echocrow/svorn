import {
  type Subscribable,
  BehaviorSubject,
  from,
  merge,
  Observable,
  Subject,
  switchMap,
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

      it('accepts simple values as sources', () => {
        runTestScheduler(({ cold, expectObservable }) => {
          const srcA = 'a-c--'
          const want = '0-1--'
          const d = newDeriver(
            [cold(srcA), 'b'],
            ([a, b]: [string, string]) => `${a}:${b}`,
          )
          expectObservable(d).toBe(want, { 0: 'a:b', 1: 'c:b' })
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

    it('shares emitted values', () => {
      runTestScheduler(({ hot, flush, expectObservable }) => {
        const src = '      ab-c|'
        const wantCalls = '12-3-'

        const calls = hot<number>('')
        let callCount = 0
        const tick = jest.fn((s: string): string => {
          calls.next(++callCount)
          return s
        })

        const d = newDeriver(hot(src), tick)

        d.subscribe(noop)
        d.subscribe(noop)

        expectObservable(calls).toBe(wantCalls, { 1: 1, 2: 2, 3: 3 })
        flush()
        expect(tick).toBeCalledTimes(3)
      })
    })

    it('is subscribes to source only while being subscribes to ', () => {
      runTestScheduler(({ hot, expectObservable, expectSubscriptions }) => {
        const sub1 = '      --^--!----'
        const sub2 = '      ----^--!--'
        const wantSrcSub = '--^----!--'
        const s = hot('')
        const d = newDeriver(s, pass)
        expectObservable(d, sub1)
        expectObservable(d, sub2)
        expectSubscriptions(s.subscriptions).toBe(wantSrcSub)
      })
    })

    describe('on late subscriptions', () => {
      it('does not emit latest value on first subscription', () => {
        runTestScheduler(({ hot, expectObservable }) => {
          const src = ' a-b'
          const sub = ' -^-'
          const want = '--b'
          const d = newDeriver(hot(src), pass)
          expectObservable(d, sub).toBe(want)
        })
      })
      it('emits latest value on subsequent subscriptions', () => {
        runTestScheduler(({ hot, expectObservable }) => {
          const src = '  a-b-c-d-'
          const sub1 = ' -^------'
          const sub2 = ' -----^--'
          const want2 = '-----cd-'
          const d = newDeriver(hot(src), pass)
          expectObservable(d, sub1)
          expectObservable(d, sub2).toBe(want2)
        })
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

          const aSrc: Observable<number> = new Observable((subscriber) =>
            merge(coreSrc, b).subscribe(subscriber),
          )
          const a = newDeriver(aSrc, tick)
          const b = newDeriver(a, tick)

          b.subscribe(noop)
        })

      expect(brick).toThrow(CircularDeriverDependency)
      expect(tick.mock.calls.length).toBeLessThan(10)
    })

    describe('catching errors', () => {
      const tick = jest.fn((n: string): string => {
        if (tick.mock.calls.length > 10)
          throw new RangeError('Maximum test tick size exceeded')
        return n.toUpperCase()
      })
      const deriverBehavior = { then: tick, catch: () => 'X' }

      beforeEach(() => tick.mockClear())

      it('catches and maps circular dependencies', () => {
        runTestScheduler(({ hot, expectObservable }) => {
          const src = '  a----b----'
          const wantA = '(AX)-(BX)-'
          const wantB = 'X----X----'

          const coreSrc = hot(src)

          const aSrc: Observable<string> = new Observable((subscriber) =>
            merge(coreSrc, b).subscribe(subscriber),
          )
          const a = newDeriver(aSrc, deriverBehavior)
          const b = newDeriver(a, deriverBehavior)

          expectObservable(a).toBe(wantA)
          expectObservable(b).toBe(wantB)
        })
      })

      it('catches and maps circular dependencies #2', () => {
        runTestScheduler(({ hot, expectObservable }) => {
          const src = '  a--------b--------c---'
          const loop = ' 0--1-----------0------'
          const wantA = 'A--(AX)--(BX)-----C---'
          const wantB = 'A--(AX)--(BX)-----C---'

          const loopSrc = hot(loop, { 0: false, 1: true })
          const coreSrc = hot(src)

          const aSrc: Observable<string> = new Observable((subscriber) =>
            loopSrc
              .pipe(switchMap((loop) => (loop ? merge(coreSrc, b) : coreSrc)))
              .subscribe(subscriber),
          )
          const a = newDeriver(aSrc, deriverBehavior)
          const b = newDeriver(a, deriverBehavior)

          expectObservable(a).toBe(wantA)
          expectObservable(b).toBe(wantB)
        })
      })
    })
  })

describe('Deriver', () => {
  describeDerivable<typeof Deriver>(
    (source, then) => new Deriver(source, then),
    (source, then, initialValue) => new Deriver(source, then, initialValue),
  )
})

describe('WriteDeriver', () => {
  const makeWriteDeriverBehavior = (
    then: ConstructorParameters<typeof Deriver>[1],
  ): ConstructorParameters<typeof WriteDeriver>[1] =>
    typeof then === 'function' ? { then } : then
  describeDerivable<typeof WriteDeriver>(
    (source, then) => new WriteDeriver(source, makeWriteDeriverBehavior(then)),
    (source, then, initialValue) =>
      new WriteDeriver(source, makeWriteDeriverBehavior(then), initialValue),
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

  it('properly types values of source array', () => {
    runTestScheduler(({ cold, expectObservable }) => {
      const srcA = 'a-c--'
      const srcB = 'b--d-'
      const want = '0-12-'

      const a = cold(srcA)
      const b = cold(srcB)
      const d = derived(
        [a, b] as const,
        ([a, b]) => `${a.toUpperCase()}:${b.toUpperCase()}`,
      )

      // This is mostly a TypeScript check, but doesn't hurt to still test.
      expectObservable(d).toBe(want, { 0: 'A:B', 1: 'C:B', 2: 'C:D' })
    })
  })
})
