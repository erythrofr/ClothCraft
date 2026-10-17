# Garment Studio versus CLO3D — functional feature parity snapshot

**Scope:** This is a source-backed *feature inventory* of 43 selected CLO-inspired behaviors, not all of CLO3D. Partial credit is exactly half for the named behavior; a passing unit test does not prove end-to-end workflow equivalence. All statuses require human reevaluation as the build evolves.

**Full visual parity:** Not measured. A bounded chrome-only diff of a local CLO7 2D reference and Garment Studio exists in [the 2D comparison audit](../docs/CLO_2D_REFERENCE_LAYOUT_DIFF_2026-10-14.md); its score is **not** a complete CLO3D appearance or behavior score.

**Physics:** A functional backend is not an accepted simulated fit. The physical sewing/collision gaps remain failing.

**Important:** This weighted snapshot is not directly interchangeable with earlier approximate 38% overall CLO3D parity estimates.

## Parity: 54.6 / 100

features 54.6  (43 counted, must-haves 8 of 25 done)

Not shippable yet: 17 must-have features are not done.

## By area, weakest first
- Simulation                    16.7  (3 features)
- Interoperability              16.7  (2 features)
- Sewing                        50.0  (4 features)
- Production                    50.0  (4 features)
- 2D drafting                   53.3  (11 features)
- Rendering                     55.6  (4 features)
- 3D garment                    62.5  (3 features)
- Interface                     71.1  (8 features)
- Materials                     75.0  (4 features)

## Missing, in build order
- [must] 2D drafting: Complete darts rotation slash spread pleats, no  (Full topology-safe dart transfer and slash spread not complete)
- [must] 2D drafting: Industrial 2D snapping and construction constraints, no  (Full snap grid and persistent constraints not implemented)
- [must] 2D drafting: True geometry self-intersection and topology validation, no  (Not all point and curve edits reject invalid garment topology)
- [must] Sewing: Automated sewing and initial pattern assembly on avatar, no  (Real Thomas tee still exceeds maximum initial 3cm seam gap)
- [must] Simulation: Accurate cloth avatar and cloth cloth collision, no  (Observed actual PPF trajectory penetrates body starting frame 3)
- [must] Simulation: Physically stable gravity garment draping, no  (No certified full drape and garment fit for active sewn tee)
- [must] 2D drafting: Cut split and merge patterns while preserving sewing references, partial  (Edge point splitting exists; generalized robust cuts and merges missing)
- [must] 2D drafting: Piece notches and seam allowances, partial  (Functional per-edge allowances and notches; all corner handling not validated)
- [must] 3D garment: 3D avatar import and dimension edits, partial  (Visual mesh import and proxy measurements; general avatar surface physics differs)
- [must] 3D garment: 3D garment placement and piece transforms, partial  (Staging transforms exist; complex 3D styling tools incomplete)
- [must] Interface: Editable Property Editor bound to selection, partial  (Point curve edge materials implemented; contextual inspector parity incomplete)
- [must] Interface: Toolbars with fully working referenced commands, partial  (Some commands disabled or unavailable; full published CLO index not covered)
- [must] Materials: Textile bending stretch shear from calibrated material tests, partial  (Fabric physics controls present but not calibrated to physical samples)
- [must] Production: DXF pattern import export with seam allowances, partial  (Round-trip checks run; advanced ASTM AAMA fidelity not certified)
- [must] Production: Multi-size grading size run and measurement CSV, partial  (Grading and POM exports exist; full supplier rule fidelity incomplete)
- [must] Sewing: Partial segment sewing and seam length audit, partial  (Measured exact fractional sewing for 947 CLO segments in both solvers and the 2D editor; full M:N auto-fitting and garment assembly are not certified)
- [must] Simulation: Real solver backend and physical material parameters, partial  (Native solver runs but cannot yet deliver accepted sewn fit)
- [should] Interoperability: Parametric formula-driven pattern drafting with linked measurements, no  (Seamly2D graph imported read-only and native evaluated parameter dependency graph is not implemented)
- [should] Rendering: Animations and professional video render queue, no  (No complete animation or batch professional render pipeline)
- [should] Rendering: Photorealistic path tracing and denoising, no  (Production-quality path tracing unimplemented)
- [should] 2D drafting: Full internal lines and reference annotation tools, partial  (Internal lines and measurements exist; advanced polygons and cutting absent)
- [should] 2D drafting: Pattern mirrored symmetry and unfolding, partial  (Mirror features exist but full linked unfolding and propagation are unverified)
- [should] Interface: Persistent CLO-style configurable workspace layouts, partial  (Four persisted profiles and saved custom layouts now include viewport splits and collapsed sidebars; detachable floating windows are still missing)
- [should] Interface: Two-column 2D drafting and sewing toolbars, partial  (Existing independent two-column palette but ordering and action coverage not complete)
- [should] Materials: Professional multi-fabric library and scanned material catalogue, partial  (Presets and fabric browser present; calibrated digital scans not complete)
- [should] Production: Marker nesting production layout, partial  (Functional marker algorithms present; industrial marker optimization incomplete)
- [should] Production: Tech pack BOM and garment metadata export, partial  (Metadata exports exist; final factory validation missing)
- [should] Sewing: Buttons zippers and edge finishing details, partial  (Trims and buttonholes present but editing/rendering and sew semantics incomplete)
- [could] Interface: Complete keyboard command mapping and tool search, partial  (Cmd K searches 71 implemented actions and runs sewing pin and measure; full CLO keymap and all advanced commands remain unavailable)
- [could] Interoperability: User-defined measurement tables and avatar POM workflow, partial  (Imported measurements and POM exist but full interactive body-measurement drafting not complete)

## Evidence and methodology

The auditable matrix is [features.csv](features.csv), with a per-row local source/test/report pointer and missing-behavior note. The weighting calculation comes from MIT-licensed replica-skill ([source](https://github.com/Jakeschincariol/replica-skill)).
