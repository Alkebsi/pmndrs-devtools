export interface FpsMonitorDescriptor {
  monitor: () => number
  interval: number
  label: string
}

export function fpsMonitor(interval = 250): FpsMonitorDescriptor {
  let frames = 0
  let fps = 0
  let started = false
  let start = 0

  const tick = () => {
    frames++
    const now = performance.now()
    if (start === 0) start = now
    if (now - start >= 1000) {
      fps = Math.round((frames * 1000) / (now - start))
      frames = 0
      start = now
    }
    requestAnimationFrame(tick)
  }

  return {
    monitor() {
      if (!started) {
        started = true
        requestAnimationFrame(tick)
      }
      return fps
    },
    interval,
    label: 'fps',
  }
}
