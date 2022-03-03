import { BehaviorSubject, from } from 'rxjs'
import {
  describeWritable,
  expectType,
  pass,
  runTestScheduler,
} from 'spec/helpers'
import derivedFamily, {
  DeriverFamily,
  DeriverMember,
  WriteDeriverMember,
} from 'src/stores/derivedFamily'
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

  it('keeps track of different sources', () => {
    runTestScheduler(({ expectObservable, cold }) => {
      const srcA = ' a-b--c-'
      const srcB = ' d--e-f-'
      const wantA = 'A-B--C-'
      const wantB = 'D--E-F-'

      const oA = cold(srcA)
      const oB = cold(srcB)
      const df = new DeriverFamily((k) => ({
        source: k === 'a' ? oA : oB,
        then: (v) => v.toUpperCase(),
      }))
      expectObservable(df.get('a')).toBe(wantA)
      expectObservable(df.get('b')).toBe(wantB)
    })
  })

  describe('as writable', () => {
    describe('any member', () => {
      describeWritable(() => {
        const bucket = new BehaviorSubject<string>('__DEFAULT__')
        const df = new DeriverFamily(() => ({
          source: bucket,
          then: (v: string) => v,
          next: (v: string) => bucket.next(v),
          error: (err) => bucket.error(err),
          complete: () => bucket.complete(),
        }))
        return df.get('whatever')
      })
    })
  })
})

describe('derivedFamily', () => {
  describe('as readable', () => {
    it('returns DeriverFamily', () => {
      const df = derivedFamily(() => ({ source: from([]), then: pass }))
      expect(df).toBeInstanceOf(DeriverFamily)
      expectType<DeriverFamily<any, any, any>>(df)

      const d = df.get('whatever')
      expect(d).toBeInstanceOf(DeriverMember)
      expectType<DeriverMember<any, any, any>>(d)
    })
  })

  describe('as writable', () => {
    it('returns DeriverFamily', () => {
      const df = derivedFamily(() => ({
        source: from([]),
        then: pass,
        next: noop,
      }))
      expect(df).toBeInstanceOf(DeriverFamily)
      expectType<DeriverFamily<any, any, any>>(df)

      const d = df.get('whatever')
      expect(d).toBeInstanceOf(WriteDeriverMember)
      expectType<WriteDeriverMember<any, any, any>>(d)
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
