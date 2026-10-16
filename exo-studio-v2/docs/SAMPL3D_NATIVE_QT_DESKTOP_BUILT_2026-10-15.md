# SAMPL3D Native Qt C++ desktop — compiled and launched

Date: 2026-10-15. Workspace: live Jarvis garment-studio repository.

## Verified breakthrough

The formerly missing Qt 6.8.3 macOS arm64 C++ developer SDK is now complete at
native_cpp/.qt-sdk-worker1/6.8.3/macos (about 1 GB, with Qt6Config.cmake,
Qt6WidgetsConfig.cmake, C++ headers, frameworks, tools and offscreen plugin).

An isolated CMake build of **GarmentStudioQt.app succeeded** using
native_cpp/scripts/verify_qt_desktop.sh with QT6_ROOT set to that SDK.
The Qt 6.8 FindWrapOpenGL module incorrectly linked the removed Apple AGL
framework on modern Xcode. The project CMake now filters AGL from the local
WrapOpenGL imported target while retaining OpenGL. Neither Xcode nor Qt SDK
files were patched.

The independent app is located at:
native_cpp/build-qt-verification/GarmentStudioQt.app
It is also built by the main native regression command when the local SDK is
discovered:
native_cpp/build-cmake/GarmentStudioQt.app

## Offscreen launch and visual inspection

Real application process launched with QT_QPA_PLATFORM=offscreen, loaded the
bundled sample garment, created the native Qt Widgets window, rendered the
drafting scene, and exited deliberately through its smoke-test option.

Most recent machine-readable result:
QT_NATIVE_SMOKE PASS visible=1 pieces=4 canvas=466x525
drawingItems=20 exports=1 raster=1430x900 imageSaved=1

Screenshot from visual review:
native_cpp/build-qt-verification/native-qt-mesh-smoke.png

Verified GUI elements: four garment pattern entries, 2D vector drafting
canvas, curved pattern outlines, editable point/allowance inspector,
seam relationships, size preview picker, fabric markers, and native
manufacturing export actions for DXF, OBJ, glTF 2.0, SVG, PDF, BOM and ZIP.

The bottom production panel is now a compact, dark-themed scroll area, making
the drafting space usable. A post-layout Fit 2D action fixes the earlier
tiny-pattern initial display. The staging preview now consumes cached native
C++-triangulated curved panel contours and per-fabric color/opacity rather
than only raw control-point polygons. The bundled sample has four panels,
192 flat CAD triangles. **This is a CPU-projected preview and not calibrated
PBR rendering, physics simulation, a real body collision skin or fitted drape.**

## Protection of existing projects

Original input filename is passed to MainWindow on initial CLI launch.
Save a copy and production exporters reject existing destination files,
including symlinks; JSON Save Copy uses QSaveFile atomic commit.
Open garment JSON remains read-only until the user chooses a new filename.
No installed Swift/React app was replaced. No user garment documents
were migrated, renamed or deleted.

## Repeatable build gates

Strict standalone Qt build and launch:

    QT6_ROOT="$PWD/native_cpp/.qt-sdk-worker1/6.8.3/macos" \
      bash native_cpp/scripts/verify_qt_desktop.sh

Main native build now auto-detects the isolated Qt SDK if present and executes
the same offscreen GUI smoke test after the compiled CAD/CLI regressions:

    bash native_cpp/scripts/build_and_test.sh

The latest run passed **16/16 native CTest suites** and all registered
C++/JavaScript CAD, drafting, mesh, marker PDF/SVG, factory, BOM,
POM, tech-pack and glTF compatibility tests. The Qt app compiled and
ran successfully as part of the standard check.

The original frontend also passed:

    npm run check:non-simulation
    npm run build

The Vite bundle-size advisory is not a build failure.

## Not yet a finished C++ application

1. Native Qt GUI **does not yet reproduce all tools, dialogs, material
   editing, avatar/body controls, garment library, browser 3D viewport,
   GPU shading, animation, or interactive manufacturing UX** from the
   original Swift/WebKit/React/Three.js product.
2. Native C++ manufacturing outputs pass selected semantic/parity tests,
   but factory certification, industrial cutter interoperability,
   external production partner verification and exact JavaScript ZIP
   file inventory parity have not been established.
3. The current independently assessed Thomas garment simulation fails
   full contact, strain, seam closure and swept CCD acceptance. The UI's
   Simulation button remains disabled; no fabricated successful fit.
4. ZOZO's solver stays Rust intentionally, used through a separately
   versioned C++ service bridge. A useful local product can be primarily C++
   without rewriting that specialized external solver.
5. The Qt SDK is isolated in this machine's working tree; deployment needs
   appropriate Qt runtime bundling, licensing review, code signing and
   independent macOS installations.
6. The repository contains many other uncommitted/untracked source edits,
   including native_cpp. No GitHub push, release or user-app replacement
   was performed in this checkpoint.

Bottom line: the Qt build/developer-SDK blocker is solved, and a real native
desktop process and its CAD workflows run. **Full feature conversion and
safe application cutover are still substantial engineering work.**
