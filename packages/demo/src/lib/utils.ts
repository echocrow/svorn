export const clamp = (min: number, val: number, max: number): number =>
  Math.min(Math.max(min, val), max)

export const range = (length: number): number[] =>
  Array.from({ length }, (_, i) => i)

export const asNumber = (val: string | number): number =>
  typeof val === 'number' ? val ?? 0 : !val ? 0 : parseInt(val, 10) ?? 0

export const IS_DEV_ENV =
  typeof process !== 'undefined' &&
  (process.env?.NODE_ENV === 'development' || process.env?.NODE_ENV === 'test')
