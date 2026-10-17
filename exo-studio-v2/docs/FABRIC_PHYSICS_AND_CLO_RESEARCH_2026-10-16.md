# EXO ClothCraft V2 — Fabric science, CLO feature reference, calibration and rendering

**Research date:** 2026-10-16. **Scope:** public CLO documentation, textile measurement standards, graphics practice and a read-only EXO source inspection. **Evidence convention:** “documented CLO behavior” means CLO's published UI/test behavior; “EXO observation” means the inspected repository; “proposed” means engineering guidance; “estimate” means an unverified starting point. Neither published CLO physics presets nor calibration internals are copied here.

## 1. Summary of findings

Fabric realism has **two coupled but independently testable systems**: (1) physical dynamics, whose key inputs are areal mass, anisotropic tensile extension, shear, bending, thickness/collision, friction and energy dissipation, and (2) optical response, which depends on yarn-scale pattern, normal/height, roughness, reflectance, fibers, translucency, side-specific appearance and lights. A physically correct drape can look synthetic if its fiber surface is flat; a photorealistic swatch can still behave like cardboard.

CLO provides configurable fabric physical properties and material maps. Its CLOFAB interface (current published guidance dated September 2026) supports a fabric type, composition and density workflow, adjustable advanced physical properties, generated/scanned PBR maps, preview on cylinder or dummy, and saving fabric with textures. Its legacy Fabric Kit documents weighing, thickness gauging, warp/weft/bias bending and stretch testing. These are **measurement and workflow references**, not evidence that EXO uses CLO's proprietary model or its calibration data.

References: https://support.clo3d.com/hc/en-us/articles/49343947711769-CLOFAB ; https://support.clo3d.com/hc/en-us/articles/360041074334-Fabric-Kit-Manual ; https://support.clo3d.com/hc/en-us/articles/115000483087-Adjust-Stretch-Weft-Warp-Shear

## 2. CLO: what is confirmed publicly

- **Physical axis directions:** CLO names Stretch-Weft, Stretch-Warp and Shear in Fabric > Property Editor > Physical Property > Detail. CLO's guidance says increasing shear resistance changes how easily cotton/denim crease, while softer silk/jersey can use lower resistance. Do not map those slider numbers directly to EXO N/m without an identified calibration experiment. Source: https://support.clo3d.com/hc/en-us/articles/115000483087-Adjust-Stretch-Weft-Warp-Shear
- **Legacy Fabric Kit:** public instructions describe cutting prescribed swatches, weighing multiple samples, thickness using a gauge, three bending orientations (weft, warp, bias) with geometry readings and a stretch force device. Follow the exact instrument manual for swatch sizes/loads rather than improvising its calibration formula. Source: https://support.clo3d.com/hc/en-us/articles/360041074334-Fabric-Kit-Manual
- **CLOFAB (2026):** catalog type/composition/density create an initial behavior, with Advanced Details to inspect/edit. Image maps may be captured or scanned, imported in coordinated filename sets, and saved to a fabric file with available textures. The workflow previews drape as cylinder circle/square or dummy cape. CLO describes integration with its zFab Kit; this does not imply universal interchangeability of measurements from other kits. Source: https://support.clo3d.com/hc/en-us/articles/49343947711769-CLOFAB
- **Material channels:** CLO lists base color, normal, displacement, opacity and reflection-related controls; material appearance can be configured for front/back/side, with front/back different when same-material sharing is disabled. Its PBR map generation covers normal, displacement, opacity, roughness and metalness. Source: https://support.clo3d.com/hc/en-us/articles/360047317454-Set-Fabric-Materials ; https://support.clo3d.com/hc/en-us/articles/33852438561049-PBR-Map-Generator-ver-2024-1
- **Height vs simulator geometry:** CLO's displacement support documents render-only effects in the cited workflow. EXO should likewise explicitly distinguish render displacement from actual collision thickness, unless a physics collision implementation is verified. Source: https://support.clo3d.com/hc/en-us/articles/360025439933-Displacement-Map-ver5-1-0
- **Accuracy claims:** CLO's public FAQ states approximately “90% accuracy” for its own library/Fabric Kit fabrics and cautions arbitrary changes can affect it. That statement has no publicly defined error metric or universal transfer claim; EXO must report its own test-specific measured errors. Source: https://support.clo3d.com/hc/en-us/articles/115013660747-How-accurate-are-virtual-fabrics
- **CLO Fabric Guide:** official downloadable fabric guide is linked from CLO support and discusses physical properties/textures. It is useful for UI terminology, not a license to redistribute private presets. Source: https://support.clo3d.com/hc/en-us/articles/360001436227-CLO-Fabric-Guide

