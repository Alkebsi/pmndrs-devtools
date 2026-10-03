import type { DevtoolsConnection } from '@pmndrs/devtools/client'
import type { UiNode } from '@pmndrs/devtools'

export interface ControlsTool {
  id: 'controls'
  title: 'Controls'
  render: () => UiNode
  action: (name: string, payload: unknown) => void
}

function valueAt(root: Record<string, unknown>, path: string[]) {
  let node: unknown = root
  for (const key of path) {
    if (typeof node !== 'object' || node === null) return undefined
    node = (node as Record<string, unknown>)[key]
  }
  return node
}

export function controlsTool(connection: DevtoolsConnection): ControlsTool {
  return {
    id: 'controls',
    title: 'Controls',
    render() {
      const groups = new Map<string, UiNode[]>()
      for (const field of connection.fields) {
        if (field.kind === 'monitor') continue
        const group = field.path.length > 1 ? field.path[0]! : 'Controls'
        const list = groups.get(group) ?? []
        const value = valueAt(connection.values, field.path)
        if (field.kind === 'number')
          list.push({
            type: 'number',
            id: `control:${field.path.join('.')}`,
            path: field.path.join('.'),
            label: field.label,
            value: Number(value),
            min: field.min ?? 0,
            max: field.max ?? 1,
            step: field.step ?? 0.01,
          })
        else if (field.kind === 'boolean')
          list.push({
            type: 'boolean',
            id: `control:${field.path.join('.')}`,
            path: field.path.join('.'),
            label: field.label,
            value: Boolean(value),
          })
        else if (field.kind === 'color')
          list.push({
            type: 'color',
            id: `control:${field.path.join('.')}`,
            path: field.path.join('.'),
            label: field.label,
            value: String(value),
          })
        else
          list.push({
            type: 'text',
            text: `${field.label}: ${String(value ?? '')}`,
          })
        groups.set(group, list)
      }
      return {
        type: 'stack',
        children: [...groups.entries()].map(([title, children]) => ({
          type: 'stack',
          children: [
            { type: 'text', text: title, tone: 'muted' },
            { type: 'stack', children },
          ],
        })),
      }
    },
    action(name, payload) {
      if (name.startsWith('set:'))
        connection.set(name.slice(4).split('.'), payload)
    },
  }
}
