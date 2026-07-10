### Contributing to GPU-VIsualiser

All contributions are welcome, especially new GPUs and corrections to the existing data.

### Project layout

```
src/
  gpus/          one file per GPU, each exporting a Gpu object
    index.ts     registers every GPU in the gpus array
  components/    DieView (the floorplan), Sidebar, DetailPanel, Legend
  layout.ts      blk / tile / vstack / hstack helpers for placing blocks
  types.ts       Block, ComponentDoc and Gpu types
  App.tsx        wires the three panes together
```

### Adding a GPU

1. Create `src/gpus/<your-gpu>.ts` and export a `Gpu` object with its `id`, `vendor`, `name`, `die`, `arch`, `isa` and `process` fields.
2. Write a `floorplan()` function that returns a tree of `Block` nodes. Use the `blk`, `tile`, `vstack` and `hstack` helpers from `layout.ts` to place children in coordinate space. Give each block a `kind` (see the legend below) and, where it has documentation, a `doc` key.
3. Fill in `docs`, a map from each `doc` key to a `ComponentDoc`. Each entry has a `role` (what the block does), a `type`, a `specs` table, a `pipeline` note on where it sits, and an optional `programming` note. The detail panel renders these.
4. Mark any harvested or fused units with `disabled: true` so they render hatched.
5. Register the GPU in `src/gpus/index.ts` by importing it and adding it to the `gpus` array.
6. Run `npm run dev` to check the layout, then `npm run build` to confirm it type-checks.

### Block kinds

Blocks are coloured by `kind`, and the legend in the app reflects this:

| `kind` | Used for |
| --- | --- |
| `compute` | SMs, CUs, Xe-cores and other execution units |
| `cache` | L1, L2, Infinity Cache and similar |
| `memctl` | memory controllers and PHYs |
| `interconnect` | NVLink, Infinity Fabric, PCIe |
| `frontend` | command processors, schedulers, rasterizers |
| `media` | video codecs, display engines |
| `group` | invisible containers used only for layout |
| `die` | the outermost block |
