# PMNDRS DevTools 0.0.1-alpha

The first working vertical slice of PMNDRS DevTools: a small, vanilla-first control layer and a DevTools surface built around Devframe.

## Basic usage

Install the package and create controls from your application:

```ts
import { leva } from '@pmndrs/devtools'

const controls = leva({
  Settings: {
    width: { value: 120, min: 40, max: 240, step: 10 },
    height: { value: 120, min: 40, max: 240, step: 10 },
    color: '#ff4f87',
    enabled: true,
  },
})
```

The values remain owned by the application:

```ts
controls.Settings.width = 160

controls.Settings.enabled = false

controls.watch('Settings.width', (value) => {
  console.log(value)
})
```

The control object also provides:

```ts
controls.get()
controls.set('Settings.width', 160)
controls.onChange((change) => {})
controls.dispose()
```

Nested objects become control groups. The current supported control types are numbers, booleans, colors, strings, and monitor values.

## DevTools surfaces

The DevTools UI is separate from the application.

```text
/app.html
```

Runs the application normally.

```text
/app.html?debug
```

Runs the application and overlays the DevTools UI in the same page. This is the convenient local debugging mode.

```text
/app.html?devtools
```

Opens the standalone DevTools surface without loading the application UI into that document.

The application itself does not inspect these query parameters or import the DevTools UI. The Vite integration handles the different surfaces.

## Running the demo

Install dependencies and build:

```bash
pnpm install && pnpm build
```

Start normal local development:

```bash
pnpm dev
```

Then open the URLs printed by Vite.

The demo index page also provides links to:

* the normal app
* debug mode
* the standalone DevTools surface

## Remote development

Start the LAN-enabled development server:

```bash
pnpm dev:remote
```

Vite is exposed on the LAN and the Devframe sidecar is bound to `0.0.0.0`.

For example:

```text
Phone:
http://<LAN-IP>:5173/app.html

Laptop:
http://<LAN-IP>:5173/app.html?devtools
```

The phone runs the application while the laptop runs the DevTools surface.

Remote mode keeps Devframe authentication enabled. Local mode does not require the authentication flow.

The application still only needs:

```ts
import { leva } from '@pmndrs/devtools'
```

There is no `server.mjs` and the application does not import `devframe` directly.

## Tools

The current DevTools surface includes:

### Controls

Displays the controls created through `leva()` and allows values to be edited from the DevTools surface.

### Performance

Provides an FPS view. The sampler is activated while the Performance tool is being used rather than running continuously in the background.

Both tools are implemented as framework-independent modules that produce a small serializable UI model. The current renderer is vanilla DOM, but the tool data is intentionally kept separate from the view.

## Adding controls

Controls are defined as part of the schema passed to `leva()`.

Numbers can provide range information:

```ts
{
  speed: {
    value: 1,
    min: 0,
    max: 5,
    step: 0.1,
  },
}
```

Booleans:

```ts
{
  enabled: true,
}
```

Colors:

```ts
{
  color: '#ff4f87',
}
```

Groups are just nested objects:

```ts
{
  Camera: {
    distance: { value: 10, min: 1, max: 50 },
    enabled: true,
  },
}
```

## FPS monitor (WIP)

The runtime also exposes an FPS monitor descriptor:

```ts
import { fpsMonitor, leva } from '@pmndrs/devtools'

const controls = leva({
  Performance: {
    fps: fpsMonitor(),
  },
})
```

Monitor fields are treated as metrics by DevTools rather than editable controls.
