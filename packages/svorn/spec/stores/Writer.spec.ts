import { describeUpdatable } from 'spec/helpers'
import Writer, { writable } from 'src/stores/Writer'

describe('Writer', () => {
  describeUpdatable(() => new Writer('0'))

  it.each(['', '0', 123, true])('keeps initial value (%j)', (v) => {
    expect(new Writer(v).getValue()).toBe(v)
  })
})

describe('writable', () => {
  it('returns Writer', () => {
    expect(writable('')).toBeInstanceOf(Writer)
  })

  it.each(['', '0', 123, true])('keeps initial value (%j)', (v) => {
    expect(writable(v).getValue()).toBe(v)
  })
})
