import type { Observer } from 'rxjs'

import type { FamilyKey, InteropObserver } from './types'

export const isEmpty = (
  obj: Record<string | number | symbol, unknown> | Iterable<unknown>,
): boolean => {
  for (const _ in obj) return false
  return true
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

export const toRxObserver = <V>(
  observerOrNext?: InteropObserver<V> | null,
): Partial<Observer<V>> => {
  // Next callback.
  if (typeof observerOrNext === 'function') return { next: observerOrNext }
  // Svelte "writable" interop.
  if (observerOrNext && !('next' in observerOrNext) && 'set' in observerOrNext)
    return { next: (v) => observerOrNext.set(v) }
  // Misc observers.
  return observerOrNext ?? {}
}
