# Contributing to EXO Sample 3D

EXO Sample 3D welcomes engineering, research, patternmaking, apparel-production, design and documentation contributions.

## Before opening a pull request

1. Do not copy proprietary CLO, Browzwear or other commercial source code, assets, UI artwork or undocumented file-format material.
2. Check the license of every dependency, checkpoint, body model, dataset and sample asset you introduce.
3. Keep the canonical garment document independent of any one solver or renderer.
4. Add regression coverage for any garment behavior you change.
5. Prefer small, measurable changes over large unreviewable rewrites.

## Development

```bash
npm install
npm run dev
npm run build
npm run check
```

Useful focused tests:

```bash
npm run check:physics
npm run check:foundations
npm run check:production
npm run check:garmentcode
npm run check:backend
npm run check:native-xpbd
```

## Architecture rules

### Canonical document first

Pattern geometry, seams, fabrics, grading, trims, measurements and production metadata belong in the EXO Sample 3D document model. A simulation backend may cache derived topology, but it must not become the only place the garment exists.

### Backends are replaceable

A new solver should implement the backend contract documented in `docs/BACKEND_API.md`. Do not couple UI components directly to CUDA, Metal, Warp, Blender, XRTailor or a specific native engine.

### Preserve production semantics

A faster simulation is not an acceptable change if it silently loses notches, seam direction, allowances, grading, layer relationships or factory metadata.

### Tests need garments

When fixing a garment-specific failure, add the smallest garment/regression that reproduces it. Good metrics include seam gap, non-finite state, penetration, strain, deterministic topology, output validity and runtime.

## Pull requests

Describe:

- the problem being solved
- the subsystem changed
- before/after behavior
- exact test commands run
- performance changes
- any new dependency and its license
- screenshots only when visual output matters

Physics changes should include numeric metrics, not only visual claims.

## Research integrations

Research repos belong under ignored `research/oss/` during evaluation. Promote code into a shipping dependency only after license, platform, maintenance and benchmark review.

## Contribution licensing

The project has selected **GPL-3.0-only** for original source. By contributing, you must have the right to submit your changes under GPL-3.0-only, with any required third-party attribution. A formal contribution attestation (DCO or CLA) and maintainer approval process remain to be finalized before accepting public contributions. See `LICENSE` and `docs/LICENSING.md`.
