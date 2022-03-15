export const clamp = (min: number, val: number, max: number): number =>
  Math.min(Math.max(min, val), max)

export const range = (length: number): number[] =>
  Array.from({ length }, (_, i) => i)

export const asNumber = (val: string | number): number =>
  typeof val === 'number' ? val ?? 0 : !val ? 0 : parseInt(val, 10) ?? 0

export const exactMatch = (str: string, pattern: RegExp | string): boolean => {
  if (typeof pattern === 'string') return str === pattern
  const match = pattern.exec(str)
  return match !== null && str === match[0]
}
