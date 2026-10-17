# Garment Studio — Public Candidate Validation (2026-10-14)

## Status: private staging only, publication HOLD

The original private repository, Thomas assets, and historical Git commits remain untouched. No GitHub remote was created or pushed, and the project has **not** been published. Security and third-party licensing approval are separate gates.

## Source and UI improvements

- The public candidate at `/tmp/garment-studio-public-candidate-20261014-b` was produced by `scripts/prepare-public-source.mjs` as an independent source snapshot without `.git` history (349 selected files at creation).
- `src/App.jsx` now uses `VITE_PUBLIC_DISTRIBUTION=1` to restrict the public avatar library/select to the bundled MakeHuman neutral base; it normalizes saved projects that refer to unavailable bundled avatar choices. Private builds retain Thomas, Theo, Nora and MakeHuman options.
- `native_app/GarmentStudioNative.swift` now attempts a private Thomas OBJ only when present, and otherwise loads the bundled public `web/avatars/makehuman-base.obj` model. Compilation and bundle presence were verified; SceneKit's actual OBJ rendering was not visually verified.
- Public GitHub Actions build environments set `VITE_PUBLIC_DISTRIBUTION=1` explicitly; other local public builds must also set this environment variable.

## Checks completed on the new independent candidate

- `npm ci --ignore-scripts --no-audit --no-fund`: PASS
- `VITE_PUBLIC_DISTRIBUTION=1 npm run build`: PASS
- `npm run check:non-simulation`: PASS
- `INCLUDE_PRIVATE_THOMAS=0 INCLUDE_PREPARED_SOLVES=0 bash native_app/build.sh arm64`: PASS
- `codesign --verify --deep --strict native_app/build/arm64/GarmentStudioNative.app`: PASS (ad-hoc local signature, not notarized)
- The public built JS no longer contains the original private CLO Thomas selector label; MakeHuman OBJ exists in the browser and native bundle; no Thomas-named asset exists in the native bundle.

Local logs: `/tmp/gs-20261014b-{install,build,tests,native}.log`.

## Blockers before publishing

1. Obtain complete source/history credential scan and source/model/font/asset provenance review. A filename gate and successful build are not sufficient.
2. Confirm license compatibility and provide notices/SBOM for native/JS/Python and bundled assets. CC0 license text does not by itself prove a particular model's provenance.
3. Verify SceneKit public MakeHuman model actually displays correctly; test the browser UI and import/export interactions on clean macOS.
4. Obtain authenticated official GitHub destination and configure owner/team IDs, branch protection and vulnerability reporting.
5. Test GitHub CI runners, then obtain explicit approval before switching a cleared staging repo to public. Signed/notarized distribution is a separate release gate.
