# PMNDRS DevTools 0.0.1-alpha

This is the first real vertical slice of the PMNDRS DevTools ecosystem.

```ts
import { leva } from '@pmndrs/devtools'

const controls = leva({
  width: { value: 10, min: 10, max: 160, step: 10 },
  height: { value: 10, min: 10, max: 160, step: 10 },
  color: '#ff0000',
})
```

The app owns the values. The DevTools UI lives in another document.

- `/app.html` is the application.
- `/app.html?devtools` is the standalone DevTools surface.
- Vite hosts the Devframe bridge. No `server.mjs` is required.
- `pnpm dev` is local development.
- `pnpm dev:remote` exposes Vite on the LAN for phone ↔ laptop use.

The first two tools are `controls` and `performance`. They are framework-free tool modules built around a small serializable UI model, so the same tool data can later be rendered by vanilla, React, Vue, or another frontend.

For the remote demo, open the LAN URL printed by Vite on the phone, and the same LAN origin with `?devtools` on the laptop.

The Vite bridge currently disables Devframe auth for frictionless local-network development. This is for development only.

Remote mode is intentionally different from local mode: the Devframe sidecar is bound to
0.0.0.0 and its authentication gate remains enabled. The app still uses only `leva()`.

## Query modes

The demo app entry contains no DevTools URL logic. `?debug` and `?devtools` are owned by `@pmndrs/devtools-vite` through Vite's HTML transform:

- `/app.html` runs the normal app.
- `/app.html?debug` runs the app and mounts inline Controls on top.
- `/app.html?devtools` serves the DevTools UI without loading the app.

The app does not import `@pmndrs/devtools-ui` or inspect the URL.
