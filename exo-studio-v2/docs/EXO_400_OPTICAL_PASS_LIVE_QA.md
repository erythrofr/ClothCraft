# EXO 400 optical preview live QA — 2026-10-16

**Result: PASS for scoped optical QA; mesh cutout proof remains partial.** Production Vite build succeeded. The targeted follow-up reused the `vite preview` server at `http://127.0.0.1:5188` and confirmed the 400-preset UI, optical preview changes and stable simulation session. Request failure logging identified the lone browser console error as an optional native bridge health probe. The diagnostic retains the original console message and request URL. No native packaging was attempted.

## Live evidence

| Check | Observed result | Status |
| --- | --- | --- |
| Fabric library blank search | Exactly **400** visible preset cards | PASS |
| Rigid Denim surface roughness edit | Before and after WebGL canvas screenshots differ; changed-pixel bounding box `(6,44)-(344,161)` in 356×237 preview | PASS |
| Patent Leather surface roughness edit | Before and after WebGL canvas screenshots differ; changed-pixel bounding box `(6,44)-(344,161)` | PASS |
| Simulation session isolation | `data-simulation-session-builds` stayed constant during each roughness edit | PASS |
| HTTP photographic normal and roughness images | Denim `denim_fabric_06`, ambientCG `Leather024`, plus ambientCG `Fabric046` color/normal/roughness: seven checked URLs returned **200**, `image/jpeg` | PASS |
| Browser scan image network responses | Zero unsuccessful `/fabric-scans` responses observed | PASS |
| `polyMesh` versus `powerMesh` | Preview canvas screenshots differ; bounding box `(0,1)-(356,161)` | PARTIAL: visual differences established; actual transparency/open alpha holes not pixel-classified |
| Browser console / request failures | One refused `GET http://127.0.0.1:5191/health` request; console location matches the URL; optional local bridge health probe unavailable | INFORMATIONAL; no unclassified console errors |
| Other failed requests | Three `HEAD` requests to `/avatars/clo-thomas.glb`, `/avatars/opensew/theo.glb`, `/avatars/opensew/nora.glb` ended `net::ERR_ABORTED`. These are retained in `nonBridgeFailures`, with no scan assets affected | RECORDED; cancellations were not proven essential failures |

## Screenshot evidence

Exactly six optical canvas crops were retained under `screenshots/`: `QA-400-optical-denim-before.png`, `QA-400-optical-denim-after.png`, `QA-400-optical-patent-before.png`, `QA-400-optical-patent-after.png`, `QA-400-optical-poly-mesh.png`, `QA-400-optical-power-mesh.png`. The before/after crops verify rendered differences, though screen animation or lighting motion may contribute to pixel changes. Pixel comparisons do not independently prove physically correct roughness or true transparent mesh perforations; a further static render inspection with a contrasting background is recommended.

## Follow-up priorities

1. The console error is now attributed to `GET http://127.0.0.1:5191/health`, a separate local service from the Vite preview port `5188`. `requestfailed` captures HTTP method, URL and Chromium failure (`errorText`); console errors capture `location()`. The QA reports the optional bridge refusal separately while continuing to fail on any unclassified console error or failed fabric image request. `nonBridgeFailures` records the three aborted avatar HEAD requests for reference; they did not cause this textile QA to fail.
2. Inspect the mesh screenshots at full size and, if necessary, render against a contrasting background to confirm open alpha-masked holes independently of color, weave and lighting variations.
3. For a strict optical roughness regression, use deterministic lighting/camera and compare normalized cropped pixel regions (the present live test shows changed preview pixels and unchanged simulation build counts).

## Repeat

`EXO_QA_URL=http://127.0.0.1:5188 node scripts/qa-400-visual-20261016.mjs` after building and starting a single Vite preview server. The test closes its own headless Chrome instance in `finally`. The source files and application renderers were not edited in this QA task.

**Follow-up execution:** `pass: true`, `catalogCount: 400`, both roughness canvases changed without simulation rebuild, both meshes rendered differently, seven scan PBR assets HTTP 200, `optionalBridgeUnavailable: 1`, `noBrowserErrors: true` (meaning no **unclassified** console errors), `noFailedImages: true`. Raw `consoleErrors` still contains the refused health probe. Its classification is limited to refused connections for health/bridge-style paths on a separate loopback port and never applies to fabric scans.