## 3. Canonical EXO SI schema and governing relationships

Use measured material records with **unit-tagged** parameters and full provenance. Store scalar values in SI and convert solely in UI. Recommended representation:

| Quantity | Canonical storage | Display | Method / model meaning |
|---|---|---|---|
| Areal mass `rhoA` | kg/m² | g/m² (GSM) | dry conditioned measured swatch mass divided by area |
| Physical thickness `t` | m | mm | measured at **specified compression pressure**; physical collision thickness separate |
| Extensional stiffness `Kw,Kf` | N/m | N/m | tangent/secant membrane force per width versus engineering strain, at recorded strain/loading |
| Shear stiffness `G` | N/m | N/m | for dimensionless engineering shear strain; state convention/angle |
| Bending rigidity `Dw,Df` | N·m | µN·m | shell plate/membrane energy per area convention; unit depends on exact discretization |
| Fiber direction `theta` | rad | degrees | warp/wale local rotation with UV/pattern pieces |
| Damping | model-dependent | unit-tagged | viscous, Rayleigh, or dimensionless per-step ratio must be distinguished |
| Surface friction `mu` | dimensionless | dimensionless | static/kinetic, cloth-cloth and cloth-avatar tested separately |
| Rest/locked strains | ratio | % | shrinkage and imposed residual strain must not be confused |
| Optical roughness, metalness, sheen | dimensionless | 0–1 | shader parameters, **not** textile mechanical roughness |

**Conversion:** `rhoA[kg/m²] = GSM/1000`, `t[m]=thicknessMm/1000`, `D[N·m]=valueInMicroNewtonMeter × 1e-6`. Example: 460 GSM = 0.460 kg/m²; 1.2 mm = 0.0012 m. Gravitation load per actual fabric area: `q = rhoA × g` N/m², with `g ≈ 9.81 m/s²`.

**Strain and energy, illustrative continuum model:** engineering strain `epsilon=(L-L0)/L0` is dimensionless; surface force per width `N=K epsilon` (N/m) only for a locally linear tensile region; energy per undeformed surface area `U_stretch≈0.5 K epsilon²` (J/m²). For anisotropic fabrics use `U≈1/2 [Kw epsilon_w² + Kf epsilon_f² + G gamma²]`, with extra coupling/nonlinear recovery terms when calibrated. For bending with curvature `kappa` (1/m), `U_bend≈1/2 D (kappa-kappa0)²` (J/m²), hence `D` dimensions N·m. The discrete solver's spring stiffness must be derived from mesh spacing and its specific energy; inserting continuum values blindly changes behavior with tessellation.

**Dynamics:** `M x_ddot + C x_dot + grad(E_stretch+E_shear+E_bend+E_contact+E_seam)=f_external`. Cloth is often nonlinear, especially knit, bias and leather. Compression buckles instead of sharing tensile stiffness; use one-sided tensile response or calibrated buckling. XPBD compliance has dimensions/solver scaling different from stiffness: convert using the implementation's constraint energy and time step, then verify time step and mesh convergence. Friction coefficients belong in the collision/contact model and are distinct from a fabric PBR roughness map.

**Caution:** `stretchWarp:0.12` in defaultProject.js is a ratio-like authoring field, while `warp` in ClothCraft's solver record is N/m. They cannot be assigned to each other by name. Bending coefficients in the default project's `bend:0.68` are authoring/normalized controls and are not N·m. Mechanical simulation thickness should be tested for how collisions actually use the parameter.

## 4. EXO implementation audit as of inspection

