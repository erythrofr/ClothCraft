# EXO ClothCraft Studio V2 — execution handoff

Prepared 2026-10-17 for Mikyle. **V2 specifically**, not the older Garment Studio app or EXO community website.

## Read in order

1. [Toolbar engineering specification](01_TOOLBARS_ENGINEERING_SPEC.md): all 70 actual left/right slots; observed native/inspect/unavailable state, distinct interaction, data/native work and acceptance for every tool; shared command architecture, supplemental controls and implementation order.
2. [Garment hover visual specification](02_GARMENT_HOVER_VISUAL_SPEC.md): curved source-panel presentation, genuine geometry/assembly boundaries, controls, lifecycle, renderer budgets and reference-driven acceptance.
3. [Photorealistic fabric specification](03_PHOTOREALISTIC_FABRIC_SPEC.md): draped-ball geometry, licensed scans/procedurals, real-scale weave, physical data, UVs, shaders, studio lighting, native/material parity, offline rendering, caching and staged delivery.
4. [Implementation/validation report](04_IMPLEMENTATION_AND_VALIDATION.md): what was actually changed/tested, concurrent-edit boundary and remaining blockers.
5. [Machine-readable toolbar inventory](toolbar-inventory.json): 70 IDs; source-derived counts 19 native-backed, 7 inspection-only, 44 unavailable.

## Current implementation follow-up

Read [Execution progress and acceptance — 2026-10-17](05_EXECUTION_PROGRESS_AND_ACCEPTANCE.md)
for the coding work carried out against this handoff, exact test evidence,
updated current-state 21/7/42 toolbar capability counts and explicitly
unverified future requirements. The original dated inventory remains intact.

## Executor start

Open `/Users/mikylecouto/Chat On Steroids Workspace/exo-clothcraft-v2` on Blender Mac. Check current worktree and relevant local instructions. Preserve existing changes; this repo is being edited concurrently. Re-read current tool capability data before implementation; counts are a dated source snapshot, not a permanent guarantee.

Build incrementally using each spec's ordered work packets. Deliver tests plus visual evidence and report exactly whether source, built web assets or the installed native bundle changed. Keep unsupported tools honestly disabled/inspection-only until their native behavior is verified.

## Reference blockers

`IMG_6936` was mentioned but not attached as viewable pixels. The CLO-SET URL returned a 403/challenge to fetch. Exact visual matching is not verified. Get the reference image/screenshots; do not invent source appearance or claim reference parity.

## Scope of this delivery

Planning documents are complete for the observed V2 inventory and the stated visual direction. All 70 tool implementations and the full fabric renderer are future execution work. Small garment-preview refinements were applied/tested in source, with concurrent edits preserved; native app not rebuilt. No additional agents were launched by this task.
