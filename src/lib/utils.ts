import type { ObservedValueOf, Subscribable, Unsubscribable } from 'rxjs'
import type { FamilyKey } from './types'

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
    if (!b.has(k) || !Object.is(b.get(k), v)) return false
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

export const stringify = (key: FamilyKey): string => {
  switch (typeof key) {
    case 'string':
      return key
    case 'number':
    case 'boolean':
      return String(key)
    case 'undefined':
      return ''
  }
  if (key === null) return 'null'
  throw new Error('Invalid key type used as Behavior Family key')
}
