# Native C++ / ZOZO PPF integration checkpoint — 2026-10-14

Owner: Jarvis, continuing the authorized Garment Studio project on Blender Mac.
Project: `/Users/mikylecouto/Chat On Steroids Workspace/garment-studio`.
Upstream: https://github.com/st-tech/ppf-contact-solver

## Implemented

- Compiled C++/libcurl transport to the existing loopback PPF service. Native CLI supports `ppf-health`, `ppf-submit`, and `ppf-job`. POST is readiness-gated, keeps experimental assembly bypass disabled, and never retries an uncertain submission. No remote endpoints, redirects, or implicit XPBD fallback.
- Compiled C++ `ppf-fit-evidence` gate for the Thomas-shirt profile: contiguous contact/sewing frames, bounded measured principal stretch, complete swept CCD intervals, closed final seams, and shoulder/torso clearance. Missing/negative/malformed evidence fails. Report provenance must still be tied to the correct job by the caller.
- Reproducible installed-upstream headless fitting runner using the actual dress assets, 851 encoded stitches, pinned animated body, original material parameters, and original inactive-momentum/dt schedule. Unique run directory, shared runtime lock, bounded execution, preserved raw frames.
- Raw-native reference audit for discrete intersections and principal stretch. It uses the upstream Rust intersection kernel; it is not independent swept CCD or a textile/visual certification.

## Verified

- C++ compile and both CTest suites passed.
- Existing CAD parity: two projects, 76 edge lengths, 28 sewn relationships; metadata roundtrip and transaction checks passed.
- Actual native C++ → running PPF service health request passed. Invalid job path rejected. Backend busy state correctly reflected the reference run.
- Saved real 20-frame Metal Thomas output remains rejected, including frame-3 contact, seam closure, swept CCD and clearance failures. This verifies rejection behavior, not successful fit.
- First bounded upstream run produced 55 frames. Raw audit: zero detected body/self crossings, maximum principal stretch 1.09767195, within the reference's 1.10 bound. That run hit its diagnostic timeout and is not complete.

## Preserved boundaries / incomplete work

- Original installed Swift/React application and user projects unchanged.
- Rust PPF itself is retained; the C++ transport still uses existing Node/Blender orchestration. Direct Rust process orchestration and Qt playback are not yet replaced or validated.
- Native POST has not yet been exercised with an accepted garment; health and path validation were checked read-only.
- Qt C++ SDK remains absent; no compiled Qt desktop or UI cutover claimed.
- Thomas's latest staged garment still exceeds the 3 cm seam-start gate. No gate was weakened, no avatar was shrunk, and no post-solve seams were snapped.
- Full 240-frame upstream reference launched separately with a longer bound. Final result and raw-frame audit will be recorded below.

## Relevant files

`native_cpp/solver/ppf_service.*`, `native_cpp/solver/ppf_bridge.*`, `native_cpp/cli/main.cpp`, `native_cpp/tests/test_ppf_bridge.cpp`, `native_cpp/CMakeLists.txt`, `native_cpp/scripts/build_and_test.sh`, `native_cpp/README.md`.

`scripts/check-native-ppf-service.py`, `scripts/check-native-ppf-fit.py`, `scripts/check_ppf_upstream_fitting.py`, `scripts/audit_ppf_reference_frames.py`, `scripts/render_ppf_reference.py`.

Evidence in `logs/native-ppf-service-20261014.log`, `logs/native-ppf-service-health-20261014.json`, `logs/native-ppf-real-fit-20261014.json`, `logs/ppf-upstream-partial-audit-20261014.json`, and `logs/ppf-upstream-fitting-full-20261014.json`.

## Final upstream benchmark result — completed, but not collision-safe throughout

The original installed fitting reference completed **240 frame advances / 241 raw samples (0–240)** on Metal. It used 15,656 cloth vertices, 29,456 cloth triangles, 25,472 pinned-body triangles and **851 encoded stitch constraints**. Adaptations were local asset paths, a unique session name, deterministic seed for the original random body-height jitter, and removal of notebook display/export calls. Material, body motion, stitching, and dynamic momentum/time-step schedule were retained.

- Full raw trajectory: first detected cloth/body crossings at **frame 87**, peak **492 triangle pairs at frame 90**; final frame 240 is clear.
- **Independent confirmation:** Blender BVH plus float64 strict segment/triangle intersection tests gave 0 crossings at frames 0/86, 2 at frame 87, 492 at frame 90, and 0 at frame 240. This is not merely a loose BVH-contact report. It is a discrete spot check, not an independent all-frame CCD certification.
- No cloth-self crossings detected by the upstream kernel across the 241 samples.
- Maximum principal stretch **1.09799515**, below the configured reference bound **1.10**.
- Final seam gaps: mean **0.11219 cm**, maximum **0.46010 cm**.
- Final front/side/back raw-output renders saved and inspected; a plausible dressed figure is visible. A good final snapshot does **not** negate intermediate crossings.
- The reference run finished and released the runtime lock. A fresh native C++ health check reported `ready=true`, `busy=false`.

**Conclusion:** the installed runtime can execute the upstream fitting setup, close its stitches, and produce a plausible final dress. It has NOT passed a penetration-free full-trajectory criterion. This new reference-level discrepancy must be isolated before attributing all Thomas failures solely to Garment Studio placement/configuration. Do not claim the upstream project generally violates its guarantees: the current installation, prescribed-body motion, encoded constraints and successful-step policy still need investigation.

**Next bounded simulation task:** isolate reference frames 86–90 and prescribed-body contact behavior, compare stationary versus animated pinned body with identical initial geometry, and pin exact runtime/library provenance. Separately, solve Thomas's valid near-assembly without changing rest metrics or bypassing the 3 cm seam-start gate. Only then exercise native job submission and accepted-result playback with that fixture.

Additional evidence: `logs/ppf-upstream-full-audit-20261014.json`, `logs/ppf-upstream-independent-crossings-20261014.json`, `logs/ppf-upstream-reference-renders-20261014/{front,side,back}.png`, `logs/native-ppf-service-idle-20261014.json`.

Native output retrieval now also includes `ppf-jobs` for inspecting existing jobs after an uncertain POST, and `ppf-preview`, which always requests `validatedOnly=true`. Read-only verification against an actual failed job confirmed rejection with HTTP 409. No production scene or installed UI was replaced.
