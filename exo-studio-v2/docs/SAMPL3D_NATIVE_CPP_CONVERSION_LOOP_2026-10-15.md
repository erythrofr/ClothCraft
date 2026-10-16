# SAMPL3D - native C++ conversion checkpoint

Date: 2026-10-15. Live repository: garment-studio.
This records verified implementation progress, NOT a complete native Qt
application, nor 90% CLO3D feature parity.

## Newly compiled C++ functionality

### Manufacturing construction DXF

Native files: native_cpp/core/construction_dxf.hpp and .cpp.
Native CLI operation: export-construction-dxf.
Preserves DXF R12 millimetre semantics and exports sampled garment outlines,
allowance geometry, explicit/sewn notches, grainlines, labels, buttonholes,
darts, pleats and internal construction lines. The original lightweight
export-dxf operation is unchanged.

Regression: scripts/check-native-cpp-construction-dxf.mjs against browser
JavaScript projectToDxf, using real T-shirt and hoodie fixtures. Four fixtures,
1,236 compared pattern vertices, 209 notches, 14 internal construction lines,
one buttonhole, matching entity counts, deterministic output, no source edits,
and rejection of newline DXF comment injection. PASS.

Not yet certified AAMA/ASTM or industrial cutter output.

### Native pattern meshing

Native files: native_cpp/core/pattern_mesh.hpp and .cpp.
Native CLI operation: mesh-project. Native CTest: native_pattern_mesh.
Concave triangulation, sampled quadratic pattern edges, seam edge mapping,
fabric-grain UV coordinates, four subdivision levels and bounds on expensive
mesh generation. Project grainAngleDeg now controls grain orientation.
Independent JS triangulation comparison: 10 base triangles, 40 refined
native triangles with matching area and source coordinates. PASS.

This is **flat rest geometry**, not physically sewn, simulated or fitted.

### Native OBJ interchange

Native files: native_cpp/core/obj_export.hpp and .cpp.
Native CLI operation: export-flat-obj. Converts native pattern rest meshes
into independent OBJ objects, UV coordinates, fabric-material names, and
seam-edge comments. Explicit centimeter units, XY coordinates and Z=0.

The independent Three.js OBJLoader successfully loaded output from two real
garment projects: 14 panels, 406 triangles, 1,218 UV entries. Deterministic
output, proper group metadata, source immutability, fitAccepted=false and
rejection of excessive subdivision passed in check-native-cpp-flat-obj.mjs.

## Additional C++ modules in passing suite

Canonical CAD document/undo; DXF import, grading, cutline sampling, marker
nests and size runs; native marker SVG; production preflight; material
consumption, costing and XML BOM; measurements/points of measure; ClothCraft
interchange; and guarded integration with existing Rust-first ZOZO PPF.

## Reproducible validation

Command: bash native_cpp/scripts/build_and_test.sh
Result: 5/5 native CTest suites passed, all registered native-vs-JavaScript
regressions passed including construction DXF and rest mesh OBJ.
Also passed: npm run check:non-simulation and npm run build.
The Vite bundle-size warning is nonfatal.

An intentionally historical failed Thomas PPF run remains correctly rejected
for cloth/body contact, seam and swept CCD evidence; that is NOT successful
physical fitting.

## Remaining conversion blockers and project protection

1. The shipping macOS workspace is Swift/AppKit + WebKit + React + Three.js.
   The compiled C++ engine is additive and not yet the active full desktop.
2. Qt Widgets desktop C++ source exists, but Qt6Config.cmake and matching
   developer headers have not been obtained. Qt 6.8.3 official arm64 SDK
   package metadata was verified but developer archive downloads stalled.
   No compiled Qt desktop or actual interactive smoke test is claimed.
3. Native 3D viewport, 23 fabric presets and calibrated materials, avatar
   animation, CAD history, full factory imports/exports, and actual
   sewn-body-simulation acceptance remain open or JavaScript owned.
4. The ZOZO fabric/contact solver intentionally remains in Rust; its
   native boundary must prove full trajectory contact and CCD before fitting
   can be designated accepted.
5. Saved user garment projects and installed Swift/React app remain untouched;
   no destructive migration, replacement, git commit or remote push occurred.
   The repository has extensive existing uncommitted work.

## Next acceptance gate

Acquire official appropriately licensed Qt6 C++ developer SDK, then configure
an independent native Qt build with python3 -m cmake. Compile and launch Qt
2D drafting, undo, Save As, stitch inspection and native production commands,
add native 3D viewport and texture shading, and verify saved-document
roundtrips and real garment simulation before replacing the installed app.
