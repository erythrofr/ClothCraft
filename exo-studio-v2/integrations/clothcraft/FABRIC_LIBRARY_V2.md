# V2 native fabric library

The Fabric section now applies native `Command::Fabric` transactions, not EXO's separate legacy fabric state. Select a panel in either linked viewport; selected-panel scope is default, and all-panel application is explicit. Native history, project saves and reloads carry assignments and coefficients. Custom numerical edits retain the named surface style. Unsupported legacy fabric controls are hidden in the Fabric section when using the native engine.

## Evidence and units

Nine presets mirror `research/oss/clothcraft/src/fabrics.rs` and its `docs/fabrics.md`: woven cotton, cotton/poly interlock jersey, wool, denim, nappa leather, light silk, linen, nylon ripstop, and stretch knit. Mass and thickness are specimen references, not universal fibre constants. The cited upstream evidence identifies which thickness values are estimated. Elasticity, shear, bending and visual appearance are all authored approximations, not calibrated textile models.

- Surface density: UI g/m² → native kg/m², divide by 1000.
- Thickness: UI mm → native m, divide by 1000.
- Membrane/shear coefficients: N/m, never arbitrary EXO stiffness multipliers.
- Bending: UI µN·m → native N·m, divide by one million.
- Preset extension is nominal engineering strain at 100 N/m (5 N / 50 mm), converted using the actual smooth Green-strain energy and the existing material's compression law. It is not breaking elongation or a hard stretch limit.
- Thickness does not modify OGC collision clearance; friction, plasticity and knit loops are not implemented by this library.

## Rendering and persistence

Named native presets resolve to nonmetallic physical surfaces with roughness, sheen and procedural bump structure. Bump texture repeat uses metre-based **rest UVs**, not normalized panel extents or deformed-world coordinates. Pattern grain rotates the texture. Linked selection adds emissive emphasis without replacing the fabric color. 2D panels show the same base fabric color. Unknown/custom material names use a neutral fallback. These are representative visual styles, not measured scans.

Preset names are the version-1 persistence key, using the existing native schema rather than sidecar state; keep names stable or introduce explicit migration before renaming. Numeric edits keep the surface style but no longer imply an unmodified specimen. No material JSON schema change. Both the library data and upstream preset table must be checked together when adding/changing presets.

## Checks

- `node integrations/clothcraft/check-v2-fabrics.mjs`: all nine presets, independent energy finite-difference traction check, SI units, selected-only isolation, unchanged rest/draped geometry during assignment, native save/reopen, all-panel assignment, undo/redo and finite solver steps. Uses isolated temporary projects; does not certify drape convergence.
- `node integrations/clothcraft/qa-v2-fabrics.mjs`: isolated browser/services; native tab, units, assignments, custom mass, rendered preset identities and reload.
- `npm run build`: production bundle.

No claims of CLO3D material equivalence, measured PBR, friction, or certified on-body fit.
