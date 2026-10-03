import type { Field } from './schema.ts'
import type { ValueStore } from './store.ts'

export interface WireState {
  fields: Array<Omit<Field, 'monitor'>>
  values: Record<string, unknown>
  revision: number
}

export interface MetricsState {
  fps: number
  at: number
}

interface SharedStateLike {
  value: () => unknown
  mutate: (recipe: (state: any) => void) => unknown
  on: (event: 'updated', listener: (state: unknown) => void) => () => void
}

function sharedState(value: unknown) {
  return value as SharedStateLike
}

interface LocalBridgeState {
  fields: Field[]
  store: ValueStore
  listeners: Set<() => void>
  metrics: MetricsState
  setPerformanceEnabled: (enabled: boolean) => void
}

const LOCAL_BRIDGE_KEY = Symbol.for('pmndrs-devtools:local-bridge')

function getLocalBridge(): LocalBridgeState | undefined {
  return (globalThis as Record<PropertyKey, unknown>)[LOCAL_BRIDGE_KEY] as
    LocalBridgeState | undefined
}

function setLocalBridge(value: LocalBridgeState | undefined) {
  const target = globalThis as Record<PropertyKey, unknown>
  if (value) target[LOCAL_BRIDGE_KEY] = value
  else delete target[LOCAL_BRIDGE_KEY]
}

function notifyLocalBridge() {
  const local = getLocalBridge()
  if (!local) return
  for (const listener of [...local.listeners]) listener()
}

export function currentScope() {
  return `app:${location.pathname}`
}

function serializableFields(fields: Field[]) {
  return fields.map(({ monitor: _monitor, ...field }) => field)
}

export interface AppBridgeHandle {
  dispose: () => void
}

export interface AppBridgeOptions {
  remote?: boolean
}

export function startAppBridge(
  fields: Field[],
  store: ValueStore,
  options: AppBridgeOptions = {},
): AppBridgeHandle {
  let destroyed = false
  let client: any
  let offStore: (() => void) | undefined
  let offCommands: (() => void) | undefined
  let offShared: (() => void) | undefined
  let metricsTimer: number | undefined
  let shared: SharedStateLike | undefined
  let metricsShared: SharedStateLike | undefined
  let revision = 0
  let localMetrics: MetricsState = { fps: 0, at: 0 }
  let localStoreOff: (() => void) | undefined
  let publish: (() => void) | undefined

  const localState: LocalBridgeState = {
    fields: fields.slice(),
    store,
    listeners: new Set(),
    metrics: localMetrics,
    setPerformanceEnabled: (enabled) => {
      if (enabled) startMetrics()
      else stopMetrics()
      notifyLocalBridge()
    },
  }

  localStoreOff = store.subscribe(() => notifyLocalBridge())
  setLocalBridge(localState)

  async function start() {
    try {
      const { connectDevframe } = await import('devframe/client')
      client = await connectDevframe({ baseURL: '/__pmndrs-devtools/' })
      if (destroyed) return

      const rpc = client.scope(currentScope()).rpc
      const wireFields = serializableFields(fields)

      shared = sharedState(
        await rpc.sharedState('state', {
          initialValue: {
            fields: wireFields,
            values: store.get(),
            revision: 0,
          },
        }),
      )

      metricsShared = sharedState(
        await rpc.sharedState('metrics', {
          initialValue: { fps: 0, at: 0 } satisfies MetricsState,
        }),
      )

      publish = () => {
        revision++
        const state: WireState = {
          fields: wireFields,
          values: store.get(),
          revision,
        }
        shared!.mutate((current: any) => {
          current.fields = state.fields
          current.values = state.values
          current.revision = state.revision
        })
      }

      offShared = shared.on('updated', (raw) => {
        const next = raw as WireState
        if (!next || typeof next.revision !== 'number' || !next.values) return
        if (next.revision <= revision) return
        revision = next.revision
        store.replace(next.values, 'remote')
      })

      const commandsState = sharedState(
        await rpc.sharedState('commands', {
          initialValue: { performance: false, refresh: 0, listeners: 0 },
        }),
      )
      let lastRefresh = 0
      const setPublishingEnabled = (enabled: boolean) => {
        if (enabled) {
          if (!offStore) {
            publish?.()
            offStore = store.subscribe((_tree, change) => {
              if (change.source === 'local') publish?.()
            })
          }
        } else if (offStore) {
          offStore()
          offStore = undefined
        }
      }

      offCommands = commandsState.on('updated', (raw) => {
        const commands = raw as {
          performance?: boolean
          refresh?: number
          listeners?: number
        }
        const enabled = Boolean(commands.performance)
        if (enabled) startMetrics()
        else stopMetrics()
        setPublishingEnabled(Number(commands.listeners ?? 0) > 0)

        if (
          typeof commands.refresh === 'number' &&
          commands.refresh > lastRefresh
        ) {
          lastRefresh = commands.refresh
          publish?.()
        }
      })

      const initialCommands = commandsState.value() as {
        performance?: boolean
        refresh?: number
        listeners?: number
      }
      setPublishingEnabled(Number(initialCommands.listeners ?? 0) > 0)
      if (Boolean(initialCommands.performance)) startMetrics()
    } catch {
      // A plain/static page can run without a Devframe server.
    }
  }

  function startMetrics() {
    if (metricsTimer !== undefined || !metricsShared) return
    let frames = 0
    let start = performance.now()

    const sample = () => {
      if (destroyed || !metricsShared) return
      frames++
      const now = performance.now()
      if (now - start >= 1000) {
        const fps = Math.round((frames * 1000) / (now - start))
        frames = 0
        start = now
        localMetrics = { fps, at: Date.now() }
        localState.metrics = localMetrics
        metricsShared?.mutate((state: any) => {
          state.fps = fps
          state.at = localMetrics.at
        })
        notifyLocalBridge()
      }
      metricsTimer = requestAnimationFrame(sample)
    }

    metricsTimer = requestAnimationFrame(sample)
  }

  function stopMetrics() {
    if (metricsTimer !== undefined) {
      cancelAnimationFrame(metricsTimer)
      metricsTimer = undefined
    }
  }

  if (options.remote !== false) void start()

  return {
    dispose() {
      destroyed = true
      stopMetrics()
      offStore?.()
      offShared?.()
      offCommands?.()
      localStoreOff?.()
      if (getLocalBridge() === localState) setLocalBridge(undefined)
      client?.dispose?.()
    },
  }
}

