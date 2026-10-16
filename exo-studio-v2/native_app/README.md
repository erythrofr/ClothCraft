# Garment Studio Native Preview

The current working native macOS application is a standalone **AppKit/SceneKit prototype**. It is not yet the proposed cross-platform Qt/C++ production application. For the migration and open-source requirements, see [PORTABILITY.md](PORTABILITY.md) and `docs/GARMENT_STUDIO_NATIVE_ROADMAP.md`.

Build on macOS with Xcode command-line tools:

```sh
bash native_app/build.sh arm64   # Apple Silicon
bash native_app/build.sh x86_64  # Intel Mac
```

The app is generated in `native_app/build/<arch>/GarmentStudioNative.app` with its own example garment data. It does not need the original repository or a network connection to open those examples. Use **Open garment JSON…** to load an existing native XPBD fixture.

The private CLO Thomas export is not redistributed in public builds. If you own a local export and have the rights to use it, put its converted OBJ at `native_app/assets/clo-thomas.obj` and build with `INCLUDE_PRIVATE_THOMAS=1` to include it **only in your private build**.

The app currently displays 2D and 3D garment panel meshes, sewing correspondence, wireframe and an exploded arrangement preview. It does not yet have the production solver, accurate Thomas mesh collision, fully editable parametric patterns or CLO3D-grade garment fitting. The cross-platform GUI is still planned.

## Native UI pass (October 2026)

The macOS prototype now includes a garment panel outliner, 2D panel selection highlighting, 3D ray-picked panel selection, show/hide selected piece, show all, garment switching, wireframe toggle, Thomas toggle, reset/fit camera, real 2D/3D seam correspondence, exploded arrangement slider, and a **Sew Preview** control. Sew Preview animates only the display arrangement; it does not invoke the XPBD solver or physically stitch the panels. The 2D editor remains an inspection canvas rather than full parametric CAD. Rendering remains SceneKit-backed, not the planned Qt renderer.

To check the current self-contained macOS build, run `bash native_app/test_bundle.sh x86_64` or `bash native_app/test_bundle.sh arm64`. Neither build requires the Blender Mac for the bundled examples.

## Full offline desktop workspace (October 13, 2026)

The default app mode now packages and opens the **complete existing Three.js / React workspace** in a WebKit desktop window, so the 3D viewer, 2D editor, garment library and inspector are present exactly as in the current web app. The complete UI is bundled from `dist/` into `Contents/Resources/web/`, and can render without the Vite server or SSH tunnel. The local owner’s Thomas model may be included in a private build only.

To produce a private Blender-Mac build:

```sh
npm run build
INCLUDE_PRIVATE_THOMAS=1 bash native_app/build.sh arm64
bash native_app/test_bundle.sh arm64
open native_app/build/arm64/GarmentStudioNative.app
```

Use **Native XPBD Preview** to switch to the separate AppKit/SceneKit engineering viewer (2D/3D geometry, sewing filters, simulated fit snapshots, native panels). Use **Full 3D + 2D Workspace** to return. The native preview is not yet a CLO3D-equivalent solver or a complete parametric CAD application; see `STATUS.md`.

## Sewing workflow in the full workspace

Open a garment from **Library > Garment**. Its flat panels begin around the avatar in 3D (front/back, sleeves or leg pieces), next to the live 2D patterns. Select **3D Move** to position a flat panel; the Pattern inspector includes `Flat X/Y/Z` staging adjustments. Go to **Sewing**, use the **Sew edges** tool to select matching edges on the 2D pieces and inspect the orange sewing correspondences in both views. Select **WALK** on any seam to isolate its matching points. The pieces remain flat during all of this. Finally press **SIMULATE** to begin draping, **PAUSE** to freeze, or **RESET** to return to the pre-sewing arrangement. The current native solver does not yet begin physically flat and sew into 3D; see `STATUS.md`.