| Inspected path | Evidence in code | Gap / action |
|---|---|---|
| `src/data/defaultProject.js` | Initial presets jersey, heavy French terry, rigid denim, silk and interfacing plus poplin/canvas/wool/leather/suede/nylon/linen/knits/velvet/organza/corduroy variants; fields include GSM, `stretchWarp`, `bend`, `thickness`, PBR controls. Variants are explicitly PPF-inspired **estimates**. | Preserve provenance; convert parameter meaning through a named adapter with unit assertions. Do not call authoring values laboratory measurements. |
| `src/core/clothcraftFabrics.js` | Ten material examples with `gsm`, `thicknessMm`, extension %, `shear`, two `bending` directions, source/evidence; `presetProperties` populates `density`, `thickness`, `warp`, `weft`, `shear`, `bend_warp`, `bend_weft`. `FABRIC_FIELDS` lists display conversions. | Some specimen mass/thickness from MIT research dataset, but stiffness and many optical values are **estimates**. Treat derived stiffness as model-dependent; verify `stiffnessForExtension` assumptions and test cases before labeling physically calibrated. |
| `src/core/fabricSurfaceModel.js` | clamps opacity, optical displacement, roughness, metalness, sheen, anisotropy, clearcoat, procedural weave color variation; comments say optical displacement is not collision geometry. | Add calibrated asset metadata: texels per cm, capture illumination, color space, map channel conventions, tangent sign and scale. |
| `src/components/FabricMaterialPreview.jsx` | Three.js `MeshPhysicalMaterial` preview, generated/file texture channels including base/normal/roughness/metalness/opacity/displacement. | Verify UV orientation and equal physical repeat across pieces, proper linear-vs-sRGB decoding, normal strength, physically plausible fiber sheen under multiple light setups. |
| `src/core/clothcraftFabricSurface.js` | separate ClothCraft material initializes roughness/sheen from `appearance` and grain angle. | Compare resulting viewport appearance to richer preview: material parity and import behavior need visual regression. |
| `native_cpp/core/fabric_surface.cpp` | native PBR normalization/naming support exists. | Validate both native and browser paths agree for every map and unit conversion. |

No source inspection by itself proves the cloth solver reproduces laboratory tensile/shear curves, geometric pile, leather hysteresis, fabric self-contact under load, or all maps in live garment rendering. Those require the tests below.

## 5. Measurement and calibration protocol

1. **Identify each physical sample:** manufacturer, SKU/lot, fiber %, blend, weave/knit type, finish, washed/unwashed, actual dye shade, fabric face/back, sample orientation and date. Condition swatches under a specified measured humidity and temperature; record them for repeatability.
2. **Measure areal mass and thickness:** cut multiple known-area swatches, weigh with calibrated scale, measure under stated compressive force/foot area. Save mean, standard deviation and raw samples; thickness is pressure dependent particularly for terry, fleece and suede.
3. **Tensile and recovery:** measure warp/weft (or wale/course) force-versus-extension at *several* low-strain loads, then unload/reload to measure hysteresis and residual strain. A single “stretch %” without force and recovery is insufficient.
4. **Bias and shear:** conduct bias-extension or dedicated shear rig with specimen geometry, pretension and angle recorded. Calibrate against observed folds, not the texture image. Distinguish bias extension from a pure-shear modulus.
5. **Bending:** separate warp/weft/bias cantilever or low-force tester; capture bend length, fold direction and recovery. ASTM D1388 measures bending length/flexural rigidity. For napped/coated textiles, compare face-in/face-out if asymmetric.
6. **Contact:** inclined-plane or pull tests for fabric/fabric and fabric/skin surrogate under known load; record static, kinetic, grain-direction and fabric-back differences. Collar/hood contact is sensitive to friction.
7. **Validation geometry:** circular drape over pedestal, 20–30 cm hanging strip, controlled bias-square, fold compression test and a standard T-shirt/sweatshirt on a fixed avatar. Record camera, lighting, scale, swatch orientation, garment size and sewing.
8. **Fit parameters:** optimize mass/thickness directly from measurement; fit directional tensile/shear curves before bending and damping, then tune contact friction. Use held-out drape tests to check against overfitting; never optimize appearance parameters to disguise mechanical errors.
9. **Quantify accuracy:** report silhouette mean boundary distance (mm), static hem depth (mm), curvature distribution, number and wavelength of folds, shoulder/chest strain, dynamic oscillation decay (s), penetration counts/depth (mm), and runtime. Compare same avatar, gravity, mesh resolution, seam pattern and camera.
10. **Convergence & reproducibility:** test mesh spacing (e.g. 20, 10, 5 mm), time step and solver iterations; record build commit, machine, physics backend, parameter file and random seed. Values should remain within selected tolerances after refinement.

