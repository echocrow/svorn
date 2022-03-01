import { type Subscribable, from } from 'rxjs'
import { pass, runTestScheduler } from 'spec/helpers'
import derivedFamily, { DeriverFamily } from 'src/stores/derivedFamily'

import { describeDerivable } from './derived.spec'

describe('DeriverFamily', () => {
  describe('any member', () => {
    describeDerivable(
      (source, then) => new DeriverFamily(() => source, then).get('whatever'),
      (source, then, initialValue) =>
        new DeriverFamily(() => source, then, initialValue).get('whatever'),
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
      const df = new DeriverFamily(
        (k) => (k === 'a' ? oA : oB),
        (v) => v.toUpperCase(),
      )
      expectObservable(df.get('a')).toBe(wantA)
      expectObservable(df.get('b')).toBe(wantB)
    })
  })
})

const describeDerivedFamilyPassingArgs = (
  makeDerivedOptions: (
    source: Subscribable<string>,
    then: (v: string) => string,
  ) => Parameters<typeof derivedFamily>[1],
) =>
  describe('derived args passing', () => {
    it('keeps the source and map fn', () => {
      runTestScheduler(({ expectObservable, cold }) => {
        const src = ' a-b--c---|'
        const want = 'A-B--C---|'
        const o = cold(src)
        const df = derivedFamily(
          () => o,
          makeDerivedOptions(o, (v) => v.toUpperCase()),
        )
        expectObservable(df.get('whatever')).toBe(want)
      })
    })

    it('keeps the initial value', () => {
      runTestScheduler(({ expectObservable, cold }) => {
        const src = ' --a-|'
        const want = '0-a-|'
        const o = cold(src)
        const df = derivedFamily(() => o, makeDerivedOptions(o, pass), '0')
        expectObservable(df.get('whatever')).toBe(want)
      })
    })
  })

describe('derivedFamily', () => {
  describe('as readable', () => {
    it('returns DeriverFamily', () => {
      expect(derivedFamily(() => from([]), pass)).toBeInstanceOf(DeriverFamily)
    })

    describeDerivedFamilyPassingArgs((_, then) => then)
  })
})
