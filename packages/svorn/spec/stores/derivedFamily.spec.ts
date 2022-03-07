import { BehaviorSubject, of, shareReplay, switchMap } from 'rxjs'
import {
  describeWritable,
  expectType,
  pass,
  runTestScheduler,
} from 'spec/helpers'
import derivedFamily, {
  DeriverFamily,
  DeriverFamilyBehavior,
  DeriverMember,
  WriteDeriverFamilySyncBehavior,
  WriteDeriverMember,
} from 'src/stores/derivedFamily'
import type { Readable, Writable } from 'src/types'
import { noop } from 'svelte/internal'

import { describeDerivable } from './derived.spec'

describe('DeriverFamily', () => {
  describe('any member', () => {
    describeDerivable(
      (source, then) =>
        new DeriverFamily(() =>
          typeof then === 'function' ? { source, then } : { source, ...then },
        ).get('whatever'),
      (source, then, initial) =>
        new DeriverFamily(() =>
          typeof then === 'function'
            ? { source, then, initial }
            : { source, ...then, initial },
        ).get('whatever'),
    )
  })

  it('keeps track of different members', () => {
    runTestScheduler(({ expectObservable, cold }) => {
      const srcA = ' a-b--c-'
      const srcB = ' d--e-f-'
      const wantA = 'A-B--C-'
      const wantB = 'D--E-F-'

      const oA = cold(srcA)
      const oB = cold(srcB)
      const df = new DeriverFamily<string>((k) => ({
        source: k === 'a' ? oA : oB,
        then: (v) => v.toUpperCase(),
      }))
      expectObservable(df.get('a')).toBe(wantA)
      expectObservable(df.get('b')).toBe(wantB)
    })
  })

  it('does not excessively rerun behavior getter', () => {
    const getBehavior = jest.fn(() => ({
      source: of(true),
      then: (v: boolean) => v,
    }))

    const df = new DeriverFamily(getBehavior)
    expect(getBehavior).toBeCalledTimes(0)

    const d0 = df.get('whatever')
    expect(getBehavior).toBeCalledTimes(1)
    d0.subscribe(noop).unsubscribe()
    expect(getBehavior).toBeCalledTimes(1)

    const d1 = df.get('someOtherKey')
    expect(getBehavior).toBeCalledTimes(2)
    d1.subscribe(noop).unsubscribe()
    expect(getBehavior).toBeCalledTimes(2)
  })

  describe('as writable', () => {
    describe('any member', () => {
      describeWritable(() => {
        const bucket = new BehaviorSubject('__DEFAULT__')
        const df = new DeriverFamily(() => ({
          source: bucket,
          then: (v) => v,
          next: (v) => bucket.next(v),
          error: (err) => bucket.error(err),
          complete: () => bucket.complete(),
        }))
        return df.get('whatever')
      })
    })

    it('keeps track of different members', () => {
      runTestScheduler(({ expectObservable, cold }) => {
        const srcA = ' a-b--c-|'
        const srcB = ' d--e-f--|'
        const wantA = srcA.toUpperCase()
        const wantB = srcB.toUpperCase()

        const bA = new BehaviorSubject('0')
        const bB = new BehaviorSubject('0')

        const df = new DeriverFamily<string>((k) => ({
          source: k === 'a' ? bA : bB,
          then: (v) => v.toLowerCase(),
          next: (v) => (k === 'a' ? bA : bB).next(v.toUpperCase()),
          complete: () => (k === 'a' ? bA : bB).complete(),
        }))
        const dA = df.get('a')
        const dB = df.get('b')

        cold(srcA).subscribe(dA)
        cold(srcB).subscribe(dB)

        expectObservable(bA).toBe(wantA)
        expectObservable(bB).toBe(wantB)
        expectObservable(dA).toBe(srcA)
        expectObservable(dB).toBe(srcB)
      })
    })

    it('catches and maps circular dependencies', () => {
      runTestScheduler(({ hot, expectObservable }) => {
        // Note: The synchronous value emission before the circular
        // dependency error is not explicitly desired, but a side-effect
        // of a current implementation detail.
        const src = '  a--------b----------c---'
        const loop = ' 0--1-----------0--------'
        const wantA = 'A--(AAX)-------B----C---'
        const wantB = 'A--(AX)--------(BB)-C---'

        // const loopSrc = new BehaviorSubject(false)
        // hot(loop, { 0: false, 1: true }).subscribe(loopSrc)
        const loopSrc = hot(loop, { 0: false, 1: true })

        const coreSrc = hot(src).pipe(shareReplay(1))

        const df: DeriverFamily<string> = new DeriverFamily((k) => ({
          source: loopSrc.pipe(
            switchMap((loop) => {
              if (!loop) return coreSrc
              return k === 'a' ? df.get('b') : df.get('a')
            }),
          ),
          then: (v: string) => v.toUpperCase(),
          catch: () => 'X',
        }))

        expectObservable(df.get('a')).toBe(wantA)
        expectObservable(df.get('b')).toBe(wantB)
      })
    })
  })
})

describe('derivedFamily', () => {
  describe('as readable', () => {
    it('returns DeriverFamily', () => {
      const df = derivedFamily(() => ({
        source: of(true),
        then: (v) => String(v),
      }))
      expect(df).toBeInstanceOf(DeriverFamily)
      expectType<
        DeriverFamily<
          boolean,
          string,
          string,
          DeriverFamilyBehavior<boolean, string>
        >
      >(df)

      const d = df.get('whatever')
      expect(d).toBeInstanceOf(DeriverMember)
      expectType<Readable<string>>(d)
    })
  })

  describe('as writable', () => {
    it('returns DeriverFamily', () => {
      const df = derivedFamily(() => ({
        source: of(true),
        then: (v) => String(v),
        next: noop,
      }))
      expect(df).toBeInstanceOf(DeriverFamily)
      expectType<
        DeriverFamily<
          boolean,
          string,
          string,
          WriteDeriverFamilySyncBehavior<boolean, string>
        >
      >(df)

      const d = df.get('whatever')
      expect(d).toBeInstanceOf(WriteDeriverMember)
      expectType<Writable<string>>(d)
    })
  })

  it('keeps the source and map fn', () => {
    runTestScheduler(({ expectObservable, cold }) => {
      const src = ' a-b--c---|'
      const want = 'A-B--C---|'
      const o = cold(src)
      const df = derivedFamily(() => ({
        source: o,
        then: (v) => v.toUpperCase(),
      }))
      expectObservable(df.get('whatever')).toBe(want)
    })
  })

  it('keeps the initial value', () => {
    runTestScheduler(({ expectObservable, cold }) => {
      const src = ' --a-|'
      const want = '0-a-|'
      const o = cold(src)
      const df = derivedFamily(() => ({ source: o, then: pass, initial: '0' }))
      expectObservable(df.get('whatever')).toBe(want)
    })
  })
})