Standards/references: https://store.astm.org/standards/d1388 ; https://textiles.ncsu.edu/tpacc/comfort-performance/kawabata-evaluation-system/ ; https://research.hva.nl/en/publications/white-paper-ieee-industry-connections-ieee-ic-the-measurement-of-/ ; https://support.clo3d.com/hc/en-us/articles/360041074334-Fabric-Kit-Manual

### Proposed acceptance targets (engineering goals, NOT achieved results)

- Schema round-trip: no unit loss; mechanically identical after save/load to within 1e-6 relative for numeric SI values.
- Uniform-cloth swatch gravity: measured areal mass within scale uncertainty; static silhouettes target ≤ 10 mm mean deviation on controlled mid-size swatches **after calibration**.
- Directional tests: reproduce force-vs-extension within 15% at defined strain points where instrument uncertainty permits, and report outliers; at least three repeats per orientation.
- Bend and folds: target 15% error in mean bend length and fold wavelength; explicitly compare warp and weft.
- Mesh convergence: selected observable drift ≤ 5% between the two finest practical discretizations; no explosive motion or systematic penetration.
- Render: check scale accuracy to 1 mm over 100 mm of fabric detail, no base-color or normal map seams under standardized grazing light. Visual review remains necessary.

Targets can be tightened after collecting actual cloth and experimental evidence. Relative thresholds are not claims about achieved commercial accuracy.

## 6. Material-specific physical and rendering requirements

**Cotton plain weave / poplin:** relatively low extension on yarn axis, larger diagonal shear; visible spun fiber irregularity and balanced fine plain weave. Use actual yarn count/repeat scale; natural matte diffuse reflectance and modest fiber sheen. Typical use cases: poplin shirts, canvas garments, oxford. Canvas generally requires greater areal mass and bending stiffness than poplin, but values depend strongly on finishing and weight.

**Denim (rigid and stretch):** anisotropic warp-faced twill; indigo warp / pale weft color separation is critical in closeups. Warp/weft/bias stiffness and directional fold response; rigid variants generally extend less than elastane stretch variants. Render diagonal ribs, subtle warp slubs, seam abrasion, fading concentrated around creases and garment stitching. Texture wear maps should be aligned to the pattern grain, never generated randomly per triangle. Stretch denim must have measured recovery and time-dependent behavior; do not assume any denim preset describes every wash.

**French terry / fleece:** knit jersey face plus loop pile backside (or brushed fleece); higher loft and compressibility, directional stretch and recovery, surface friction dependent on side. Represent face and backside separately, back loop normals/height, thick hemlines, ribbed cuffs and realistic compression around seams. A flat single normal on both sides will misrepresent this fabric. Measure thickness under load; pile optical displacement cannot replace bulk contact mechanics.

**Jersey / rib knit / interlock:** more anisotropic extension and nonlinear elastic recovery than typical woven fabrics. Jersey stitch and rib wales need real physical repeat. Ribbed cuffs recover elastically and contract under extension; add calibrated stitch/cuff rest dimensions, not shader-only ridges. Simple membrane shell does **not resolve individual knit loops**; microstructure is approximated through effective anisotropic constitutive behavior.

**Wool suiting / melton:** wool suiting has variable bending and recovery due to weave and pressing. Melton is densely felted/fuller with soft diffuse surface and thick edge. Highlight fiber flyaway and subtle broad sheen; avoid aggressive large-scale normal noise. Coats may need laminated/interfacing zones.

**Leather (nappa, lambskin, cowhide):** tanned hide is not a woven cloth. It may have substantial nonlinear stiffness, anisotropy, plastic set, grain-dependent folding, limited rebound and material-specific friction. Treat top grain, finish, pores, creases, natural variation and cut direction as independent data; separate smooth finished top face from flesh side. Shader clearcoat describes coatings, not a universal “leather gloss.” A generic thin-shell solver approximates leather response but does not simulate damage, cracking, delamination or permanent creasing until explicitly implemented.

