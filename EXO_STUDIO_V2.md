# EXO ClothCraft Studio V2 — full source in the ClothCraft fork

## October 17, 2026 update submitted for review

The separate `contribution/exo-studio-v2-updates-20261017` branch brings the
EXO Studio V2 snapshot forward to the current source from
[`mikristian/exo-sample-3d`](https://github.com/mikristian/exo-sample-3d/tree/feature/studio-v2-clo-visuals)
(`a3d3b16`). This includes the current 2D/3D garment and fabric previews,
Object Browser contextual property editors for draft buttons, buttonholes,
zippers, topstitches and puckering, toolbar dispatch/capability reporting,
hardware and stage scene assets, and the Graphic panel's editable **Nike swoosh
SVG demonstration**. The Nike logo is a third-party trademark used only to
show placement; it is not endorsed or authorized commercial Nike merchandise.

The original ClothCraft Rust desktop app, solver, root manifest and previous
upstream pattern-marking PR remain separate. No CLO3D parity or physical hardware,
zipper contact or puckering physics is claimed. Only committed source and
necessary preview/example assets from the EXO feature branch were synchronized;
machine-local data and the proprietary Thomas avatar were excluded. This is a
large **optional, separate application** to review and potentially split, not a
replacement for upstream ClothCraft's existing editor. Previously bundled
generated screenshots/build artifacts in this historical branch are evidence,
not new functionality and should be pruned by maintainers before integration.

This branch is an **additive full-source snapshot** of the user's current EXO ClothCraft Studio V2 work, rather than just the smaller JSON-lines Rust session adapter contribution. The original `erythrofr/ClothCraft` Rust application remains in the root of this fork; `exo-studio-v2/` is a separate first-party React/Three.js application and native-service workspace. This deliberately avoids silently replacing upstream ClothCraft's editor, physics, tests, files and history.

## What is included

- Complete original EXO application entry point, navigation, custom CLO-style multi-pane CAD UI, 2D drafting, garments, avatars (other than Thomas), fabric editor, property editor, contextual toolbars, simulation controls, fit and production tools, and 3D scene/viewport code: `exo-studio-v2/src/`.
- Source for native C++ / Qt, Rust integration, PPF, 2D/3D geometry, the Blender bridge and macOS AppKit/WebKit shell: `exo-studio-v2/native_cpp/`, `native_backend/`, `ppf_backend/`, `blender_bridge/`, `native_app/`, `integrations/clothcraft/`.
- The full 400-preset EXO materials catalog, photoreference registries, documented CC0 Poly Haven/ambientCG textures, wash experiments, engineering evidence, scripts and available tests: `exo-studio-v2/public/`, `src/data/`, `src/core/`, `scripts/`, `docs/`.
- Community and marketplace prototype (including the latest local V4 modules, home imagery, Explore, Forum, creator profiles, pattern/material visualization and QA): `exo-studio-v2/concepts/exo-community-ui/`.
- Other tracked application project source, accepted public preview/screenshots and the recorded V16 showcase film as a full snapshot. EXO's `LICENSE` is **GPL-3.0**; it remains attached to the nested project. ClothCraft's root `LICENSE` remains **MIT**. Third-party assets keep their original provenance notices.

## What is deliberately absent

**Thomas is excluded:** no proprietary CLO Thomas GLB/OBJ mesh, downloaded avatar, collision geometry, Thomas-only test scripts or Thomas-named documents have been copied. The EXO studio's normal selectable-avatar list and its saved-avatar restore path do not select Thomas. The nested macOS packaging script expressly deletes/never bundles a Thomas asset, even if private local media happens to exist on the build host.

Only Git-tracked and locally visible untracked **nonignored** source files were copied from the V2 source workspace at the snapshot. This is a source snapshot, **not a copied user-installed `.app` bundle or a dump of local user projects**. It intentionally excludes `.env`, private signing credentials, build caches, installed dependencies, research clones, personally installed vendor material files, local fabric/CLO metadata export and machine-specific app data. Previously published images remain as part of the source snapshot. Some engineering tools expect locally installed external SDKs, Blender, Qt, a compiler, or optional proprietary services and will not become standalone or licensed simply by copying source files.

## Build/run from this fork

From the fork root:

```sh
cargo build --locked -j 2 --bins
cd exo-studio-v2
npm ci
npm run build
npm run clothcraft:start
```

`clothcraft:start` launches the Node native-bridge server plus the EXO Vite UI at `http://127.0.0.1:5174/`. When nested in this ClothCraft fork, the bridge finds this root Rust checkout and `target/debug/exo-session` automatically. The same native 2D/3D solver APIs must compile in the current source revision. The C++ CAD CLI (`native_cpp/build-cmake/garment_cad_cli`) is not committed as a binary; features requiring it need the local CMake build and any required dependencies. A buildable Vite UI is **not** proof that every optional native feature is installed or an end-to-end CLO3D replacement.

The first-party macOS window source remains `exo-studio-v2/integrations/clothcraft/macos/EXOClothCraftWorkspaceV2.swift`, and its builder is `npm run clothcraft:build-v2-workspace` inside the nested app. Run this only when you intentionally want to build/replace a local `.app`: the existing script may stop an installed EXO window and requires macOS toolchains, bundled Node, and compiled native C++/Rust executables. Its default distribution mode does not include personal avatars and always excludes Thomas. It is **not run automatically by this GitHub contribution**.

## Validation and upstream merge scope

- Test app source with `cd exo-studio-v2 && npm run build`, `npm run check:materials`, and `npm run check:clo7-fabrics`.
- Run `cargo test --locked --no-default-features -j 2 -- --test-threads=2` for ClothCraft engine/bridge correctness.
- Local QA scripts that assume a previously installed app or private services must be run in the appropriate configured environment; a passing unit build does not attest to GUI parity, measured 400-material mechanics, sewn-cloth fit or software production certification.
- **Submitting this entire nested application for upstream review is a separate decision.** The original ClothCraft maintainers control their repo and may ask to split this large additive change into smaller pull requests. Nothing is merged into `erythrofr/ClothCraft` by publishing this branch to `mikristian/ClothCraft`.
