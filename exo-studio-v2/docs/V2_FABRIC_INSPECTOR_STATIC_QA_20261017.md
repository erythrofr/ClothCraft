# EXO ClothCraft V2 — selected fabric and drape preview QA

**October 17, 2026 · Final result: PASS, 7/7 tests.**

## Scope and isolation

Executed `node integrations/clothcraft/qa-v2-fabric-inspector-static-20261017.mjs` against a new disposable Rust document with a compiled static Vite frontend, on 127.0.0.1 ports 5583/5584. Browser requests to `/workspace` were proxied to the isolated Rust server. The test did not modify the installed app or the user's saved garment. No component source was changed during this testing pass.

## Confirmed end-to-end behavior

| Check | Result |
| --- | --- |
| Select a native Fabric in Object Browser; corresponding Property Editor becomes visible | PASS |
| Draped-ball preview has working WebGL framebuffer and actual geometry | PASS — **11,025 cloth mesh vertices**, 149×149 canvas |
| Seven independent physical property controls contain both numeric inputs and sliders | PASS |
| Change selected panel's surface mass from 200 to 201 g/m², persist a Rust edit | PASS — **0.200 → 0.201 kg/m²**, revision 0 → 1 |
| Native Undo restores original physical values and 2D pattern stays white | PASS |
| Edit supplier field and persist native Fabric property metadata | PASS |
| No uncaught browser JavaScript errors | PASS |

### Primary proof

`integrations/clothcraft/output/qa-v2-fabric-static-hJBXvP/results.json`

The result reports `pass: true`, `pageerrors: []`, and exactly seven passing check descriptions. The resulting fabric receives a new native `id: fabric_1` and retains the front panel's assignment. The original shared `woven-reference` fabric's density remains unchanged at `0.2` kg/m²; its unchanged state is **correct**, not evidence that the edit failed.

### Why an earlier test failed, and how it was resolved

The first test incorrectly expected the old shared `woven-reference` fabric record to mutate. Rust's `authoring.rs` `Command::Fabric` intentionally forks a fabric when it is shared across panels and the edit applies to only one. The corrected test follows the actual selected panel's *new* fabric ID, verifies its precise density value, then verifies that Undo restores the prior material assignment and physical values. No product-code workaround or fake property update was needed to make these checks pass.

### Honest limits

The fabric-over-ball preview is a visually detailed deterministic Three.js drape geometry informed by estimated bend and mass; it is **not** a native Rust cloth dynamics solve of a dropped square. The preview's color, sheen, roughness, reflectivity, and yarn relief are separate optical study values, not all native physical manufacturing parameters. The seven physical inputs edit the real Rust material. This test does not measure the visual similarity to proprietary CLO3D in a calibrated A/B capture and does not certify garment fit, print color, or fabric handling.
