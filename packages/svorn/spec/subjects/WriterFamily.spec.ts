import { describeWritable, runTestScheduler } from 'spec/helpers'
import WriterFamily, { writableFamily } from 'src/subjects/WriterFamily'

type WriterMember = ReturnType<WriterFamily<string, string>['get']>

const describeWriterMember = ({
  getFamily,
  memberKey,
  latestValue,
  defaultValue,
}: {
  getFamily: () => WriterFamily<string>
  memberKey: string
  latestValue: string
  defaultValue: string
}) =>
  describe('WriterFamily Member', () => {
    let wf: WriterFamily<string>
    let wm: WriterMember
    beforeEach(() => {
      wf = getFamily()
      wm = wf.get(memberKey)
    })

    it('synchronously emits latest value', () => {
      runTestScheduler(({ cold, expectObservable }) => {
        const src = '-'
        const want = '0'
        cold(src).subscribe(() => wf.reset(memberKey))
        expectObservable(wm).toBe(want, { 0: latestValue })
      })
    })

    it('completes when family completes', () => {
      runTestScheduler(({ cold, expectObservable }) => {
        const src = 'a|'
        const want = src
        cold(src).subscribe({
          next: (v) => wf.next(memberKey, v),
          complete: () => wf.complete(),
        })
        expectObservable(wm).toBe(want)
      })
    })
    it('completes family when it completes', () => {
      runTestScheduler(({ cold, expectObservable }) => {
        const src = '|'
        const want = src
        cold(src).subscribe({ complete: () => wm.complete() })
        expectObservable(wf).toBe(want)
      })
    })

    it('errors when family errors', () => {
      runTestScheduler(({ cold, expectObservable }) => {
        const src = 'a#'
        const want = src
        cold(src).subscribe({
          next: (v) => wf.next(memberKey, v),
          error: (e) => wf.error(e),
        })
        expectObservable(wm).toBe(want)
      })
    })
    it('errors family when it errors', () => {
      runTestScheduler(({ cold, expectObservable }) => {
        const src = '#'
        const want = src
        cold(src).subscribe({ error: (e) => wm.error(e) })
        expectObservable(wf).toBe(want)
      })
    })

    it('emits default when reset', () => {
      runTestScheduler(({ cold, expectObservable }) => {
        const src = 'x'
        const want = src
        cold(src).subscribe(() => wf.reset(memberKey))
        expectObservable(wm).toBe(want, { x: defaultValue })
      })
    })

    it('keeps emitting after reset', () => {
      runTestScheduler(({ cold, expectObservable }) => {
        const src = ' x a x b c'
        const want = 'x a x b c'
        cold(src).subscribe((v) => {
          if (v === 'x') wf.reset(memberKey)
          else wm.next(v)
        })
        expectObservable(wm).toBe(want, {
          a: 'a',
          b: 'b',
          c: 'c',
          x: defaultValue,
        })
      })
    })

    it('does not re-emit value when sibling received value', () => {
      runTestScheduler(({ cold, expectObservable }) => {
        const sibWm = wf.get('some-other-sibling')

        const src = '   abc-'
        const want = '  abc-'
        const sibSrc = '-zzz'

        cold(src).subscribe(wm)
        cold(sibSrc).subscribe(sibWm)
        expectObservable(wm).toBe(want)
      })
    })

    describeWritable(() => wm)
  })

describe('WriterFamily', () => {
  let wf: WriterFamily<string>
  beforeEach(() => (wf = new WriterFamily('__DEFAULT__')))

  it('gets child values', () => {
    wf.next('a', '1')
    expect(wf.getValue('a')).toBe('1')
  })

  it('gets default child value as fallback', () => {
    expect(wf.getValue('notfound')).toBe('__DEFAULT__')
  })

  describe('initialized member', () => {
    let wm: ReturnType<WriterFamily<string, string>['get']>
    beforeEach(() => {
      wf.next('a', '1')
      wm = wf.get('a')
    })

    describeWriterMember({
      getFamily: () => wf,
      memberKey: 'a',
      latestValue: '1',
      defaultValue: '__DEFAULT__',
    })
  })

  describe('uninitialized member', () => {
    let wm: ReturnType<WriterFamily<string, string>['get']>
    beforeEach(() => (wm = wf.get('notfound')))

    describeWriterMember({
      getFamily: () => wf,
      memberKey: 'notfound',
      latestValue: '__DEFAULT__',
      defaultValue: '__DEFAULT__',
    })
  })

  it('emits simplified snapshots', () => {
    runTestScheduler(({ cold, expectObservable }) => {
      const src = ' --abcd-ef|'
      const want = '0-abcd--f|'
      const srcValues: Record<string, [string, string]> = {
        a: ['a', '1'],
        b: ['b', '2'],
        c: ['a', '__DEFAULT__'],
        d: ['b', '__DEFAULT__'],
        e: ['c', '__DEFAULT__'],
        f: ['d', '123'],
      }
      const wantValues = {
        0: {},
        a: { a: '1' },
        b: { a: '1', b: '2' },
        c: { b: '2' },
        d: {},
        f: { d: '123' },
      }
      cold(src, srcValues).subscribe({
        next: ([k, v]) => wf.next(k, v),
        complete: () => wf.complete(),
      })
      expectObservable(wf).toBe(want, wantValues)
    })
  })

  it('sets initial values', () => {
    const wf = new WriterFamily('__DEFAULT__', { a: '0', b: '1' })
    expect(wf.get('a').getValue()).toBe('0')
    expect(wf.get('b').getValue()).toBe('1')
    expect(wf.get('notfound').getValue()).toBe('__DEFAULT__')
  })
})

describe('writableFamily', () => {
  it('returns WriterFamily', () => {
    expect(writableFamily('')).toBeInstanceOf(WriterFamily)
  })

  test.each(['', '0', 123, true])('keeps initial value (%j)', (v) => {
    expect(writableFamily(v).get('notfound').getValue()).toBe(v)
  })

  it('keeps initial values', () => {
    const wf = writableFamily('__DEFAULT__', { a: '0', b: '1' })
    expect(wf.get('a').getValue()).toBe('0')
    expect(wf.get('b').getValue()).toBe('1')
    expect(wf.get('notfound').getValue()).toBe('__DEFAULT__')
  })
})
