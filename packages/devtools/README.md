# @pmndrs/devtools

The small app-side runtime for PMNDRS DevTools.

```ts
import { leva } from '@pmndrs/devtools'

const controls = leva({
  width: { value: 10, min: 10, max: 160, step: 10 },
  height: { value: 10, min: 10, max: 160, step: 10 },
  color: '#ff0000',
})

controls.width = 80
controls.watch('width', (value) => console.log(value))
```

The runtime owns values and a tiny transport bridge. It does not render the DevTools UI.
