import type { DevtoolsConnection, UiNode } from '@pmndrs/devtools'

export interface PerformanceTool {
  id: 'performance'
  title: 'Performance'
  render: () => UiNode
  action: (name: string, payload: unknown) => void
}

export function performanceTool(
  connection: DevtoolsConnection,
): PerformanceTool {
  return {
    id: 'performance',
    title: 'Performance',
    render() {
      const fps = connection.metrics.fps
      return {
        type: 'stack',
        children: [
          {
            type: 'metric',
            id: 'performance:fps',
            label: 'FPS',
            value: fps > 0 ? String(fps) : '—',
            detail:
              fps > 0
                ? 'measured in the app while this tool is open'
                : 'starting…',
          },
          {
            type: 'text',
            text: 'Only the tiny sampler runs in the app while Performance is active.',
            tone: 'muted',
          },
        ],
      }
    },
    action() {},
  }
}
