# CLO open male T-shirt — arrangement and sewing reference audit

**Read-only capture:** October 14, 2026. Running application `/Applications/CLO_Standalone_OnlineAuth.app`, process `63233`, title **`Male_T-shirt.zpac`** (CLO Academic 7.0.242). This is CLO's *male T-shirt reference*, **not** our currently failed PPF tee and not the 501 jeans project.

## Source evidence

1. Live CLO workspace screenshot at `research/clo-reference/live-audit-20261014/current-workspace.png` (3024×1964 source) and `current-workspace-preview.png` (resized overview). Source copied directly from live macOS display without clicking or changing project objects.
2. Live app autosave **copy** at `research/clo-reference/live-audit-20261014/current-autosave-COPY.zprj`. Original autosave remains at `~/Documents/clo/Assets/Autosave/63233/autosave.zprj`, saved at **17:14:21**, 17,498,650 bytes.
3. Source archive contains `autosave.zpac`, `autosave_0.avt` (body), `autosave.vmp`, `.vlp`, `.smp` and related layout data. Nested garment archive contains `autosave.pac` (7,077,138 bytes), `autosave.pos` (97,962 bytes), plus fabric and stitch textures.
4. CLO's `.pac` binary contains named serialization entries `mapPatternEditor`, `listSeamLinePairGroup`, `mapSeamLinePairGroupWithHalfSymmetry`, `bSymmetricSewing`, `bNormalFlippedPattern` and `listTriangleListPair`. **Their presence confirms serialized pattern/sewing state, not correct decoded coordinates.** It would be unsafe to reverse-engineer specific seam indices or assert exact vertex positions from unparsed binary strings alone.

## Direct visual findings from active CLO project

- **3D preview:** a white short-sleeve shirt surrounds the male avatar's torso instead of leaving the front and back panels as distant planar rectangles. Side surfaces turn around the ribcage. The sleeve fabric is visibly staged around the upper arm rather than translated laterally in its original flat orientation.
- **Shoulder / armhole:** multicolored striped sections overlay the upper chest, back and armhole/shoulder region. These appear to be pattern section/sewing/selection visualization, not final free drape. Do not interpret stripe colors as a verified numerical seam-distance measure.
- **2D pattern view:** a centered front bodice, a back bodice to the right, sleeve-shaped pieces at the left and between the torso pieces, and two small accessory/neckline-shaped pieces above. Symmetry/fold centerlines and colored seam marks are visible. The screenshot is sufficient to identify types and adjacency, but not to assert absolute pattern length or exact edge-to-edge stitch pairing.
- **Avatar:** male upright with arms outward at a diagonal; the initial garment wraps the chest and rises around the shoulder. Thomas in our PPF research is a different imported private body/pose and has to be fitted on his **actual** triangulated collider, not copied from this screenshot pixel-for-pixel.
- **Working view:** the screenshot shows the simulated/arranged shirt and overlaid colored construction lines. It does **not** reveal the full original exploded starting pose or the exact numeric placement transformation for every piece. No interaction with CLO was made, and no source file was altered.

## Important differences from current Garment Studio PPF

| CLO visual arrangement | Our research PPF staging | Engineering implication |
| --- | --- | --- |
| Bodice appears to wrap chest continuously | Independent shallow cylinders/rigid alignment and separated seam correspondences | Use a torso-relative curved surface and explicit front/back stitch correspondence; optimize on seam pairs with body clearance before invoking solver |
| Sleeves visibly follow arm direction | Historical exploded sleeves may begin ~30+ cm from sewn arms, later wrapped using tapered-cone research | Derive sleeve-local frame from shoulder, armhole and upper-arm centerline rather than fixed translation |
| Upper shoulder region remains near body | Best independent Thomas setup still has 19.291 cm maximum initial stitch gap | Shoulder/head clearance and armhole join are the largest blocking preassembly problems; a screenshot alone does not solve their constrained placement |
| 2D pattern stores distinct piece/seam roles | Our 98 stitch pairs are encoded as loose edges across four tee panels | Map source pattern segment arclengths and local 3D correspondence explicitly, preserving seam IDs and notch orientations |
| Avatar shape matters | Our Thomas is a separately triangulated collider | Derive staging from actual target avatar with signed-body clearance and triangle-intersection checks, not from screen-space silhouette |

## Correct next technical steps

1. **Export from CLO using its supported OBJ/USD/Alembic (3D) and DXF (2D) options or the authenticated CLO SDK.** Obtain a mesh with separate pattern-piece IDs and ideally sewing correspondence data. This requires interacting with CLO. A `.zprj`/`.zpac` is a proprietary serialized document; the present screenshot and raw PAC bytes do not supply trustworthy exact seam coordinates.
2. For each piece, compute body-relative local frames, normal direction, bend/radius and distance to skin. For every sewing correspondence, compute source edge IDs, along-seam arclength fractions, relative orientation, 3D gap mean/p95/max and nonadjacent triangle collisions.
3. Transform Garment Studio tee panels to this *kind* of around-body pose, **not** to the reference model's absolute coordinates; optimize front/back/sleeve placements without exceeding 5% initial intrinsic edge change or introducing body/self collision.
4. Keep the PPF preflight gate **max 3 cm stitch gap**, with eventual physical fit passing zero swept contact violations, final seam mean ≤0.2 cm, final seam max ≤1 cm, and measured shoulder/torso clearance.

**Audit conclusion:** Live CLO reference confirms a far more anatomically assembled, body-following preview with visibly organized bodice/sleeves/neck pieces than Garment Studio's current exploded or partially folded staging. But a screenshot + opaque native archive alone cannot yield numeric piece transformations or complete stitch mapping. The next breakthrough requires SDK/exported per-piece mesh and actual sewing graph, not an invented estimate or secretly treating the historical PPF failed simulation as working.

