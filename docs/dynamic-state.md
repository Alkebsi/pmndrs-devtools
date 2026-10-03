# Dynamic shared state

The current DevTools bridge assumes a fixed control schema: `schema.ts` walks the user's `leva()` schema once, `bridge.ts` publishes that fixed `fields` array with value snapshots, and `UiNode` renders a fixed tree of controls. That is sufficient for Controls/Performance, but not for tools whose data set changes shape or length at runtime.

A future ECS inspector (for example, a Koota entity/table viewer) should add a separate dynamic-state variant instead of mutating the existing fixed-schema path.

## Possible wire shape

A shared state could look roughly like:

```ts
{
  kind: 'dynamic-list',
  id: 'entities',
  revision: 42,
  columns: [
    { id: 'id', label: 'Entity', kind: 'text' },
    { id: 'position', label: 'Position', kind: 'vec3' },
    { id: 'active', label: 'Active', kind: 'boolean' },
  ],
  rows: [
    { id: 'e17', cells: { id: 'e17', position: [1, 2, 3], active: true } },
    { id: 'e29', cells: { id: 'e29', position: [4, 5, 6], active: false } },
  ],
}
```

The important properties are a stable list/tool id, a revision, runtime-defined column metadata, stable row/entity ids, and a variable-length row collection. The update can then add/remove/reorder rows without pretending the original `Field[]` schema changed in place.

## Files that would need new variants later

### `bridge.ts`

Add a distinct dynamic shared state (or a discriminated union alongside `WireState`) and publish updates for collection changes. The existing fixed `state` wire path should remain unchanged. A future bridge could also support incremental row updates or patches if full-list snapshots become too expensive, but that should be a later optimization.

### `schema.ts`

The current `Field` type represents controls captured from the user's schema. A dynamic inspector should not overload `Field`. Add a separate serializable descriptor for a dynamic collection/table: column definitions, cell kinds, identity/key rules, and optional capabilities (for example whether a cell is editable).

### `ui.ts` (`UiNode`)

Add a new node variant such as `entity-list`/`table` that carries columns and runtime rows, rather than trying to express an arbitrary entity collection as a `stack` of fixed control nodes. The renderer can then reconcile rows by stable ids, allowing insertion/removal without rebuilding unrelated controls.

The existing fixed `Field` → `WireState` → `UiNode` path should stay intact. The dynamic variant should be introduced alongside it and used only by tools that actually need runtime-changing collections.
