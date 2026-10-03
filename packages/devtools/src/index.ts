import { startAppBridge } from './bridge.ts'
import { fpsMonitor } from './monitors.ts'
import type { Field, Schema } from './schema.ts'
import { walkSchema } from './schema.ts'
import { createValueStore } from './store.ts'

export { fpsMonitor }
export type * from './schema.ts'
export type { UiNode } from './ui.ts'
export { connectDevtools } from './bridge.ts'
export type { DevtoolsConnection } from './bridge.ts'

export interface Change {
  path: string[]
  value: unknown
  previous: unknown
  source: 'local' | 'remote'
}

export interface Controls<S extends Schema = Schema> {
  get: () => LiveValues<S>
  set: (path: string | string[], value: unknown) => void
  watch: (
    path: string | string[],
    listener: (value: unknown, change: Change) => void,
  ) => () => void
  onChange: (listener: (change: Change) => void) => () => void
  dispose: () => void
}

type LiveValue<T> = T extends { value: infer V }
  ? V
  : T extends { monitor: () => infer V }
    ? V
    : T extends number | boolean | string
      ? T
      : T extends Schema
        ? LiveValues<T>
        : never

export type LiveValues<S extends Schema> = { [K in keyof S]: LiveValue<S[K]> }

function pathOf(path: string | string[]) {
  return Array.isArray(path) ? path : path.split('.').filter(Boolean)
}

function buildValues(
  fields: Field[],
  store: ReturnType<typeof createValueStore>,
) {
  const root: Record<string, unknown> = {}
  for (const field of fields) {
    let target = root
    for (let i = 0; i < field.path.length - 1; i++) {
      const key = field.path[i]!
      target[key] ??= {}
      target = target[key] as Record<string, unknown>
    }
    const key = field.path.at(-1)!
    const descriptor: PropertyDescriptor = {
      enumerable: true,
      configurable: false,
      get: () => store.getPath(field.path),
    }
    if (field.kind !== 'monitor')
      descriptor.set = (value) => store.setPath(field.path, value)
    Object.defineProperty(target, key, descriptor)
  }
  return root
}

export interface LevaOptions {
  remote?: boolean
}

export function leva<S extends Schema>(
  schema: S,
  options: LevaOptions = {},
): LiveValues<S> & Controls<S> {
  const { fields, initial } = walkSchema(schema)
  const store = createValueStore(initial)
  const bridge = startAppBridge(fields, store, options)
  const cleanup = [bridge.dispose]
  const controls = buildValues(fields, store) as LiveValues<S> & Controls<S>

  const monitorTimers = fields
    .filter((field) => field.kind === 'monitor' && field.monitor)
    .map((field) =>
      setInterval(
        () => store.setPath(field.path, field.monitor!(), 'local'),
        field.interval ?? 250,
      ),
    )

  cleanup.push(() => monitorTimers.forEach(clearInterval))

  const get = () => structuredClone(store.get()) as LiveValues<S>
  const set = (path: string | string[], value: unknown) =>
    store.setPath(pathOf(path), value)
  const watch = (
    path: string | string[],
    listener: (value: unknown, change: Change) => void,
  ) => {
    const wanted = pathOf(path)
    return store.subscribe((_tree, change) => {
      const matches =
        wanted.length === change.path.length &&
        wanted.every((part, i) => change.path[i] === part)
      if (matches) listener(store.getPath(wanted), change)
    })
  }
  const onChange = (listener: (change: Change) => void) =>
    store.subscribe((_tree, change) => listener(change))
  const dispose = () => {
    while (cleanup.length) cleanup.pop()?.()
  }

  Object.defineProperties(controls, {
    get: { value: get, enumerable: false },
    set: { value: set, enumerable: false },
    watch: { value: watch, enumerable: false },
    onChange: { value: onChange, enumerable: false },
    dispose: { value: dispose, enumerable: false },
  })

  return controls
}
