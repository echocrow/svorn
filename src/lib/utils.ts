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

export const mapContains = (
  outer: Map<unknown, unknown>,
  inner: Map<unknown, unknown>,
): boolean => {
  if (outer.size < inner.size) return false
  for (const [k, v] of inner.entries())
    if (!outer.has(k) || !Object.is(outer.get(k), v)) return false
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
  let err: Error | undefined
  const subscription = source.subscribe({
    next: (v) => (value = [v]),
    error: (e) => (err = e),
  })
  if (!value || err) {
    if (!err) err = new Error('todo: value not received')
    subscription.unsubscribe()
    throw err
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
