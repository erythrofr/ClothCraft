# Governance

Garment Studio is intended to support a broad contributor community while keeping the stable garment document and production behavior coherent.

## Project areas

- Core document / compatibility
- Pattern CAD
- Simulation / collision
- Blender / 3D platform
- Avatars / animation
- Materials / rendering
- Production / DXF / marker / tech pack
- AI / automation APIs
- Benchmarks / QA

Each area may develop independently behind stable interfaces.

## Branch philosophy

- `main`: releasable and regression-tested
- `next`: integration of accepted major work
- `labs/*`: experimental research backends and prototypes

## Decision levels

Small bug fixes and isolated features use normal review. Changes to the garment document, simulation protocol, public exporter behavior or dependency/licensing model require an architecture proposal before merge.

## Compatibility

Backward-compatible document migrations are preferred. A backend may add optional capabilities without forcing every other backend to implement them.

## Research code

A paper implementation can enter `labs` without becoming a product dependency. Promotion requires a license audit, deterministic fixture, measurable benchmark and maintenance owner.
