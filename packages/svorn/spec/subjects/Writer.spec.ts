import { describeWritable } from 'spec/helpers'
import Writer, { writable } from 'src/subjects/Writer'

describe('Writer', () => {
  describeWritable(() => new Writer('0'))

  test.each(['', '0', 123, true])('keeps initial value (%j)', (v) => {
    expect(new Writer(v).getValue()).toBe(v)
  })
})

describe('writable', () => {
  it('returns Writer', () => {
    expect(writable('')).toBeInstanceOf(Writer)
  })

  test.each(['', '0', 123, true])('keeps initial value (%j)', (v) => {
    expect(writable(v).getValue()).toBe(v)
  })
})
