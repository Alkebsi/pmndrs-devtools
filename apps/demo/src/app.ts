import { leva } from '@pmndrs/devtools'

const controls = leva({
  Settings: {
    width: { value: 120, min: 40, max: 240, step: 10 },
    height: { value: 120, min: 40, max: 240, step: 10 },
    color: '#ff4f87',
    enabled: true,
  },
})

const box = document.querySelector<HTMLElement>('#box')!

function render() {
  box.style.width = `${controls.Settings.width}px`
  box.style.height = `${controls.Settings.height}px`
  box.style.background = controls.Settings.color
  box.style.border = `3px solid ${controls.Settings.color}`
  box.style.opacity = controls.Settings.enabled ? '1' : '.25'
}

controls.onChange(render)
render()
