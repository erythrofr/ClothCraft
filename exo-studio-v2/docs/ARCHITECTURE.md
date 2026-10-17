# Architecture

The detailed October 13, 2026 implementation and numerical-safety audit is in
[`ARCHITECTURE_AUDIT_CLOTH_SIMULATION_2026-10-13.md`](./ARCHITECTURE_AUDIT_CLOTH_SIMULATION_2026-10-13.md).
It distinguishes solver regression-test success from the unresolved physical
fit-acceptance criteria and tracks the extracted solver modules.

## Principle

The garment document is the product. Solvers, renderers and editors are replaceable views/processors of that document.

## Canonical layers

### Garment document

Owns pattern points/curves, seams, allowances, internal lines, grading, trims, fabrics, avatar references, POMs, marker settings and production metadata.

### Pattern engine

The existing JavaScript CAD layer remains directly editable. GarmentCode/PyGarment is bridged through `src/core/garmentCode.js` for parametric garment generation and interchange.

Seamly2D is the preferred mature external parametric drafting backend. Its `.sm2d`, `.smis` and `.smms` documents should be adapted into the Garment Studio canonical graph while preserving construction history, formulas and measurement dependencies rather than flattening everything into polygons. Because Seamly2D is GPL-3.0+, it stays behind an external-process/file bridge unless Garment Studio's final licensing strategy explicitly allows deeper GPL integration.

### Simulation backend API

`src/core/backends/` defines a backend-neutral request and registry. The browser PBD implementation and native PositionBasedDynamics XPBD service provide the interactive fitting path.

ZOZO/ST-Tech PPF Contact Solver is the preferred high-fidelity contact/FEM path. It is Apache-2.0 and supports Apple Silicon Metal as well as CUDA, ROCm and CPU backends. It should remain a separate backend rather than replacing XPBD: XPBD targets low-latency garment editing and fitting, while PPF targets slower final drape/contact validation where robust penetration-free contact and calibrated FEM materials matter more than frame rate. XRTailor and learned backends remain optional specialized alternatives behind the same document-level contract.

### 3D platform

The current web viewport remains useful for rapid iteration. Blender is the target native 3D platform for mature scene management, avatars/rigging, animation, Eevee/Cycles, UVs/materials and broad format interoperability.

The first detailed avatar asset path uses the CC0 MakeHuman base mesh for visualization, with the existing measurement-driven analytic body retained as the collision proxy. The next avatar milestone is to map Garment Studio body measurements to MakeHuman/MPFB morph targets and then graduate from analytic collision to optional detailed body-mesh collision.

### Production engine

DXF, markers, POMs, grading, tech packs and factory packages remain Garment Studio-owned so production data does not depend on a renderer or simulation engine.

## Dependency direction

UI -> garment document -> adapters/backends

A backend must not import application UI code. Production exporters must not require a particular simulation backend. Research backends should live behind an adapter until proven stable.


## PPF Metal refinement backend

### Measured Apple Silicon integration status

The isolated PPF bridge has been exercised against the bundled macOS arm64 runtime on an Apple M1 Pro. The runtime reports the Metal backend correctly and accepts Garment Studio shell meshes, loose stitch edges and the generated avatar collision proxy through Blender.

PPF rejects self-intersecting initial shell geometry by design. Garment Studio therefore prepares a dedicated, zero-self-intersection sewing pose before the final solve. The first conservative tee staging had roughly 0.58 m average stitch distance and produced a pathological first advance around 45.7 s. An optimized body-safe staging (`torsoDepth=0.16 m`, `armOffset=0.48 m`) keeps zero non-adjacent shell intersections while reducing mean stitch distance to about 0.294 m; measured advances then entered the sub-second to low-single-digit-second range for much of the solve while maintaining hundreds of active contacts.

PPF is therefore treated as a **final contact/FEM refinement backend**, not the interactive editor solver. Interactive dressing stays on Browser PBD / Native XPBD. A production PPF handoff must run in isolation because the macOS runtime can adopt another already-running local solver process. The optional `npm run check:ppf-metal` regression refuses concurrent PPF sessions and requires at least 4 GiB free before launching.

The PPF runtime declares the ZOZO solver Apache-2.0, but its bundled `THIRD_PARTY_LICENSES.txt` explicitly says transitive Python/Rust dependency enumeration is incomplete. Keep the runtime in ignored `research/ppf-local/` until that third-party license audit is complete.
