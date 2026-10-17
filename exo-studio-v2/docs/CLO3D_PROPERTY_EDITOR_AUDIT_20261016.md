# CLO3D Property Editor: selection-specific controls audit

**Audit date:** 2026-10-16. **Scope:** official CLO Help Center documentation, read-only check of the installed CLO application, and the EXO V2 Property Editor React source. This is an implementation reference, **not** a claim of pixel-perfect inspection of the running CLO application.

## Confidence and current-local evidence

- **Verified (V):** explicitly described by an official CLO Help Center article, linked below.
- **Supported but version-specific (VV):** documented behavior in older/newer CLO pages, which may differ in an installed release.
- **Proposed (P):** EXO implementation design derived from verified behavior; not a statement that CLO uses these exact component names or ordering.
- **Unverified (U):** requires opening the locally installed CLO UI, selecting the actual entity and recording screenshot plus version.

Read-only local check located `/Applications/CLO_Standalone_OnlineAuth.app`. No CLO runtime interaction/screenshots were made in this task. The installed version, current enabled license, exact 2026 panel nesting, and localization remain **U**. EXO's `src/components/CloPropertyEditorAccordion.jsx` (read 2026-10-16) currently uses fixed group IDs `information, selected-line, simulation, fabric, bond, solidify, arrange, miscellaneous`. It receives `selectedPiece` but **no distinct selection kind for line, sewing, seam tape, internal line, fabric-list item, arrangement point or empty canvas**. Its 'Selected Line' displays only pattern name and count of sewing links; it does **not** display measured 2D/3D line lengths. Its Bond/Solidify sections explicitly report no physical solver binding. Its Arrange uses staging X/Y/Z offsets, which are **not** equivalent to CLO's arrangement-point-relative properties. These are source observations, not behavior tests.

## Authoritative context switch behavior

CLO's official Property Editor guide says the selection determines whether the editor shows **Pattern**, **Internal Shape**, **Sewing**, **Stitch**, **Sewing Style**, **Fabric** (fabric-list item), **Button**, **Buttonhole**, **Avatar**, **Simulation**, **Wind**, or **2D Window** properties. The latter three can be chosen through background context menus. A selected line is different from a whole selected pattern; EXO should therefore model an explicit discriminated selection rather than use `activeSection` to decide what is editable. See [CLO Property Editor](https://support.clo3d.com/hc/en-us/articles/115004877468-Property-Editor).

**Proposed context contract (P):** `none | pattern | patternEdge | internalLine | internalShape | sewingLine | seamTape | fabricAsset | stitch | button | buttonhole | avatar | arrangementPoint | simulationSettings | windSettings | window2DSettings`. Every selection must carry stable ID, originating viewport, applicable property capability IDs, revision, and relevant native/document references. Selection can span multiple objects; mixed values need an explicit `mixed` state rather than silently substituting the first item. In particular, **selecting the Sewing workspace is not selecting a sewing line**.

| Selection / source (V unless indicated) | Property Editor content and behavior | EXO priority |
| --- | --- | --- |
| **Pattern piece** via Transform Pattern / 3D selection | Pattern information and geometry, assigned fabric and simulation attributes; Bond/Skive, Solidify and Arrangement when applicable. Selecting whole pattern can show combined outline length rather than one edge length. | P0 distinguish whole piece; P1 actual assignment and physics |
| **Pattern outer segment** via Edit Pattern | **2D Line Length** and **3D Line Length** of selected segment (see official staff explanation), **Elastic**, and applied **Seam Taping** if present. Multiple segments may aggregate lengths. | P0 measured lengths; P1 elastic / tape |
| **Internal line** via Edit Pattern | Line length where provided; Elastic, Fold Angle / Fold Strength for relevant line; fold rendering applicability depends on line/use. | P0 line identity / lengths; P1 folds |
| **Internal shape** | Separate internal shape context; Bond can be applied to selected internal shapes. Do not treat all shapes as whole patterns. | P1 |
| **Sewing line** via Edit Sewing | Sewing-specific settings; sewing tension Strength and Ratio; seam Fold Angle / Fold Strength subject to Turned setting. | P0 seam identity; P1 actual tension / fold |
| **Seam tape** via Seam Taping tool or Edit Pattern | Tape-specific **Width**, **Preset**. An older additional article documents **Extend** with None / To Outline / To Seam Taping and start/end handling across versions. | P1 |
| **Fabric-list item** | Distinct fabric asset Property Editor, fabric Physical Property preset/detail settings, separate from a selected pattern's assigned-fabric pointer. | P0 context; P1 editable fabric model |
| **Arrangement-point-placed pattern** | **Point Name**, **Shape Style**, **Position X**, **Position Y**, **Offset**, **Orientation**, tied to arrangement bounding volume. Only present when arranged using Arrangement Points. | P1 |
| **Arrangement point in Avatar Editor** | **Name**, **Arrangement BV**, **X**, **Y**, **Offset**, **Wrap Direction**. Different from pattern arrangement properties. | P2 |
| **Nothing/background** | Do not retain stale selected-piece dimensions. Background menus can open Simulation / Wind / 2D Window property contexts. | P0 |