**Suede / nubuck:** napped fiber response, soft broad specular lobes, highly directional visible nap and color change with brushing. Use tangent-aligned fiber anisotropy, micro-normal structure, fine fuzz/sheen, direction-sensitive reflectance and a face/back distinction. Artificially raising roughness to 1 without nap direction is insufficient. Suede thickness and friction depend on surface/finish and conditioning.

**Silk satin / twill / chiffon / organza:** satin highlights require correct low-frequency anisotropic reflectance orientation and small-scale yarn maps. Chiffon/organza need appropriate porosity/opacity, two-sided shading, thin silhouette treatment and collision separate from transparency. Organza can be optically sheer yet mechanically comparatively crisp. Do not infer bending stiffness from transparency.

**Nylon, ripstop, softshell:** capture ripstop reinforcement cell pitch, coated-surface specular and dye variation. Lightweight mass does not imply a universal low bending value (coatings alter folds). Softshell may be multi-layer; effective bulk properties should be measured for the stack. Rain beading/wetness is optional optical behavior, independent from PBR dry fabric and cannot prove waterproofness.

**Velvet / corduroy:** fiber pile anisotropic lobe and fold-dependent shade changes. Corduroy directional wales should have physical pitch; velvet piles need view-angle-dependent fiber shading. Thick pile collision is an approximation unless contact geometry includes loft.

**Interfacing / padding / bonded composites:** use explicit layered laminate material properties (areal mass total, directional rigidities, adhesive coupling, thickness), bonding location and seam constraints. For trapunto padded hoodie segments, panel-scale quilt stitches and internal loft controls are required; optical bump alone cannot reproduce puff volume or compression.

**Hardware:** metal buttons, snaps, eyelets and rivets need real object geometry, attachment constraints, collision and correct metal/roughness workflows. Zippers need tape stiffness, tooth/slider geometry, seam coupling and state (open vs closed). Plastic button transmissivity and brushed metal anisotropy are appearance controls. Hardware mass and pendulum motion must be modeled separately from the cloth. Distinguish rendered trims from verified functional physics.

## 7. Optical map pipeline and QA

**Capture:** photograph/scans with a ruler, diffuse cross-polarized albedo capture where possible, and multi-directional directional lighting for height/normal reconstruction. Include face/back swatches, color checker and neutral white balance. Store ICC/color-space provenance, sample dimensions, texture repeats and rights/source. A photo under directional light already includes shadows and highlights, so directly using it as base color tends to double-light the fabric.

**Channel semantics:**
- **Base color/albedo:** sRGB texture transformed into linear working space; remove baked specular/shadow and retain authentic yarn color variation.
- **Normal:** tangent-space linear map, document OpenGL/DirectX green channel polarity, ensure grain direction transforms correctly with 2D panel rotations/mirror/UV.
- **Height/displacement:** linear meters or millimeters per authored amplitude, visual geometry only unless solver explicitly uses it; verify edges and silhouette.
- **Roughness / metalness / ambient occlusion / opacity:** linear scalar textures, calibrated roughness distribution, metalness ~0 for uncoated textiles. Metallic threads and metal studs are separate materials. AO shouldn't darken base color twice; opacity can cause depth sorting issues.
- **Sheen / anisotropy / clearcoat:** artist controls with material-specific justification; physically sensible fiber orientation varies over cut pieces and backfaces.
- **Maps at scale:** store real-world `texelsPerMeter` or `repeatWidthM`/`repeatHeightM`. Clothing pattern UVs represent centimeters, not arbitrary model-scale repetition. Add seam-consistent UV orientation and per-panel grain transform.

**Rendering tests:** calibrated neutral HDRI and raking side light, daylight plus tungsten, rotating turntable, light/dark swatches, flat vs draped images, 1 cm and 10 cm closeups; white diffuse sphere plus gray reference; normal-only and roughness-only debug. Compare live viewport, fabric preview, export (Blender/glTF, if supported) and any native renderer for parity. Check glTF channel conventions before exporting. Avoid using random tiled high-frequency normals that shimmer at distance: mipmapping, anisotropic filtering and correct LOD are essential.