export interface DevtoolsConnection {
  readonly transport: 'devframe' | 'waiting'
  readonly fields: Field[]
  readonly values: Record<string, unknown>
  readonly metrics: MetricsState
  set: (path: string[], value: unknown) => void
  setPerformanceEnabled: (enabled: boolean) => void
  subscribe: (listener: () => void) => () => void
  dispose: () => void
}

// Local debug uses the same in-page ValueStore directly; remote DevTools use Devframe shared state,
// so keeping these adapters separate avoids pretending the two transports share the same lifetime/API.
export async function connectLocalDevtools(): Promise<DevtoolsConnection> {
  let local = getLocalBridge()
  if (!local) {
    await new Promise<void>((resolve, reject) => {
      const started = performance.now()
      const timer = window.setInterval(() => {
        local = getLocalBridge()
        if (local) {
          window.clearInterval(timer)
          resolve()
        } else if (performance.now() - started >= 2000) {
          window.clearInterval(timer)
          reject(new Error('No local PMNDRS DevTools runtime is available'))
        }
      }, 16)
    })
  }

  const runtime = local!
  return {
    transport: 'devframe',
    get fields() {
      return runtime.fields
    },
    get values() {
      return structuredClone(runtime.store.get())
    },
    get metrics() {
      return runtime.metrics
    },
    set(path, value) {
      runtime.store.setPath(path, value, 'remote')
    },
    setPerformanceEnabled(enabled) {
      runtime.setPerformanceEnabled(enabled)
    },
    subscribe(listener) {
      runtime.listeners.add(listener)
      return () => runtime.listeners.delete(listener)
    },
    dispose() {
      runtime.setPerformanceEnabled(false)
    },
  }
}

export async function connectDevtools(): Promise<DevtoolsConnection> {
  const listeners = new Set<() => void>()
  const { connectDevframe } = await import('devframe/client')
  const client = await connectDevframe({ baseURL: '/__pmndrs-devtools/' })
  const rpc = client.scope(currentScope()).rpc

  let state: WireState | null = null
  let metrics: MetricsState = { fps: 0, at: 0 }
  let stateOff: (() => void) | undefined
  let metricsOff: (() => void) | undefined
  let commands: SharedStateLike | undefined
  let disposed = false

  const notify = () => {
    for (const listener of [...listeners]) listener()
  }

  const stateShared = sharedState(
    await rpc.sharedState('state', {
      initialValue: { fields: [], values: {}, revision: 0 },
    }),
  )
  const metricsShared = sharedState(
    await rpc.sharedState('metrics', {
      initialValue: { fps: 0, at: 0 },
    }),
  )
  commands = sharedState(
    await rpc.sharedState('commands', {
      initialValue: { performance: false, refresh: 0 },
    }),
  )

  stateOff = stateShared.on('updated', (raw) => {
    const next = raw as WireState
    if (!next || typeof next.revision !== 'number') return
    if (state && next.revision < state.revision) return
    state = next
    notify()
  })

  metricsOff = metricsShared.on('updated', (raw) => {
    const next = raw as MetricsState
    if (!next || typeof next.fps !== 'number') return
    metrics = next
    notify()
  })

  let announced = false
  const announce = () => {
    if (disposed) return
    commands?.mutate((current: any) => {
      if (!announced) {
        current.listeners = Number(current.listeners ?? 0) + 1
        announced = true
      }
      current.refresh = Date.now()
    })
  }
  announce()
  const announceInterval = setInterval(announce, 500)
  const announceTimeout = setTimeout(
    () => clearInterval(announceInterval),
    3000,
  )

  return {
    get transport() {
      return state ? 'devframe' : 'waiting'
    },
    get fields() {
      return (state?.fields ?? []) as Field[]
    },
    get values() {
      return state?.values ?? {}
    },
    get metrics() {
      return metrics
    },
    set(path, value) {
      stateShared.mutate((current: any) => {
        let node = current.values
        for (let i = 0; i < path.length - 1; i++) node = node[path[i]!] ??= {}
        node[path[path.length - 1]!] = value
        current.revision = Number(current.revision ?? 0) + 1
      })
    },
    setPerformanceEnabled(enabled) {
      commands?.mutate((current: any) => {
        current.performance = enabled
      })
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    dispose() {
      disposed = true
      clearInterval(announceInterval)
      clearTimeout(announceTimeout)
      stateOff?.()
      metricsOff?.()
      commands?.mutate((current: any) => {
        current.listeners = Math.max(0, Number(current.listeners ?? 0) - 1)
        current.performance = false
      })
      listeners.clear()
    },
  }
}
