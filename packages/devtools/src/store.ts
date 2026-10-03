import { getPath } from './schema.ts'

export type ValueTree = Record<string, unknown>
export type ChangeSource = 'local' | 'remote'
export interface Change {
  path: string[]
  value: unknown
  previous: unknown
  source: ChangeSource
}
export type Listener = (tree: ValueTree, change: Change) => void

export interface ValueStore {
  get: () => ValueTree
  getPath: (path: string[]) => unknown
  setPath: (path: string[], value: unknown, source?: ChangeSource) => void
  replace: (tree: ValueTree, source?: ChangeSource) => void
  subscribe: (listener: Listener) => () => void
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

function writePath(tree: ValueTree, path: string[], value: unknown) {
  if (path.length === 0) throw new Error('Cannot write an empty path')
  let node = tree
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i]!
    const child = node[key]
    if (typeof child !== 'object' || child === null) node[key] = {}
    node = node[key] as ValueTree
  }
  node[path[path.length - 1]!] = value
}

export function createValueStore(initial: ValueTree): ValueStore {
  let tree = clone(initial)
  const listeners = new Set<Listener>()

  const emit = (change: Change) => {
    for (const listener of [...listeners]) listener(tree, change)
  }

  return {
    get: () => tree,
    getPath: (path) => getPath(tree, path),

    setPath(path, value, source = 'local') {
      const previous = clone(getPath(tree, path))
      const next = clone(tree)
      writePath(next, path, value)
      tree = next
      emit({ path: [...path], value, previous, source })
    },

    replace(next, source = 'remote') {
      const previous = clone(tree)
      tree = clone(next)
      emit({ path: [], value: clone(tree), previous, source })
    },

    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
