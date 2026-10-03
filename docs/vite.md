# Vite integration

`@pmndrs/devtools-vite` is the Node/Vite integration. It owns the Devframe bridge;
applications do not import `devframe` and do not need a `server.mjs`.

Local development:

```bash
pnpm dev
```

Remote LAN development:

```bash
pnpm dev:remote
```

Remote mode starts Vite on the LAN and binds the Devframe sidecar to `0.0.0.0`.
Devframe authentication stays enabled in remote mode. A new browser/device may need the
one-time code shown by the Devframe bridge in the terminal.

The bridge is mounted below `/__pmndrs-devtools/`, so `/app.html` and the rest of the
Vite application routes remain owned by Vite.
