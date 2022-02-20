import { BehaviorSubject } from 'rxjs'
import { describeReadable, noop, runTestScheduler } from 'spec/helpers'
import Reader, { readable } from 'src/subjects/Reader'

describe('Reader', () => {
  it.each(['', '0', 0, 123, true, 'def'] as const)(
    'emits initial value synchronously (%j)',
    (v) => {
      runTestScheduler(({ expectObservable }) => {
        expectObservable(new Reader(v, noop)).toBe('d', { d: v })
      })
    },
  )

  describe('with set callback', () => {
    describeReadable(
      () => {
        const s = new BehaviorSubject('__BUCKET-DEFAULT__')
        const r = new Reader('__DEFAULT__', (set) => {
          const sub = s.subscribe((v) => set(v))
          return () => sub.unsubscribe()
        })
        return [r, s]
      },
      {
        defaultValue: '__DEFAULT__',
        latestValue: '__BUCKET-DEFAULT__',
        skipCompletion: true,
        skipError: true,
      },
    )
  })

  describe('with set object', () => {
    describeReadable(
      () => {
        const s = new BehaviorSubject('__BUCKET-DEFAULT__')
        const r = new Reader('__DEFAULT__', ({ next, error, complete }) => {
          const sub = s.subscribe({ next, error, complete })
          return () => sub.unsubscribe()
        })
        return [r, s]
      },
      {
        defaultValue: '__DEFAULT__',
        latestValue: '__BUCKET-DEFAULT__',
      },
    )
  })

  it('only calls set on first new subscription', () => {
    const init = jest.fn()

    const r = new Reader('0', init)
    expect(init).toBeCalledTimes(0)

    const s0a = r.subscribe(noop)
    expect(init).toBeCalledTimes(1)
    s0a.unsubscribe()
    expect(init).toBeCalledTimes(1)

    const s1a = r.subscribe(noop)
    expect(init).toBeCalledTimes(2)
    const s1b = r.subscribe(noop)
    expect(init).toBeCalledTimes(2)
    s1b.unsubscribe()
    s1a.unsubscribe()
    expect(init).toBeCalledTimes(2)

    const s2a = r.subscribe(noop)
    expect(init).toBeCalledTimes(3)
    const s2b = r.subscribe(noop)
    expect(init).toBeCalledTimes(3)
    s2a.unsubscribe()
    s2b.unsubscribe()
    expect(init).toBeCalledTimes(3)
  })

  it('only calls destroy when last subscription ended', () => {
    const destroy = jest.fn()
    const init = () => destroy

    const r = new Reader('0', init)
    expect(destroy).toBeCalledTimes(0)

    const s0a = r.subscribe(noop)
    expect(destroy).toBeCalledTimes(0)
    s0a.unsubscribe()
    expect(destroy).toBeCalledTimes(1)

    const s1a = r.subscribe(noop)
    const s1b = r.subscribe(noop)
    expect(destroy).toBeCalledTimes(1)
    s1a.unsubscribe()
    expect(destroy).toBeCalledTimes(1)
    s1b.unsubscribe()
    expect(destroy).toBeCalledTimes(2)

    const s2a = r.subscribe(noop)
    const s2b = r.subscribe(noop)
    expect(destroy).toBeCalledTimes(2)
    s2b.unsubscribe()
    expect(destroy).toBeCalledTimes(2)
    s2a.unsubscribe()
    expect(destroy).toBeCalledTimes(3)
  })
})

describe('readable', () => {
  it('returns Reader', () => {
    expect(readable('0', noop)).toBeInstanceOf(Reader)
  })

  it.each(['', '0', 123, true])('keeps initial value (%j)', (v) => {
    runTestScheduler(({ expectObservable }) => {
      expectObservable(new Reader(v, noop)).toBe('d', { d: v })
    })
  })

  it('keeps the init callback', () => {
    const init = jest.fn()
    const r = readable('0', init)
    expect(init).toBeCalledTimes(0)

    const sub = r.subscribe(noop)
    expect(init).toBeCalledTimes(1)

    sub.unsubscribe()
    expect(init).toBeCalledTimes(1)
  })
})