Official optical sources: https://support.clo3d.com/hc/en-us/articles/360047317454-Set-Fabric-Materials ; https://support.clo3d.com/hc/en-us/articles/33852438561049-PBR-Map-Generator-ver-2024-1 ; https://support.clo3d.com/hc/en-us/articles/360025439933-Displacement-Map-ver5-1-0

## 8. Recommended engineering milestones

**M1 — provenance and units.** Define `MaterialSpec v1`: unique IDs, family, face/back materials, areal density, measured thickness and pressure, warp/weft/shear force curves, directional bending, static/dynamic friction, grain angle, source license, measured/estimated flag and uncertainty. Keep a versioned adapter from editor presets and ClothCraft native fabrics. No silent unit coercion.

**M2 — sample-driven physics.** Acquire/populate 2–3 specimens each of jersey, heavyweight French terry, rigid/stretch denim, garment nappa leather, suede, canvas, wool and nylon. Produce measured low-strain curves. Extend solver constitutive support only after baseline comparison; check mesh dependence and fabric hand interaction against test strips.

**M3 — optical texture library.** Capture 4K+ (where justified by physical repeat, not resolution alone) tileable face/back swatches; author true-scale PBR and nap-direction fields. Maintain distinct geometry, physics and render asset references. Add glTF and Blender material conversion tests.

**M4 — trims and multilayers.** Validate attachment, fabric-hand dragging, buttons and zipper tape on garments. Add lining, interfacing and padding behavior, then quantify collision/contact. Record unresolved constraints on the project progress hub.

**M5 — garment reference benchmark.** Photograph physical T-shirt, French terry hoodie, denim jacket and leather panel garment on matched form; simulate same authored patterns and published measurement records. Compare drape and render independently, then run controlled user visual reviews.

## 9. Documentation/source and licensing cautions

A KES system measures bending, tensile, compression and shear, but its result units and acquisition conventions are not automatically compatible with a CLO Fabric Kit, other commercial solvers or EXO. An IEEE/HvA comparison reviews the shortcomings of cross-system fabric measurement and highlights the need for standardization. See: https://textiles.ncsu.edu/tpacc/comfort-performance/kawabata-evaluation-system/ ; https://research.hva.nl/en/publications/white-paper-ieee-industry-connections-ieee-ic-the-measurement-of-/ .

