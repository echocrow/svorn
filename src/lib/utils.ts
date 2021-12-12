export const range = (length: number): number[] =>
  Array.from({ length }, (_, i) => i)

export const isEmpty = (
  obj: Record<string | number | symbol, unknown> | Iterable<unknown>,
): boolean => {
  for (const _ in obj) return false
  return true
}

export const areSetsEqual = <T>(a: Set<T>, b: Set<T>): boolean => {
  if (a.size !== b.size) return false
  for (const v of a) if (!b.has(v)) return false
  return true
}
