# Garment Studio UI audit — 42 left / 34 right

**October 13, 2026.** The left inventory was retrieved from the **rendered browser DOM** at 1530×950; the right inventory was extracted from the palette source. These are **actual Garment Studio controls**, not a claim that all are complete or that the user's CLO toolbar uses the same 76 commands. CLO 2026.1 permits grouped, rearranged, and hidden tool sets.

**Official CLO manuals:** [Customize Toolbar](https://support.clo3d.com/hc/en-us/articles/59637467539225-Customize-Toolbar), [Object Browser](https://support.clo3d.com/hc/en-us/articles/115000374247-Object-Browser), [User Interface](https://support.clo3d.com/hc/en-us/articles/360001547128-User-Interface), [Move/Rotate Gizmo](https://support.clo3d.com/hc/en-us/articles/115000513928-Move-Rotate-Pattern-with-Gizmo), [Particle Distance](https://support.clo3d.com/hc/en-us/articles/115012227227-Particle-Distance).

## Left toolbar — 42 actually rendered buttons

| # | Tooltip / command | UI enabled | Tool completeness |
|---:|---|---|---|
| 1 | Simulate / pause · Space | Yes | UI handler only; semantic accuracy requires per-tool acceptance tests |
| 2 | Simulation modes · top left | Yes | UI handler only; semantic accuracy requires per-tool acceptance tests |
| 3 | 3D fabric hand tool | Yes | UI handler only; semantic accuracy requires per-tool acceptance tests |
| 4 | 3D move garment | Yes | UI handler only; semantic accuracy requires per-tool acceptance tests |
| 5 | 3D rotate selected fabric | Yes | UI handler only; semantic accuracy requires per-tool acceptance tests |
| 6 | Toggle sewing guides in 3D | Yes | UI handler only; semantic accuracy requires per-tool acceptance tests |
| 7 | Toggle garment mesh wireframe | Yes | UI handler only; semantic accuracy requires per-tool acceptance tests |
| 8 | Strain map | Yes | UI handler only; semantic accuracy requires per-tool acceptance tests |
| 9 | Select / move | Yes | UI handler only; semantic accuracy requires per-tool acceptance tests |
| 10 | Edit points | Yes | UI handler only; semantic accuracy requires per-tool acceptance tests |
| 11 | Split edge / add point | Yes | UI handler only; semantic accuracy requires per-tool acceptance tests |
| 12 | Curve edges | Yes | UI handler only; semantic accuracy requires per-tool acceptance tests |
| 13 | Internal line / dart | Yes | UI handler only; semantic accuracy requires per-tool acceptance tests |
| 14 | Manual cloth pin | Yes | UI handler only; semantic accuracy requires per-tool acceptance tests |
| 15 | Add notch | Yes | UI handler only; semantic accuracy requires per-tool acceptance tests |
| 16 | Sew edges | Yes | UI handler only; semantic accuracy requires per-tool acceptance tests |
| 17 | Button / snap / hook fastener | Yes | UI handler only; semantic accuracy requires per-tool acceptance tests |
| 18 | Tape measure | Yes | UI handler only; semantic accuracy requires per-tool acceptance tests |
| 19 | Add pattern | Yes | UI handler only; semantic accuracy requires per-tool acceptance tests |
| 20 | Delete selected | Yes | UI handler only; semantic accuracy requires per-tool acceptance tests |
| 21 | Compact / expanded toolbar | Yes | UI handler only; semantic accuracy requires per-tool acceptance tests |
| 22 | Show or hide 2D drafting grid | Yes | UI handler only; semantic accuracy requires per-tool acceptance tests |
| 23 | Show or hide 2D sewing links | Yes | UI handler only; semantic accuracy requires per-tool acceptance tests |
| 24 | Open fabric properties | Yes | UI handler only; semantic accuracy requires per-tool acceptance tests |
| 25 | Open avatar properties | Yes | UI handler only; semantic accuracy requires per-tool acceptance tests |
| 26 | Open sewing inspector | Yes | UI handler only; semantic accuracy requires per-tool acceptance tests |
| 27 | Open selected pattern properties | Yes | UI handler only; semantic accuracy requires per-tool acceptance tests |
| 28 | Open fitting and simulation controls | Yes | UI handler only; semantic accuracy requires per-tool acceptance tests |
| 29 | Open production and grading | Yes | UI handler only; semantic accuracy requires per-tool acceptance tests |
| 30 | Open renderer settings | Yes | UI handler only; semantic accuracy requires per-tool acceptance tests |
| 31 | Frame avatar in 3D | Yes | UI handler only; semantic accuracy requires per-tool acceptance tests |
| 32 | Duplicate selected pattern | Yes | UI handler only; semantic accuracy requires per-tool acceptance tests |
| 33 | Create mirrored pattern copy | Yes | UI handler only; semantic accuracy requires per-tool acceptance tests |
| 34 | Show or hide object browser | Yes | UI handler only; semantic accuracy requires per-tool acceptance tests |
| 35 | Browse fabric assets | Yes | UI handler only; semantic accuracy requires per-tool acceptance tests |
| 36 | Browse garment templates | Yes | UI handler only; semantic accuracy requires per-tool acceptance tests |
| 37 | Open topstitch object browser | Yes | UI handler only; semantic accuracy requires per-tool acceptance tests |
| 38 | Open button object browser | Yes | UI handler only; semantic accuracy requires per-tool acceptance tests |
| 39 | Open trims and zipper browser | Yes | UI handler only; semantic accuracy requires per-tool acceptance tests |
| 40 | Open size grading browser | Yes | UI handler only; semantic accuracy requires per-tool acceptance tests |
| 41 | Open points-of-measure browser | Yes | UI handler only; semantic accuracy requires per-tool acceptance tests |
| 42 | Inspect garment pressure distribution | Yes | UI handler only; semantic accuracy requires per-tool acceptance tests |

## Right toolbar — 34 actual positions

| # | Tool name | Current implementation | Icon style |
|---:|---|---|---|
| 1 | Select 3D fabric | UI action wired: orbit | Original Lucide MousePointer2 |
| 2 | Move 3D fabric | UI action wired: move | Original Lucide Move3D |
| 3 | Rotate 3D fabric | UI action wired: rotate | Original Lucide Rotate3d |
| 4 | Fabric hand | UI action wired: hand | Original Lucide Hand |
| 5 | Surface / strain view | UI action wired: analysis | Original Lucide Activity |
| 6 | Toggle mesh wireframe | UI action wired: wireframe | Original Lucide Grid3X3 |
| 7 | 3D sewing correspondence | UI action wired: seams | Original Lucide Link2 |
| 8 | 2D pattern select | UI action wired: select | Original Lucide MousePointer2 |
| 9 | Edit pattern points | UI action wired: point | Original Lucide PenTool |
| 10 | Split pattern edge | UI action wired: split | Original Lucide Plus |
| 11 | Adjust pattern curve | UI action wired: curve | Original Lucide Spline |
| 12 | Internal line / dart | UI action wired: internal | Original Lucide Scissors |
| 13 | Pattern notch | UI action wired: notch | Original Lucide Scan |
| 14 | Tape measure / ruler | UI action wired: measure | Original Lucide Ruler |
| 15 | Cloth pin | UI action wired: pin | Original Lucide MapPin |
| 16 | Free sewing | UI action wired: sew | Original Lucide Link2 |
| 17 | Button or snap fastener | UI action wired: fastener | Original Lucide CircleDot |
| 18 | Fabric browser | UI action wired: Fabric | Original Lucide Shirt |
| 19 | Graphic browser | UI action wired: Graphic | Original Lucide Image |
| 20 | Button browser | UI action wired: Button | Original Lucide CircleDot |
| 21 | Buttonhole browser | UI action wired: Buttonhole | Original Lucide StretchHorizontal |
| 22 | Topstitch browser | UI action wired: Topstitch | Original Lucide Spline |
| 23 | Trims / zipper | UI action wired: Trim | Original Lucide Palette |
| 24 | Grading browser | UI action wired: Grading | Original Lucide Grid2X2 |
| 25 | Points of measure | UI action wired: POM | Original Lucide List |
| 26 | Scene hierarchy | UI action wired: Scene | Original Lucide Layers3 |
| 27 | Fabric physical properties | UI action wired: fabric-edit | Original Lucide SlidersHorizontal |
| 28 | Fit analysis | UI action wired: fit | Original Lucide Activity |
| 29 | Simulate / pause | UI action wired: simulate | Original Lucide Play |
| 30 | Reset flat arrangement | UI action wired: reset | Original Lucide RotateCcw |
| 31 | Fit 3D view | UI action wired: camera | Original Lucide Focus |
| 32 | Create mirrored pattern copy | UI action wired: mirror-pattern | Original Lucide FlipHorizontal2 |
| 33 | Export garment file | UI action wired: export | Original Lucide Download |
| 34 | Physical seam-closure tool | PLANNED / disabled | Original Lucide Box |

## CLO feature crosswalk and readiness

1. **Pattern CAD**: move/select, edit points/curves, split edges, internal lines/darts, notch and tape measurement require exact editing semantics and valid 2D pattern geometry. The current 2D editor implements representative operations, not every CLO specialized tool.
2. **3D panel arrangement**: divided translate/rotate gizmos, camera orbit and preset axes are implemented. Precise avatar arrangement points, pose-aware collision, gravity-staged sewing and physically accurate simulation are incomplete.
3. **Sewing**: seam graph and corresponding 2D/3D endpoints exist. Sewing flat panels into a closed garment currently uses a **visual staging transition into a wrapped solver pose**, not full physical seam closure from flat panels.
4. **Fabric**: selected-fabric preview, GSM, thickness, warp and weft stretch/shrink are represented; exact measured mechanical calibration (bend hysteresis, shear modulus and static/dynamic friction) remains unvalidated.
5. **Object Browser**: CLO documents Scene, Fabric, Graphic, Button, Buttonhole, Topstitch, Puckering, Trim, Grading and POM. All ten tabs are present; specific operations on some objects are not implemented beyond navigation.
6. **Property Editor**: selected pattern name, area, perimeter, vertices, seam links, thickness, shrinkage, seam allowance and cloth subdivision are readable. A true user-specified **particle distance in mm** requires length-targeted adaptive mesh generation and numerical validation. The current slider controls mesh *subdivision level* instead; it is not interchangeable with CLO's mm control.

## Tool acceptance contract

Every command needs (a) tooltip and active/disabled state, (b) test click modifies expected model, (c) undo/redo, (d) persistence in saved project, (e) geometry or simulation correctness against fixtures and real garment references, (f) multi-OS automated tests, and (g) documentation/tutorial. Merely opening an inspector passes only part (a). Audit against the actual target CLO installation with tool grouping disabled to map exact names/shortcuts.

## Intellectual property and icon policy

Do not extract or ship proprietary CLO application resources, toolbar icon sprite sheets or CLO logo artwork without explicit redistribution rights. Public screenshots and documentation can inform functional descriptions; draw original SVG icons with separate asset/source licensing. Our current 76 rendered icons use Lucide, Unicode and our own vector glyphs. Include all third-party licenses and notices before publishing. The exact layout of CLO toolbars changes with product version and user preferences; one-to-one UI resemblance alone is not proof of capability parity.
