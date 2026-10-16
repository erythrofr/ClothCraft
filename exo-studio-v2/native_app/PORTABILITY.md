# Garment Studio: open-source, cross-platform delivery

## Current state (2026-10-12)

- **macOS only:** the working `native_app/GarmentStudioNative.swift` is an AppKit/SceneKit native preview, *not* a cross-platform GUI. Its new app bundles contain the four sample XPBD garment fixtures. They work without a development checkout or a network tunnel.
- `bash native_app/build.sh arm64` creates an Apple Silicon app; `INCLUDE_PRIVATE_THOMAS=1 bash native_app/build.sh x86_64` creates a local Intel build with the privately exported Thomas OBJ. A public build omits the CLO-derived asset. Do not distribute Thomas without verifying CLO licensing and rights.
- The core physics C++ code is in `native_backend/src`, but its existing executable, service adapter, and the UI are not yet integrated as a shared, installable platform-independent engine.
- No Windows/Linux application has been compiled or tested. Do not advertise universal compatibility until native builds and CI pass on those operating systems.

## Proposed stable product architecture

```
                     Garment Studio document (.garment.json)
                                |
                  portable CAD / sewing graph / solver API
                                |
                     C++20 core library (headless)
                                |
             Qt 6 UI + 2D CAD editor + 3D rendering layer
                 /                |                \
             macOS              Windows            Linux
       Metal via QRhi        D3D/Vulkan          Vulkan/OpenGL
                                |
                   optional Blender bridge and server
```

The **project file** is the source of truth, never a GLB, Blender scene or proprietary CLO file. Define a versioned schema with stable piece IDs, curve segments, seams, notches, grainlines, measurements, fabric parameters, avatar references, pre-sew transforms, garment state, and provenance. The solver must accept an immutable project snapshot and return a revision-tagged simulation result. Rendering must not alter physics particles. All paths should be document-relative or bundled-resource-relative, not developer-home-directory paths.

## Portability acceptance gates

1. **No external network required:** opening and editing built-in example garments, moving panels, and showing sewing correspondence must work with Wi-Fi disabled. Thomas is optional and user-supplied. No SSH or browser server for normal operation.
2. **Build matrix:** GitHub Actions for macOS arm64/x86_64, Windows x64, Linux x86_64. Compile and test the C++ core on all three; build the Qt UI only once its portable replacement is implemented. Include checksum and package metadata per artifact.
3. **Deterministic core:** seam pair correspondence, curve geometry, triangulation, collision broadphase, and solver snapshots tested with identical fixtures. Compare output numerically within documented platform tolerances.
4. **Installers:** signed/notarized DMG on macOS, MSIX or signed Windows installer, and AppImage/Flatpak on Linux. Make first-run assets local; avoid absolute user paths.
5. **User workflows:** 2D editing, 3D fitting, sewing selection/preview, avatar loading, simulation pause/resume, saving/reopening, export, undo/redo, error recovery. Measure real FPS, seam residual, strain, collision penetration and memory per OS.
6. **Accessibility and controls:** native menu commands, keyboard shortcuts, trackpad/mouse/tablet behavior, high DPI scaling, colorblind-safe sewing indications, and recoverable autosave.

## Open-source release requirements

- **License selected: GPL-3.0-only.** The repository now contains a root `LICENSE`; public distribution still requires ownership, third-party, proprietary-asset, history and notice clearance. A contributor license cannot be inferred.
- Create `THIRD_PARTY_NOTICES.md`, SPDX identifiers, SBOM, source archives, reproducible release tags, security policy, CI and a public issue tracker. Review Qt LGPL/commercial requirements, CGAL module licenses, third-party physics libraries and the Blender bridge separately.
- Exclude all CLO exports, third-party clothing meshes, proprietary avatar textures, personal files, generated private artifacts, keys, local paths and credentials from the public repository. User-owned CLO data can be imported locally under the user's rights; it must not be shipped as a public example.
- Avoid hard dependencies on CLO, Adobe, a particular Mac, a proprietary GPU, or a hosted service. Integration connectors should be optional modules with graceful offline fallback.

## Migration order

1. Keep shipping/test the standalone native macOS preview and fix fixture/asset portability first (**done for sample fixtures**).
2. Extract project model, sewing graph, geometry and XPBD into an independent C++ library with a stable C ABI and headless tests; replace Swift's JSON parsing with that library.
3. Implement the Qt 6 desktop shell and two synchronized editors on macOS; connect the same core. Retain Swift preview as reference only.
4. Enable and validate Windows/Linux Qt builds and platform-specific graphics backends; establish CI and offline installers.
5. Integrate accurate posed Thomas mesh collision, improved cloth materials and sewing animation, with licensing-safe import paths and cross-platform numerical tests.

The portability goal is to be **installable like Blender**, but garment physics parity with CLO3D is a separate, substantial research and validation effort.

## UI regression acceptance checklist

- [x] AppKit app builds for Intel and Apple Silicon macOS with local fixtures
- [x] Standalone Intel app deployed and process verified on Jarvis
- [x] 3D panel outliner, visibility, selection, camera, seam guides and arrangement controls implemented
- [x] 2D pattern preview, panel selection and seam links implemented
- [x] CLO Thomas local OBJ bundled in private Jarvis build
- [ ] Automated end-to-end native GUI interaction tests and pixel-level rendering review
- [ ] Qt cross-platform GUI builds on Windows and Linux
- [ ] Editable, manufacturing-accurate 2D CAD geometry
- [ ] Live C++ XPBD cloth simulation and posed Thomas body mesh collision
- [ ] Physical sewing animation with seam ramp and contact convergence
- [ ] Verified CLO3D visual and physical parity on matched reference garments

### October 13, 2026 offline-workspace milestone

The existing full Three.js/React UI is now packaged in a standalone macOS WebKit shell. This removes the Vite and SSH-tunnel requirement for basic desktop viewing and editing; it does **not** complete the cross-platform Qt rewrite. The bundled C++ XPBD output snapshots are valid finite frame endpoints for inspection only, with high strain and no Thomas mesh collision. Public release builds must omit private CLO Thomas assets. The license/re-distribution audit remains a prerequisite for describing a published release as open source.
