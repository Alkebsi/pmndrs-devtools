# PMNDRS DevTools alpha architecture

The runtime has one responsibility: own application state and expose a tiny bridge.

```text
application
  |
  | leva()
  v
runtime store + tiny devframe client
  |
  v
Devframe transport
  |
  v
standalone DevTools UI
  |
  +-- Controls
  +-- Performance
  +-- future tools
```

The app does not render the DevTools UI. `?devtools` is a separate document, and the Vite integration mounts Devframe alongside the user's Vite server.

The current UI uses a tiny serializable view model (`UiNode`). Tools do not own DOM code. A future React/Vue renderer can consume the same model without changing the tool protocol.
