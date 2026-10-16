# PPF raw solver vs Blender post-snap — October 13, 2026

## Reproducible finding

Jarvis restored the upstream line-search horizon (`lineSearchMaxT >= 1.25`) and enabled PPF's 5% strain limit. The native session `garment_studio_ppf_56847` actually encoded `line_search_max_t = 1.25` and `strain-limit = 0.05` (confirmed from `param.toml` and `param_summary.txt`). Its **fetched** Blender PC2 nevertheless measured peak principal stretch 1.8297, 19 self-intersection pairs, and 229 avatar crossings.

The upstream add-on's global `post_snap_exactly` defaults **true** and `core/client.py::_apply_post_snap_closure` moves seam vertices in reconstructed frames *after* PPF's contact and strain solve. That operation invalidates contact/strain guarantees when using the exported garment as a physics result.

## A/B, same source fixture and solver settings

- Source: `blender_bridge/fixtures/tee-thomas-body-safe.ppf.json` (500 cloth vertices, 768 triangles, 98 loose stitch edges, Thomas static collider)
- New scene: `blender_bridge/output/tee-raw-no-postsnap-configured.blend`
- New native Metal solve: `blender_bridge/output/tee-raw-no-postsnap-solved.blend`, report `tee-raw-no-postsnap-solve.json`
- All-frame geometry audit: `tee-raw-no-postsnap-contact.json`
- Seam audit: `tee-raw-no-postsnap-sewing.json`

| Metric | Fetched with post-snap ON | Raw fetched, post-snap OFF |
|---|---:|---:|
| All frames within 5% principal stretch bound | No | **Yes** |
| Max principal stretch | 1.8297 | **1.0494** |
| All frames cloth self-intersection-free | No | **Yes** |
| Max cloth self crossing pairs | 19 | **0** |
| Max avatar crossing pairs | 229 | 219 |
| Final mean seam gap | 1.467 cm | 1.634 cm |
| Final max vertex movement | 94.5 mm | 71.1 mm |

**Remaining blocker:** body intersections first appear at frame 3 even in the raw exported output. The prior exporter was a source of false strain and self-intersection failures; it is *not* the complete explanation for body collision failures. Frame-3 body geometry, static collider alignment, and the solver's internal contact status require a minimal audit. The garment has not settled after ten frames and cannot be accepted as a fitted product.

## Implemented guard

`blender_bridge/ppf_prepare_scene.py` now explicitly sets `root.state.post_snap_exactly = False` for all configured PPF jobs. `ppf_backend/server.mjs` requires independently audited all-frame principal stretch compliance **in addition to** the existing sewing/contact checks before accepting a solve. The Sewing UI reports principal stretch and pass/fail. No pattern geometry, avatar collider geometry, or unrelated project was modified.

## Next engineering target

Investigate raw solver collision pairs from frame 2 to frame 3. Compare `vert_*.bin` in the native session with fetched PC2 under the *same triangle topology and transform*. Determine whether the static collision mesh is correctly encoded, if transient crossings occur within a substep, and whether the visual-body triangle BVH is measuring the same collider PPF used. Do not re-enable post-snap to cosmetically close seams.