## Follow-up: actual native CLO OBJ and seam XML successfully exported

The missing read-only reference **was obtained via CLO's official File → Export → OBJ**, selecting **Multiple Objects**, **Unweld**, and **Save with Meta Data (XML)**. We preserved the original project and exported copies to `research/clo-reference/live-audit-20261014/exports/`.

The exported OBJ contains **3,661 vertices, 7 independently named pattern groups, 6,876 triangles**. The matching XML explicitly contains **23 `SeamLinePair` groups with 182 indexed stitch-point correspondences**, physical fabric settings, and face/mesh index ranges. The deterministic extraction script `scripts/analyze-clo-obj-seams.py` preserves each pair's two ordered point lists, group ownership, actual 3D vertex index and distance measured in centimetres. Its machine-readable report is `exports/clo-reference-sewing-metrics.json`.

An especially important qualification: **this open CLO garment is still arranged for sewing; it is not a closed or proven fitted shirt.** Its current exported pose has an *average* paired stitch gap of **13.321 cm**, a **95th-percentile 26.785 cm**, and a **maximum 36.804 cm**. The visual shirt outline is *not* evidence that CLO's initial seam gap is ≤3 cm. These gaps must not be copied as PPF solver-quality tolerances. The reference is valuable for anatomical placement, panel-frame orientation and exact sewing topology—not as an already physically accepted solved trajectory.

Three small groups lie near the collar/upper chest: `Pattern2D_768516`, `Pattern2D_768527`, `Pattern2D_768528`. The main bodice groups `37` and `7` are on opposing sides of the torso (OBJ centroids respectively **+13.713 cm** and **−18.388 cm** in the exported Z axis), and lateral sleeve groups `36` and `39` lie near **+27.964 cm** and **−27.221 cm** X. This confirms a body-relative four-panel torso/sleeve architecture, plus small neckline pieces, but not a one-to-one vertex correspondence with our four-piece tee.

Unlike the earlier binary-only inspection, **precise reference vertex positions and sewing group indexing are now available from supported CLO exports**. We should compare normalized piece-relative positions and stitch graphs; do not naively copy CLO absolute coordinates or its incomplete seam gaps onto our different avatar or pattern.

### Quantitative CLO-to-PPF assembly comparison

The exported coordinates and sewing correspondences are parsed and validated by `scripts/analyze-clo-obj-seams.py`. Run `node scripts/check-clo-reference-ppf-assembly.mjs` for the reference/PPF comparison. The machine-readable report is `research/clo-reference/live-audit-20261014/exports/comparison-to-garment-studio-ppf.json`.

The CLO reference contains **23 sewing groups and 182 point correspondences**, and its currently arranged pose has **13.321 cm mean, 26.785 cm p95 and 36.804 cm maximum gap**. This is a useful anatomical reference, NOT a physically preassembled seam-closed shirt. Our separately optimized four-panel Thomas pose has **7.406 cm mean and 19.291 cm maximum gap**, with worst gaps at shoulders and the torso sides; it also fails the PPF ≤3 cm preassembly gate.

Actual CLO OBJ group role mapping from mesh centroids and XML seam connections: `37` = front torso, `7` = back torso, `36` = right (positive-X) sleeve, `39` = left (negative-X) sleeve. Small collar/neck objects are `Pattern2D_768516`, `Pattern2D_768527`, `Pattern2D_768528`. Our current four-piece PPF tee has no identical neckline components. We must transfer anatomy-relative piece orientation and stitch topology principles, not copy absolute coordinates or infer an unrealistically low seam-gap target from CLO's arranged reference.

**Remaining blocker:** construct a continuous body-relative front/back and shoulder fold, optimize shoulder/side seam endpoints under triangle rest-edge strain and real Thomas body/self contact checks, then verify all 98 source stitch correspondences at ≤3 cm max before running native PPF. This reference extraction and comparison do not themselves certify fitting or close those gaps.

## Follow-up: real supported CLO OBJ + sewing metadata export (17:32)

The missing export is **now available** in `research/clo-reference/live-audit-20261014/exports/clo-reference-tee-20261014.obj` and `clo-reference-tee-20261014_meta_data.xml`. CLO's own OBJ exporter emitted 7 named mesh groups, 3,661 vertices and 6,876 triangles. The XML has **23 explicit `SeamLinePair` records** with ordered mesh vertex indices on each side, plus physical material properties and 7 per-mesh vertex ranges. These are real sewing correspondences, not guessed from screenshot. A reproducible read-only parser is `python3 scripts/analyze-clo-reference-sewing.py`; its full 3D per-piece centroids/bounds, 182 seam samples, per-seam point pairs, length mismatch and actual gaps are saved as `research/clo-reference/live-audit-20261014/clo-sewing-geometry-analysis.json`.

**Important new nuance:** the exported current CLO pose is **not a near-welded solved garment**. Its mean seam separation is 133.209 mm across the 182 ordered pairs, and its worst sampled separation is 368.036 mm. This confirms that CLO supports substantial pre-simulation seam gaps and draws the seams into place under its own constraints; it **does not** prove those gaps are safe for our current PPF engine. In fact, some exported CLO seam segment lengths differ because they have different tessellation or source pattern construction. Do not blindly copy CLO's pre-simulation separation into PPF, or use the CLO avatar's absolute millimetre positions for Thomas.

The objective is to adopt CLO's **anatomy-relative panel arrangement and explicit sewing correspondence**, while retaining our independent PPF preflight ≤3 cm maximum initial gap and contact-free initial state. This is a stronger evidence base than the earlier screenshot-only audit.