For research specimens and sample metadata, EXO cites the MIT material dataset (https://people.csail.mit.edu/klbouman/pw/projects/materialproperties/dataset.html). Read its reuse terms and actual measurement rows before republishing data. EXO's `clothcraftFabrics.js` states clearly that a number of mass/thickness values have a measured source but elasticity/bending and optics are estimated; retaining that distinction is mandatory.

CLO's UI, article descriptions and public fabric science inform functional requirements; proprietary presets, kit conversion algorithms, textures and other restricted assets are not assumed accessible or reusable. No numerical EXO simulation error or fabric match is claimed here without sample tests and repeatable outputs.

## 10. Primary reference index

1. CLO, *CLOFAB* (2026): https://support.clo3d.com/hc/en-us/articles/49343947711769-CLOFAB
2. CLO, *Fabric Kit Manual*: https://support.clo3d.com/hc/en-us/articles/360041074334-Fabric-Kit-Manual
3. CLO, *Adjust Stretch Weft/Warp, Shear*: https://support.clo3d.com/hc/en-us/articles/115000483087-Adjust-Stretch-Weft-Warp-Shear
4. CLO, *Set Fabric Materials*: https://support.clo3d.com/hc/en-us/articles/360047317454-Set-Fabric-Materials
5. CLO, *PBR Map Generator*: https://support.clo3d.com/hc/en-us/articles/33852438561049-PBR-Map-Generator-ver-2024-1
6. CLO, *Displacement Map*: https://support.clo3d.com/hc/en-us/articles/360025439933-Displacement-Map-ver5-1-0
7. CLO, *CLO Fabric Guide*: https://support.clo3d.com/hc/en-us/articles/360001436227-CLO-Fabric-Guide
8. ASTM D1388, *Stiffness of Fabrics*: https://store.astm.org/standards/d1388
9. NC State T-PACC, *Kawabata Evaluation System*: https://textiles.ncsu.edu/tpacc/comfort-performance/kawabata-evaluation-system/
10. IEEE/HvA, *Measurement of Fabric Properties for Virtual Simulation — Critical Review*: https://research.hva.nl/en/publications/white-paper-ieee-industry-connections-ieee-ic-the-measurement-of-/
11. MIT, *Fabric Material Properties Dataset*: https://people.csail.mit.edu/klbouman/pw/projects/materialproperties/dataset.html
12. Ji, Li, Qiu (2006), *Dynamic Draping Behavior of Woven and Knitted Fabrics*: https://journals.sagepub.com/doi/10.1177/1528083706055753

## 11. Implementation completed in this pass

The expanded physical/optical library is present in the running application source, not only on a roadmap:

| Component | Working integration | Measurement/realism limit |
|---|---|---|
| `src/data/apparelMaterialExpansion.js`, `defaultProject.js` | Added 57 named construction-based examples to existing preset IDs, bringing the React fabric menu to **80 presets**. App fabric library is searchable/grouped and swatches can be assigned to 2D pieces for use by the 3D editor. | New GSM, thickness, extension, bend and finish values are explicitly **unmeasured estimates**; a fabric name is not a universal constitutive law. |
| `src/core/clothcraftFabrics.js`, `ClothCraftFabricLibrary.jsx` | Rust workspace selector contains **66 examples** with membrane stiffness, shear, two bending directions, mass, thickness, and grain-relative appearance. Fabric edits retain the Rust project's save/undo path. | Browser `bend` is dimensionless while native stiffness/bending values are model-specific SI-like parameters. Conversion between solvers is heuristic, not physically established or CLO-compatible. |
| `src/core/textileProcedurals.js`, `clothcraftFabricSurface.js` | Differentiated procedural surface relief for common woven/knit/pile constructions, denim twill, leather grain, suede nap, synthetic mesh, bouclé and more. Native materials now get a neutral pigment-variation tile alongside bump with controlled material roughness, sheen and anisotropy. | These are artistic/surface mathematical approximations. They are **not** photographic scan assets, individual loop/yarn simulation, measured BRDF/BTDF or calibrated 3D pile volumes. |
| `src/core/fabricCalibration.js` and `ClothCraftFabricLibrary.jsx` | An interactive strip test calculator converts actual input width/gauge length, warp/weft force and elongation to a small-strain effective tension modulus in N/m; result may be assigned to native material. Pure helper also computes mass, shear estimate, cantilever bending estimate and incline friction. | Native nonlinear solver parameter meanings require fixture calibration; one-point force tests cannot capture hysteresis, anisotropic coupling or nonlinear plasticity. |
| `src/data/hardwarePresets.js`, `src/App.jsx`, `GarmentViewport.jsx` | **18** buttons/buttonholes/zippers/snaps/rivets/buckles reference objects. Three supported annotation families are selectable in Sewing and asset library; buttons have disc/hole geometry, face-aligned placement and shader finish. | Snap/rivet/buckle placement and rigid physics, zipper interlocking teeth and button-thread behavior remain to be implemented. Dimensions are generic estimates, not supplier specifications. |
| `scripts/check-apparel-catalog.mjs`, existing checks | Catalog uniqueness, finite physics values, rendering map objects, SI conversion examples and hardware annotations checked; build, material, buttonhole and factory checks can be run independently. | Programmatic tests cannot substitute for comparative physical drape, spectrophotometer/color management or 3D scan fidelity. |

**Next calibration priority:** obtain physical samples for heavyweight cotton French terry, 12–14 oz rigid denim, 2% elastane stretch denim, garment nappa leather and sanded suede. Record specimen manufacturer/fiber content, areal mass, thickness under specified test pressure, 3–5 warp/weft/bias force-extension readings per sample, independent bending/shear experiments, static sliding surface pair, neutral light PBR captures and seam/crease recovery after cycles. Tie each experimental dataset to one immutable preset ID and display a calibrated/estimated indicator. Nothing in this pass establishes full CLO library equivalence.
