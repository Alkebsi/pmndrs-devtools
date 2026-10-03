import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createValueStore } from '../src/store.ts'
import { connectDevtools, startAppBridge } from '../src/bridge.ts'
import type { Field } from '../src/schema.ts'

const mockConnectDevframe = vi.hoisted(() => vi.fn())

vi.mock('devframe/client', () => ({
  connectDevframe: mockConnectDevframe,
}))

type Listener = (state: unknown) => void

type SharedStateOptions = {
  initialValue?: unknown
}

class FakeSharedBus {
  serverValue: unknown
  readonly handles = new Set<FakeSharedState>()
  mutationCount = 0

  constructor(initialValue: unknown) {
    this.serverValue = structuredClone(initialValue)
  }

  createHandle(initialValue: unknown) {
    const handle = new FakeSharedState(this, structuredClone(initialValue))
    this.handles.add(handle)
    return handle
  }

  setServerValue(value: unknown, broadcast = true) {
    this.serverValue = structuredClone(value)
    if (!broadcast) return
    this.broadcast()
  }

  broadcast() {
    for (const handle of this.handles) handle.receive(this.serverValue)
  }

  mutate(
    source: FakeSharedState,
    recipe: (state: Record<string, unknown>) => void,
  ) {
    const next = structuredClone(this.serverValue) as Record<string, unknown>
    recipe(next)
    this.serverValue = next
    source.snapshot = structuredClone(next)
    this.mutationCount++
    for (const handle of this.handles) {
      if (handle !== source) handle.receive(this.serverValue)
    }
    for (const listener of source.listeners) listener(source.snapshot)
  }

  listenerCount() {
    let count = 0
    for (const handle of this.handles) count += handle.listeners.size
    return count
  }
}

class FakeSharedState {
  readonly listeners = new Set<Listener>()

  constructor(
    private readonly bus: FakeSharedBus,
    public snapshot: unknown,
  ) {}

  value() {
    return structuredClone(this.snapshot)
  }

  mutate(recipe: (state: Record<string, unknown>) => void) {
    this.bus.mutate(this, recipe)
  }

  on(_event: 'updated', listener: Listener) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  receive(value: unknown) {
    this.snapshot = structuredClone(value)
    for (const listener of [...this.listeners]) listener(this.snapshot)
  }
}

function createFakeDevframe() {
  const buses = new Map<string, FakeSharedBus>()

  const defaults: Record<string, unknown> = {
    state: { fields: [], values: {}, revision: 0 },
    metrics: { fps: 0, at: 0 },
    commands: { performance: false, refresh: 0, listeners: 0 },
  }

  const sharedState = vi.fn(
    async (key: string, options: SharedStateOptions = {}) => {
      const bus =
        buses.get(key) ??
        new FakeSharedBus(options.initialValue ?? defaults[key])
      buses.set(key, bus)
      return bus.createHandle(options.initialValue ?? defaults[key])
    },
  )

  const rpc = {
    sharedState,
  }

  const client = {
    scope: () => ({ rpc }),
    dispose: vi.fn(),
  }

  mockConnectDevframe.mockResolvedValue(client as never)

  return {
    buses,
    rpc,
  }
}

const fields: Field[] = [
  {
    path: ['width'],
    kind: 'number',
    label: 'width',
    min: 0,
    max: 100,
    step: 1,
  },
]

async function flushMicrotasks() {
  await vi.dynamicImportSettled()
  for (let i = 0; i < 20; i++) await Promise.resolve()
}

async function waitForBus(
  fake: ReturnType<typeof createFakeDevframe>,
  key: string,
) {
  for (let i = 0; i < 50; i++) {
    const bus = fake.buses.get(key)
    if (bus) return bus
    await Promise.resolve()
  }
  throw new Error(`Fake shared-state bus did not initialize: ${key}`)
}

afterEach(() => {
  vi.clearAllMocks()
  vi.useRealTimers()
})

describe('devtools bridge', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: { pathname: '/app.html' },
    })
  })

  it('publishes only while commands.listeners is greater than zero', async () => {
    vi.useFakeTimers()
    const fake = createFakeDevframe()
    const store = createValueStore({ width: 10 })
    const bridge = startAppBridge(fields, store)

    await flushMicrotasks()

    const stateBus = await waitForBus(fake, 'state')
    const commandsBus = await waitForBus(fake, 'commands')
    expect(stateBus.mutationCount).toBe(0)

    store.setPath(['width'], 20)
    expect(stateBus.mutationCount).toBe(0)

    commandsBus.setServerValue({
      performance: false,
      refresh: Date.now(),
      listeners: 1,
    })
    expect(stateBus.mutationCount).toBe(2)

    const before = stateBus.mutationCount
    store.setPath(['width'], 30)
    expect(stateBus.mutationCount).toBe(before + 1)

    bridge.dispose()
  })

  it('receives a panel heartbeat after the app listener attaches late', async () => {
    vi.useFakeTimers()
    const fake = createFakeDevframe()
    const panel = await connectDevtools()

    // The first announce happens before startAppBridge has subscribed to commands.
    const commandsBus = await waitForBus(fake, 'commands')
    expect(commandsBus.serverValue).toMatchObject({ listeners: 1 })

    const store = createValueStore({ width: 10 })
    const bridge = startAppBridge(fields, store)
    await flushMicrotasks()

    const stateBus = await waitForBus(fake, 'state')
    expect(stateBus.mutationCount).toBe(0)

    await vi.advanceTimersByTimeAsync(500)

    store.setPath(['width'], 40)
    expect(stateBus.mutationCount).toBeGreaterThan(0)
    expect(stateBus.serverValue).toMatchObject({ values: { width: 40 } })

    bridge.dispose()
    panel.dispose()
  })

  it('disposes subscriptions and decrements the panel listener count', async () => {
    vi.useFakeTimers()
    const fake = createFakeDevframe()
    const connection = await connectDevtools()
    const stateBus = await waitForBus(fake, 'state')
    const metricsBus = await waitForBus(fake, 'metrics')
    const commandsBus = await waitForBus(fake, 'commands')

    let notified = 0
    connection.subscribe(() => {
      notified++
    })

    expect(commandsBus.serverValue).toMatchObject({ listeners: 1 })
    expect(stateBus.listenerCount()).toBe(1)
    expect(metricsBus.listenerCount()).toBe(1)

    connection.dispose()

    expect(commandsBus.serverValue).toMatchObject({ listeners: 0 })
    expect(stateBus.listenerCount()).toBe(0)
    expect(metricsBus.listenerCount()).toBe(0)

    const state = commandsBus.serverValue as { listeners: number }
    stateBus.setServerValue({ fields: [], values: {}, revision: 1 })
    expect(notified).toBe(0)
    expect(state.listeners).toBe(0)
  })
})
