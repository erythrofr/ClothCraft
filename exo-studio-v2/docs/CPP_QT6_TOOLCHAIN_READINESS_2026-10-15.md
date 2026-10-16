# Qt6 C++ desktop build readiness — 2026-10-15

Scope: read-only inspection of the live Mac and `native_cpp` project. No package installation, app changes, or Qt compilation was performed.

## Observed environment

| Check | Evidence | Consequence |
| --- | --- | --- |
| Apple developer toolchain | `xcode-select -p` reports `/Applications/Xcode.app/Contents/Developer`; `clang++ --version` reports Apple clang 21.0.0 targeting `arm64-apple-darwin27.0.0`; `xcrun --show-sdk-path` resolves macOS SDK | C++17 compiler and SDK available |
| Make | `/usr/bin/make` exists | Unix Makefiles backend available |
| CMake | `cmake --version` returned `command not found` in this command environment; `native_cpp/.qt-toolchain/bin/cmake` and `/Applications/CMake.app` absent | This shell cannot configure a new CMake build without a CMake binary; `native_cpp/build-cmake` holds older generated CMake files |
| Ninja | `command -v ninja` and `.qt-toolchain/bin/ninja` did not resolve | Optional; Make is present |
| Homebrew | `/opt/homebrew` absent; `brew` not in PATH | No confirmed Homebrew-based Qt installation |
| Qt C++ SDK | Search under `.qt-python`, `.qt-toolchain`, `/opt/homebrew`, `/usr/local`, `/Library/Frameworks` found no `Qt6Config.cmake`; `.qt-python/PySide6/Qt/include` absent; no `qglobal.h` or `QApplication` C++ header found | Native Qt Widgets target cannot be configured here |
| Qt runtime | `.qt-python/PySide6/Qt/lib/QtWidgets.framework` and `QtCore.framework` exist, but framework enumeration showed binaries/resources rather than developer headers | Python wheel runtime is insufficient for C++ compilation |
| New `.qt-toolchain` | Contains Python virtualenv `pip` and Python symlinks, no CMake/Ninja or Qt SDK | Fresh environment is not a working native Qt toolchain |
| Existing CMake cache | `native_cpp/build-cmake/CMakeCache.txt` has `Qt6_DIR:PATH=Qt6_DIR-NOTFOUND`; existing `garment_cad_cli` executable | Older C++ CAD-only build exists; this does not prove Qt GUI built |

## Configuration specifics

`native_cpp/CMakeLists.txt` declares a C++17 CAD core, CURL-based PPF service, CLI, and native tests. With `GARMENT_BUILD_QT=ON` (default), it calls `find_package(Qt6 6.4 COMPONENTS Widgets QUIET)`. Only when `Qt6_FOUND` is true does it create the `GarmentStudioQt` macOS bundle; otherwise CMake silently skips that target with a status line. A successful CAD-only build is therefore **not** evidence of a compiled native GUI.

## Safe next installation and proof procedure

1. Use an official Qt macOS **arm64** C++ developer SDK for Qt 6.4 or newer, preferably in a private versioned Qt directory rather than mixing headers from one release with PySide framework binaries of another. It must provide `lib/cmake/Qt6/Qt6Config.cmake`, `lib/cmake/Qt6Widgets/Qt6WidgetsConfig.cmake`, Qt Core/Gui/Widgets headers, and matching framework binaries. Review Qt licensing/deployment terms before distribution.
2. Install/locate a standalone recent CMake (3.20+) binary. An isolated CMake installation is sufficient; Homebrew is optional. Avoid altering system paths or the currently working Swift/React app.
3. Confirm SDK identity via `test -f "$QT6_ROOT/lib/cmake/Qt6/Qt6Config.cmake"`, `test -f "$QT6_ROOT/lib/cmake/Qt6Widgets/Qt6WidgetsConfig.cmake"`, and `find "$QT6_ROOT" -name qglobal.h -print -quit`. Inspect `file`/`lipo -info` for arm64 Qt frameworks.
4. From repository root, configure a **new** independent output directory: `"$CMAKE_BIN" -S native_cpp -B native_cpp/build-qt6-verification -DCMAKE_PREFIX_PATH="$QT6_ROOT" -DGARMENT_BUILD_QT=ON -DCMAKE_BUILD_TYPE=Debug`.
5. Verify `"$CMAKE_BIN" --build native_cpp/build-qt6-verification --target GarmentStudioQt --parallel 2` exits zero; build native tests, then run `ctest --test-dir native_cpp/build-qt6-verification --output-on-failure`. A missing GUI target is a failed Qt acceptance check even if core tests pass.
6. Validate `.app` dependencies using `otool -L`, check effective framework resolution, launch the independent bundle on the logged-in Mac, confirm editing/Save As/undo and staging labeling, and record a screenshot. Packaging, signing, and runtime Qt deployment require separate verification.

## Current acceptance result

**BLOCKED: Qt6 C++ developer SDK and a currently callable CMake executable are missing.** The compiler, macOS SDK, and Make exist. No non-destructive new Qt CMake build was attempted because Qt headers/config files are absent. No native application was installed or replaced.
