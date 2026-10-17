# SAMPL3D native C++ conversion checkpoint

Date: October 15, 2026. Workspace: garment-studio on Jarvis.
This is independently compiled native progress, NOT the finished Qt desktop,
not factory-certified CLO3D interchange, and not accepted avatar draping.

## C++ factory ZIP and marker PDF

Factory ZIP implementation native_cpp/core/factory_zip.cpp is part of the
C++17 build. The native CLI export-factory-zip returns a base64 ZIP32 store
archive with size construction DXFs, SVG/PDF garment markers, editable
source JSON, a graded size run, structured tech-pack JSON, POM CSV,
BOM XML, cost estimates, production preflight and a checksum manifest.
ZIP paths are validated against traversal, duplicates and collisions.

The separate export-marker-pdf CLI operation returns a valid base64
PDF 1.4 marker plot. The original PDF parity tests checked long-marker pages,
physical page size, independent PDF parsing and rendered paths.

Native CLI regression check-native-cpp-factory-cli.mjs PASS:
two real projects, 66 extracted ZIP files, 18 printable marker PDFs,
deterministic output, source immutability, and non-certification markers.
Standalone archive test PASS: 27 ZIP entries across six graded sizes with
file length/CRC checks. This is NOT yet fully identical to the 45-file
JavaScript factory package; specialized CSV tables and the printable
HTML spec remain to migrate.

## Native C++ glTF 2.0 interchange

Source: native_cpp/core/gltf_export.cpp, CLI export-flat-gltf.
Includes indexed triangulated flat panels, grainline UVs, source seam-edge
metadata, PBR roughness/metalness/opacity and linearized sRGB fabric colors.
Y-up geometry is stored in meters, with embedded geometry buffers.
Texture images themselves and advanced fabric shading are not yet embedded.

Independent GLTFLoader test PASS: two real garments, 14 panels,
406 triangles, three PBR material entries, validated binary buffer views,
deterministic output and source preservation. It explicitly returns
fitAccepted=false: no simulation or dressed avatar is implied.

## Regression summary

Command: bash native_cpp/scripts/build_and_test.sh
Result: 8 of 8 native CTest suites passed, all registered C++/JS parity tests
passed, including the new ZIP/PDF and glTF checks.
Command: npm run check:non-simulation
Result: PASS.
Command: npm run build
Result: PASS (existing Vite large-chunk advisory).

## Real conversion blockers

An explicit Qt developer SDK gate was added:
GARMENT_REQUIRE_QT=ON and native_cpp/scripts/verify_qt_desktop.sh.
Unlike the ordinary C++ core build, it fails if Qt6 Widgets SDK is absent.
The actual strict check on Jarvis correctly FAILED because Qt6Config.cmake
and the required Qt C++ developer headers remain unavailable.
No Qt desktop compile, launch, or UI feature parity was claimed.

Still missing: full native interactive desktop and 3D renderer, calibrated
23-fabric material parity, real avatar fitting/cloth draping, complete
manufacturing artifact parity, UX/accessibility, saved-project migration
and full body contact/seam/swept-CCD acceptance.

The working Swift/WebKit/React app and user garment projects were preserved.
The original ZOZO PPF solver stays Rust by design. No git commit, remote
push, or installed-app cutover was performed in this pass.
