export type FieldKind = 'number' | 'boolean' | 'color' | 'text' | 'monitor'

export interface MonitorDescriptor {
  monitor: () => number | string
  interval?: number
  label?: string
}

export interface NumberDescriptor {
  value: number
  min?: number
  max?: number
  step?: number
  label?: string
}

export interface BooleanDescriptor {
  value: boolean
  label?: string
}

export interface StringDescriptor {
  value: string
  label?: string
}

export type LeafValue = number | boolean | string
export type ControlDescriptor =
  NumberDescriptor | BooleanDescriptor | StringDescriptor | MonitorDescriptor
export interface Schema {
  [key: string]: LeafValue | ControlDescriptor | Schema
}

export interface Field {
  path: string[]
  kind: FieldKind
  label: string
  min?: number
  max?: number
  step?: number
  interval?: number
  monitor?: () => number | string
}

export interface WalkResult {
  fields: Field[]
  initial: Record<string, unknown>
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isMonitor(value: unknown): value is MonitorDescriptor {
  return isObject(value) && typeof value.monitor === 'function'
}

function isControl(
  value: unknown,
): value is NumberDescriptor | BooleanDescriptor | StringDescriptor {
  return isObject(value) && 'value' in value
}

function isColor(value: string) {
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)
}

function kindOf(value: LeafValue): FieldKind {
  if (typeof value === 'number') return 'number'
  if (typeof value === 'boolean') return 'boolean'
  return isColor(value) ? 'color' : 'text'
}

function defaultRange(value: number) {
  if (value === 0) return { min: -1, max: 1, step: 0.01 }
  const span = Math.abs(value)
  const step = span / 100 || 0.01
  return value > 0
    ? { min: 0, max: span * 2, step }
    : { min: value * 2, max: 0, step }
}

export function walkSchema(schema: Schema, path: string[] = []): WalkResult {
  const fields: Field[] = []
  const initial: Record<string, unknown> = {}

  for (const [key, raw] of Object.entries(schema)) {
    const fieldPath = [...path, key]

    if (!isObject(raw)) {
      fields.push({
        path: fieldPath,
        kind: kindOf(raw as LeafValue),
        label: key,
      })
      initial[key] = raw
      continue
    }

    if (isMonitor(raw)) {
      fields.push({
        path: fieldPath,
        kind: 'monitor',
        label: raw.label ?? key,
        interval: raw.interval ?? 250,
        monitor: raw.monitor,
      })
      initial[key] = raw.monitor()
      continue
    }

    if (isControl(raw)) {
      const kind = kindOf(raw.value)
      const range =
        kind === 'number' ? defaultRange(raw.value as number) : undefined
      fields.push({
        path: fieldPath,
        kind,
        label: raw.label ?? key,
        min: (raw as NumberDescriptor).min ?? range?.min,
        max: (raw as NumberDescriptor).max ?? range?.max,
        step: (raw as NumberDescriptor).step ?? range?.step,
      })
      initial[key] = raw.value
      continue
    }

    const nested = walkSchema(raw as Schema, fieldPath)
    fields.push(...nested.fields)
    initial[key] = nested.initial
  }

  return { fields, initial }
}

export function getPath(
  tree: Record<string, unknown>,
  path: string[],
): unknown {
  let current: unknown = tree
  for (const key of path) {
    if (!isObject(current)) return undefined
    current = current[key]
  }
  return current
}
