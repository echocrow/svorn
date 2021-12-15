import type { ObservedValueOf, Subscribable, Unsubscribable } from 'rxjs'

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

export const areMapsEqual = (
  a: Map<unknown, unknown>,
  b: Map<unknown, unknown>,
): boolean => {
  if (a.size !== b.size) return false
  for (const [k, v] of a.entries())
    if (!b.has(k) || b.get(k) !== v) return false
  return true
}

export const zipSetArray = <K, V>(ks: Set<K>, vs: V[]): Map<K, V> => {
  if (ks.size !== vs.length) throw new Error('todo: set vs array size mismatch')
  const m = new Map<K, V>()
  let i = 0
  for (const k of ks) {
    m.set(k, vs[i]!) // eslint-disable-line @typescript-eslint/no-non-null-assertion
    i++
  }
  return m
}

export const requireInstantValue = <S extends Subscribable<ObservedValueOf<S>>>(
  source: S,
): readonly [value: ObservedValueOf<S>, subscription: Unsubscribable] => {
  let value: [ObservedValueOf<S>] | undefined = undefined
  const subscription = source.subscribe({
    next: (v) => (value = [v]),
  })
  if (!value) {
    subscription.unsubscribe()
    throw new Error('todo: value not received')
  }
  const v = value[0]
  return [v, subscription]
}
