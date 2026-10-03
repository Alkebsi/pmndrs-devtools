# Tools

The alpha uses `tools/controls` and `tools/performance` rather than `tool-controls`.

A tool is a small framework-free module that consumes the DevTools connection and returns a serializable `UiNode` model plus actions. The standalone UI owns DOM rendering. A future React/Vue/Svelte renderer can consume the same `UiNode` model without changing the tool.