Official sources: [Property Editor](https://support.clo3d.com/hc/en-us/articles/115004877468-Property-Editor), [official CLO team clarification on 2D/3D lengths](https://support.clo3d.com/hc/en-us/community/posts/4408171842969-3d-length-count-all-2d-lines), [Elastic](https://support.clo3d.com/hc/en-us/articles/115012380228-Elastic), [Sewing Tension](https://support.clo3d.com/hc/en-us/articles/360001749347-Sewing-Tension), [Arrangement Property Setting](https://support.clo3d.com/hc/en-us/articles/115002101968-Arrangement-Property-Setting).

## Line lengths and units: immediate priority

**V:** CLO's staff states **2D Line Length** of a whole pattern with Transform Pattern reflects the sum of pattern edge lengths; individual edges selected by Edit Pattern display their respective 2D lengths. **3D Line Length** denotes the corresponding length in the 3D window, which may be longer because cloth stretches under gravity. See [CLO staff reply](https://support.clo3d.com/hc/en-us/community/posts/4408171842969-3d-length-count-all-2d-lines). Thus a 3D value is **not** calculated by converting 2D line length units, multiplying by scale, or repeating a nominal design measurement.

**P:** Put `2D Line Length` and `3D Line Length` as independent read-only measurement fields at top of the **Selected Line** context, with unit conversion (mm/cm/in), explicit selection count and measurement provenance. Compute 2D polyline/curve arclength in drafting coordinates with documented tolerance; 3D length from current mapped simulated cloth vertices/edge samples when a reliable correspondence exists. For unsimulated/unmapped lines display **Unavailable until mapped/simulated**, never 0 or copied 2D value. If two or more segments are selected, label aggregation explicitly (`Total 2D length`, `Total 3D length`). Displayed rounding should not mutate underlying physical dimensions. Right-click numeric calculator/unit conversion is documented in CLO [Property Editor](https://support.clo3d.com/hc/en-us/articles/115004877468-Property-Editor); follow this interaction after the measurement foundation is correct. CLO's [Change Length](https://support.clo3d.com/hc/en-us/articles/115000416847-Change-Length) is a **separate editing command** with Length, Direction and Lock Curve Points, not simply editing a displayed 3D length.

## Elastic on outer and internal lines

**V:** Edit Pattern selects a pattern outline or internal line, then Property Editor > Elastic enables elastic influence in simulation; whole-pattern selection is also supported. Documented controls are **Strength** (default 10 per current help guide), **Ratio** (100% original; supported 0–200%), **Segment Length** (assigning it updates ratio), and **Total Length** when multiple segments selected. The guide says increasing Strength resists outside influences and better maintains the target ratio. [Elastic, current](https://support.clo3d.com/hc/en-us/articles/115012380228-Elastic). **VV:** Another official page describes a separate *fabric-based Elastic* property with Preset, Strength, Stiffness and Thickness, alongside the line elastic context; don't mix those UI contexts. [Elastic, legacy/variant](https://support.clo3d.com/hc/en-us/articles/115000414707-Elastic).

**P:** `Elastic enabled` + Strength + Ratio (%) + derived/linked Segment Length; Total Length editable for group selection. A 2D line's geometric measurement remains distinct from the elastic target length. Store target/rest information per edge or internal-line constraint with explicit solver capability; without a solver binding these should be visibly unavailable, not pretend to shrink cloth.

## Seam Taping

**V:** CLO applies tape to **pattern outlines**, highlights taped 2D segments orange and changes the simulated drape. Selecting applied tape exposes **Width** and **Preset**. [Seam Taping](https://support.clo3d.com/hc/en-us/articles/115012381228-Seam-Taping). **VV:** Another official Seam Taping guide describes **Extend** with values `None`, `To Outline`, `To Seam Taping`, plus start/end semantics and a migration note for versions before 2024.2. [Seam Taping extension](https://support.clo3d.com/hc/en-us/articles/115000574107-Seam-Taping). Exact arrangement of these controls in the installed CLO version is **U**.

**P:** Taped-edge state belongs to an *edge-bound reinforcement object*; expose width, preset, and optional start/end extension where version-tested. Width must be in physical units and act through supported edge reinforcement physics. Selected non-taped segment should offer an **Apply Seam Taping** action only when implementation exists.

## Sewing / seam controls

**V:** Selecting an actual Sewing Line with **Edit Sewing** shows **Tension Strength** and **Ratio**; the official guide documents maximum ratio **200%**. [Sewing Tension](https://support.clo3d.com/hc/en-us/articles/360001749347-Sewing-Tension). Sewing-line Fold Angle is **0–360°**, with 180° flat; Fold Strength controls intensity. With **Turned** sewing, Fold Strength / Fold Angle become unavailable in that version's article. [Fold Seam Line](https://support.clo3d.com/hc/en-us/articles/115000414567-Fold-Seam-Line). **VV:** CLO staff in November 2024 indicated the older *Flat vs Custom Angle* choice shown in a tutorial was changed; a **Turned** checkbox now expresses flat overlapping pieces. [Official staff reply](https://support.clo3d.com/hc/en-us/community/posts/40547802776985-Need-help-in-property-editor-sewing-line-type). Do not lock EXO's architecture to outdated `Sewing Line Type` text without visual version confirmation.

**P:** Sewing selection must identify source and paired target seam segment IDs, orientation, seam lengths and correspondence; expose supported tension/fold properties only after native constraint integration. Show fold fields disabled with an explanation when `Turned` takes priority. Sewing style and topstitch are their own selection types, not always seam settings.

## Bond, Skive, Solidify and Strengthen: distinct semantics

**V Bond:** Select pattern or internal shape, Property Editor > **Bond/Skive > Bond**. Official article lists separate physical preset values for fusible/interlining/reinforcement, with editable **Physical Property > Preset / Detail**. Bonded areas become stiffer in simulation. [Bond](https://support.clo3d.com/hc/en-us/articles/115000574207-Bond-How-to-Add-Interlining-Fusible-Reinforcement).

**VV Skive:** Official CLO introduction describes separate **Skive** toggle / percentage for reducing local rigidity. Verify exact current units, nesting and relationship with Bond in installed version before reproducing. [CLO introductory guide](https://support.clo3d.com/hc/en-us/article_attachments/48293801440281).

**V Solidify:** Maintains a pattern's simulated drape; available from pattern right-click **Solidify** or selected-pattern Property Editor, with a strength adjustment. Older official article explicitly places it under **Bond/Skive > Solidify > Strength**; the newer article describes `Strengthen` text as the adjustment label. Treat exact spelling as **VV** and verify locally. [Solidify current](https://support.clo3d.com/hc/en-us/articles/115012381408-Solidify), [Solidify legacy](https://support.clo3d.com/hc/en-us/articles/115000306568-Solidify).

**V Strengthen** is **temporary hardening**, used for folding/draping and reversible by Unstrengthen, distinct from Solidify's shape preservation. [Strengthen](https://support.clo3d.com/hc/en-us/articles/115012381468-Strengthen).

**P:** Under selected pattern, represent one cohesive `Bond/Skive` section with independent Bond, Skive, Solidify subcontrols as supported; context menu access to Solidify / Strengthen where the physics exists. EXO currently has separate broad Bond and Solidify accordion groups containing explanatory readouts; do not wire visual switches that cannot change the simulation.

## Fabric asset versus fabric assignment

**V:** CLO's editor switches to Fabric Property when a **fabric in the Object Browser list** is selected; its physical behavior is adjusted by **Physical Property > Preset** and detailed material properties, and changed simulation exhibits different stretch, bending and drape. The official Property Editor distinguishes this from a selected pattern. [Property Editor](https://support.clo3d.com/hc/en-us/articles/115004877468-Property-Editor), [CLO Designers physical preset explanation](https://support.clo3d.com/hc/en-us/community/posts/4404012517657-Issue-of-puffiness?page=1).

**P:** When pattern selected, show assigned fabric and assignment action. When fabric asset selected, show editable fabric name, preset, physics and optical material properties backed by actual project data. Preserve separation between physical thickness, collision offset, render thickness and optical maps; availability of individual 2026 CLO field labels is **U** until local application inspection.

## Arrangement controls: two separate contexts

**V:** For a **pattern arranged on an avatar via Arrangement Points**, editor Arrangement includes Point Name, Shape Style (flat/curved), Position X, Position Y, Offset, Orientation; **this section is only accessible when the pattern has been arranged with an Arrangement Point**. [Arrangement Property Setting](https://support.clo3d.com/hc/en-us/articles/115002101968-Arrangement-Property-Setting). Avatar **Arrangement Point** editing uses Name, Arrangement BV, X, Y, Offset and Wrap Direction. [Add Arrangement Point](https://support.clo3d.com/hc/en-us/articles/115000430768-Add-Arrangement-Point). Pattern arrangement is based on avatar bounding volumes; a 3D gizmo can fine tune after placement. [Arrange Pattern](https://support.clo3d.com/hc/en-us/articles/115001999287-Arrange-Pattern-with-Arrangement-Points-Flip-Wrap-Direction).

**P:** Maintain `world transform` and `arrangement-point placement` as separate models. EXO's current `stagingOffsetX/Y/Z` fields can serve its internal initial positioning only; they must not be mislabeled as verified CLO Arrangement settings. Display the arrangement point controls only when the relevant relationship exists.

## Implementation order and acceptance criteria

1. **P0 – truthful selection dispatch:** Integrate actual selection type/ID from 2D, 3D and Object Browser; inspector header and fields update when clicking a pattern, one edge, internal line, seam, fabric item or background. Multiple selection shows aggregate/mixed semantics. No unsupported editable controls.
2. **P0 – verified line measurements:** 2D Line Length in cm/mm from true geometry; 3D Line Length from mapped simulated geometry, with unavailable state otherwise; clear whole-pattern perimeter vs segment distinction and source/version label. Test a stretched simulated seam yields differing 2D/3D lengths.
3. **P1 – properties and command binding:** Elastic target and strengths, tape width/preset, sewing tension/fold, with validation and revision-safe native updates. Test that changing a property modifies solver input and a subsequent simulation; disabled fields if capability absent.
4. **P1 – Bond/Solidify/Arrange/fabric:** Implement real physical effects or keep read-only; separate fabric-asset editor from pattern assignment and arrangement-point params from stage transform. Test property round trip through save/load.
5. **P2 – visual parity pass on local CLO:** Open installed CLO, record **Help > About** version, screenshots with one selected pattern, edge, inner line, sewn seam, taped edge, fabric list item, point-arranged pattern, empty 2D/3D background. Record exact accordion headings, numeric bounds, units, disabled behavior, selection highlight colors and context menu commands. Compare to these notes before labeling any additional fields 'CLO exact'.

### Audit warning on certainty

The above field set is directly supported by current and archival **official** documentation, but it is **not a complete inventory of every version-dependent CLO 2026 Property Editor field**. Details for unlisted seam allowances, particle distance, pattern thickness/collision, individual fabric stretch axes, render maps, and exact current group order need direct app capture. The 2026.1 official feature set also evolves (for example new Seamline Rip and adhesive features), so screenshots/version should govern future exact UI parity work.
