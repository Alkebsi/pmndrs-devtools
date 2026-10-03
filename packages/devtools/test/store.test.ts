import { describe, expect, it } from 'vitest'
import { createValueStore } from '../src/store.ts'

describe('value store', () => {
  it('writes through frozen nested state', () => {
    const initial = { Settings: { width: 10, enabled: true } }
    Object.freeze(initial.Settings)
    Object.freeze(initial)
    const store = createValueStore(initial)
    store.setPath(['Settings', 'width'], 80)
    expect(store.getPath(['Settings', 'width'])).toBe(80)
  })

  it('reports local and remote changes', () => {
    const store = createValueStore({ a: 1 })
    const changes: string[] = []
    store.subscribe((_tree, change) => changes.push(change.source))
    store.setPath(['a'], 2)
    store.replace({ a: 3 }, 'remote')
    expect(changes).toEqual(['local', 'remote'])
  })
})
