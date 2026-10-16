# 400 Fabric UI QA — 2026-10-16

Run `node scripts/qa-400-fabric-ui.mjs` while the existing Vite app is serving at `http://127.0.0.1:5188/`. Set `EXO_QA_URL` to override the URL. The test opens one bounded, headless Chrome page with `testSession=tee` (isolated test autosave) and closes it in `finally`. It does not alter the production project. The Vite server is not started or killed by the test.

## Live result

**PASS**, against a temporary Vite instance started on port 5188. The actual rendered library contained **400** selectable fabric preset tiles, matching 400 catalog entries. UI search results matched case-insensitive preset-name filtering for **denim, cotton, leather**, and exact **Rigid Denim** selection worked. Denim exposed an HTTPS photographic reference link to `https://polyhaven.com/a/denim_fabric_06`, labeled CC0. The test confirmed the textile preview canvas, changed the weave to twill, selected rinse wash, changed the blend to soft-light, and edited wash intensity without page exceptions.

The 3D canvas counter `data-simulation-session-builds` was **1** before choosing the physical denim preset, **2** after choosing it, and **2** after the twill appearance and wash edits. This establishes that visual wash and textile appearance edits did not reinitialize simulation in this run. Applying a different *physical* fabric preset did trigger one simulation rebuild; do not conflate that with a visual-only wash edit.

These are functional UI checks and attribution presence checks, not proof of 400 unique scan sources, lab-tested fabric mechanics, visual photorealism, chemical-wash accuracy, or physical textile calibration. The catalog includes shared scans, proxies and procedural fallback materials. The test does not claim otherwise.

## Updated built-app verification: ambientCG integration

After the ambientCG asset/reference update, `npm run build` passed (Vite reported an informational large-chunk warning). Started one bounded Vite **preview** of the built `dist` on port 5188 and ran `node scripts/qa-400-fabric-ui.mjs` **twice**. Both runs passed with identical JSON values: 400 rendered selectable catalog presets; precise name-search results for denim, cotton, leather, and ripstop; Rigid Denim source `https://polyhaven.com/a/denim_fabric_06`; Nylon Ripstop source and CC0 attribution `https://ambientcg.com/a/Fabric046`; 15 catalog records with no installed scan reference (procedural fallbacks); valid rinse wash, soft-light blend and editable intensity; zero page errors.

In each run the simulation-session counter advanced **1 → 2** when switching to physical Rigid Denim, **2 → 3** when switching to physical Nylon Ripstop, then remained **3** through Nylon Ripstop visual wash edits. Denim wash edits likewise left the counter at 2. No nondeterminism was observed across the two completed browser runs. This repeat test is a limited sample, not a guarantee against timing or rendering differences on other hardware.

## 67-source WebGL material screenshot follow-up

Rebuilt with `npm run build` (PASS) and tested the actual built Vite preview using the existing single-page Playwright fixture. Captured the WebGL textile material preview canvas before and after selecting stone wash (the test still verifies 400 listed fabrics and correct catalog search). The test writes these four artifacts:

- `screenshots/QA-400-denim-before-wash.png`
- `screenshots/QA-400-denim-after-wash.png`
- `screenshots/QA-400-nylon-ripstop-before-wash.png`
- `screenshots/QA-400-nylon-ripstop-after-wash.png`

Observed Rigid Denim screenshot PNGs differ (47,762 versus 47,872 encoded bytes); Nylon Ripstop PNGs differ (41,850 versus 40,444 bytes). This is **PNG-buffer comparison**, not a decoded per-pixel difference metric; GPU animation, light behavior or rendering jitter could also affect screenshots. The screenshots provide the visual evidence for manual inspection. The stone wash control was enabled on each fabric, and the cloth simulation build counter was unchanged across visual edits. Counter changes **1 → 2 → 3** correspond only to the two physical fabric selections. The test explicitly requests `Fabric046/color.jpg`, `normal.jpg`, and `roughness.jpg` from the served ambientCG directory: all three returned HTTP **200**, with image MIME types and nonempty payloads. No intercepted ambientCG HTTP failures or page errors were detected.
