# EXO Sample 3D: UI Rendering, Studio Viewport, and Avatars

> Engineering guide based on the source tree on 15 October 2026. The desktop viewport and avatars are actively developed. Documented render behavior is implemented unless specifically marked experimental. A visually plausible dressed body is not evidence of clinically accurate measurements or production fit.

## Contents

1. [UI architecture and data ownership](#ui-architecture-and-data-ownership)
2. [The actual rendering stack](#the-actual-rendering-stack)
3. [Lighting and studio presentation](#lighting-and-studio-presentation)
4. [Camera and interaction](#camera-and-interaction)
5. [Floor grid and world origin](#floor-grid-and-world-origin)
6. [Public avatar sources](#public-avatar-sources)
7. [Analytic versus mesh collision](#analytic-versus-mesh-collision)
8. [Viewport performance and visibility](#viewport-performance-and-visibility)
9. [Capture, demonstrations, and privacy](#capture-demonstrations-and-privacy)
10. [Next rendering milestones](#next-rendering-milestones)
11. [Acceptance matrix](#acceptance-matrix)

## UI architecture and data ownership

The browser application starts in `src/main.jsx`, enters `src/App.jsx`, and composes its workspace through `src/components/CloUI.jsx`. The principal two-dimensional authoring and three-dimensional presentation components are `PatternEditor.jsx` and `GarmentViewport.jsx`. `RightToolPalette.jsx`, `ViewportQuickTools.jsx`, `WorkspaceCommandPalette.jsx` and `PropertyCategoryNavigator.jsx` provide supporting interaction. Styling lives in `src/styles.css`, `src/clo-interface.css` and `src/clo-neutral-theme.css`. The browser's React controls own high-level user intent; the Three.js scene is a derived view of garment and avatar state.

This division is important. A camera orbit does not alter the garment's sewing geometry. Moving a displayed panel with a manipulator can affect its arrangement or simulation pose and therefore requires a deliberate state transition. Changing a studio background does not change the body dimensions used for contact. Implement future tools by first deciding whether they modify a canonical project field, a temporary scene interaction, or a render-only setting.

The `project` includes pieces, seams, materials, avatar and simulation settings. `src/core/project.js` supplies geometry and revision utilities, while `src/core/physics.js`, `src/core/staging.js` and `src/core/meshAvatarContact.js` translate that state into displayed or simulated form. The imported visual avatar must not silently redefine the authored body's collision shape. A source image of a garment does not replace a measured pattern, and viewport transformations must preserve this distinction.

## The actual rendering stack

`GarmentViewport.jsx` imports Three.js, `OrbitControls`, `TransformControls` and GLTF/OBJ loaders. On mounting, it builds a `THREE.Scene`, a perspective camera, and a `WebGLRenderer` with antialiasing, `powerPreference: 'high-performance'`, and `preserveDrawingBuffer: true`. Its pixel ratio is limited to twice the device pixel ratio cap, reducing GPU pressure on high-density displays. Its render loop updates the scene and draws the current frame. The component disposes render resources, removes event handlers, and removes its canvas at teardown.

Verified default configuration includes `renderer.shadowMap.enabled = true`, `THREE.PCFSoftShadowMap`, `THREE.SRGBColorSpace`, `THREE.ACESFilmicToneMapping`, and an initial `toneMappingExposure` of `1.1`. These are presentation settings, not fabric measurements. Tone mapping compresses highlight intensity into the display range; sRGB output controls display encoding. Differences in monitor calibration, operating system color management, browser implementation, screenshot compression, and exposure can make identical fabric settings appear dissimilar.

The backdrop is constructed as a generated gradient on a canvas, assigned to a `CanvasTexture` tagged as sRGB. This is a deliberate neutral studio appearance rather than a photographic image or proprietary visual asset. The scene also uses an environment reflection resource generated via `PMREMGenerator`. `studioEnvironmentRef` and `customEnvironmentRef` distinguish default studio reflection from custom environment input. The renderer's environment preset and exposure update through React effects. The background is kept separate from the lighting environment so a photographic reflection source need not replace the neutral visible backdrop.

The scene uses a procedural gray floor and grid, which help communicate scale, contact and grounding. Garment material PBR maps are applied per panel, while the avatar has its own display material. A selected garment or mesh can have manipulator geometry, orientation guides and visual debugging. These layers are scene content and should be individually toggled or excluded when producing presentation screenshots.

## Lighting and studio presentation

The current studio scene adds a hemisphere light with white upper and cool-gray lower illumination, intensity `1.85`. A warm-neutral key directional light is placed at approximately `(2.5, 4.5, 3.1)`, intensity `2.6`, and casts a 2048×2048 shadow map. A cooler rim directional light at `(-3, 2, -2.5)`, intensity `0.85`, separates garment edges and avatar silhouette from the background. A circular gray standard-material floor receives shadows.

This key/rim setup is suitable for technical garments because seams, convex folds, and material roughness need directional gradients to become visible. It can also obscure deep-black materials if the exposure is poorly chosen or exaggerate sheen under a bright key. A credible studio render should include a lighting reference and retain midtone contrast in both white and black cloth. For reproducible before/after images, fix exposure, camera distance, background, garment color, fabric preset and light configuration.

The source contains `environmentPreset` handling, including a `studio` configuration with the values above. Its settings effect clamps exposure to `0.2–4`. That is a UI bound, not a recommendation for such wide exposure variation in published benchmarks. Compare optical materials under both neutral diffuse light and a highlight-producing environment. An extremely glossy garment may look accurate in one environment and unrealistic in another; use more than one lighting test before accepting a material change.

Future lighting work should add stable, named photograph-style rigs such as softbox, high-key, black-on-black edge-light and flat calibration. Each preset should store its lights, environment, background, exposure and shadow quality. Avoid changing the defaults silently between promotional captures; otherwise improvements may merely reflect different lighting. Document the preset for each benchmark image.

## Camera and interaction

The current viewport initializes a `PerspectiveCamera` with field of view `34°`, near plane `0.02` meters and far plane `30` meters. `ResizeObserver` updates canvas dimensions, aspect ratio and projection matrix when the mount resizes. `OrbitControls` supplies camera inspection. `TransformControls` and additional pointer interaction code allow piece manipulation. The code records certain interaction states and tests through dataset attributes on the canvas, including rotation drag axis, simulated pose edit and movement signals.

The camera should be thought of as a measurement-neutral lens. Orbiting does not alter a garment's construction or body shape; changing FOV changes perspective and may exaggerate silhouette differences. For comparability, the studio should eventually define pinned views: front, back, left/right side, three-quarter and a calibrated perspective. An orthographic view can support shape measurements better than a perspective image, but does not replace numerical POM values. Store camera target, distance, projection type, zoom, viewport dimensions and exposure with a capture manifest.

Pointer interactions require careful input priority. The viewport currently handles fabric interaction, a ring rotation gesture and mesh selection, along with internal event capture and pointer release. New gizmos should not interfere with orbit, selection, cloth grabbing or ordinary drawing gestures. Tests should exercise drag start/move/end, cancel, loss of focus, resizing mid-drag and switching tools during an active gesture. Record whether movement changes the authored `arrangement3d`, a solver particle state or only a preview object.

## Floor grid and world origin

The current floor is a `CircleGeometry(3.2, 96)`, rotated horizontally and placed slightly below world origin. A `GridHelper(5.5, 22)` sits at `y = 0.002`. The light-gray grid and subdued floor are neutral reference geometry, not image assets requiring external attribution. A world-center group named `garment-world-center-axes` adds a stronger `x = 0` line across the floor and a faint vertical line from `y = 0` to `y = 2.25`. These origin guides live under the grid toggle. The source explicitly notes they do not change cloth physics.

This is useful for both demonstrations and debugging: the floor signals when hems float, while the vertical axis reveals incorrect center placement. A grid can also produce misleading depth cues if its scale changes or the camera is too steep. The next iteration should permit centimeter and meter references, optional ruler labels, front/back body center planes, and an orthographic drafting alignment overlay. Any dimension labels must derive from the scene coordinate system rather than arbitrary screen pixels.

For attractive screenshots, avoid an overly strong grid that competes with low-contrast garments. The user should be able to show grid, floor shadow and axes independently. A promotion may omit technical guides, but engineering captures should retain enough scale cues to judge pose and clearance.

## Public avatar sources

The public neutral default is `public/avatars/makehuman-base.obj`. `public/avatars/README.md` identifies it as the MakeHuman community base mesh and points to [MakeHuman's public source](https://github.com/makehumancommunity/makehuman). The repository includes `public/avatars/MAKEHUMAN-LICENSE.ASSETS.md`, containing the CC0 1.0 Universal notice, and `public/avatars/guides/makehuman-base.png` as a visual guide. These paths provide a grounded public alternative for screenshots and contributors.

The viewport's `upgradeAvatarVisualization` code chooses the avatar model using `project.avatar.model`, defaulting to `makehuman-base`. It loads that default via `OBJLoader` from `/avatars/makehuman-base.obj`. The code also contains alternate model branches for imported custom models and additional rigged models. A public capture should deliberately choose the CC0 MakeHuman default and record the chosen avatar model; a generic-looking rendered figure is insufficient to establish its asset provenance.

The source also includes historical references to nonpublic or uncertain-rights avatars. Keep their names, models, thumbnails and screenshots out of public marketing and published regression fixtures unless their redistribution rights have independently been established. Neither the existence of a loader branch nor the presence of a local machine asset supplies that permission. The current preferred public visual path is the neutral MakeHuman model with grid and gray studio.

## Analytic versus mesh collision

The viewport initially constructs an analytic fitting avatar from `getAvatarHeightScale`, `getAvatarTorsoRadii`, `getAvatarUpperBodyDimensions` and `getAvatarArmPose`. The analytic torso geometry and limb proxies are based on measurements from the authored avatar. The detailed MakeHuman mesh is then loaded for visual upgrade, scaled toward `project.avatar.heightCm`, and shaded with a neutral material. `public/avatars/README.md` says this detailed mesh is visual-only while the measurement-driven body remains the collision reference.

The current code also attempts to select body meshes from a detailed visual avatar and build a static mesh collider, recording `collisionAvatar` metadata such as `static-avatar-mesh-bvh` or `analytic-parametric`. This is an evolving implementation and must be interpreted narrowly: building or attaching a static collision mesh is not proof that all solver paths use it consistently, that deformation follows the body, or that the source mesh's sizing matches a measured wearer. The analytic fallback remains essential.

Future avatar work should separate the visual mesh, fitting measurements, collision shell, skeleton and pose into explicit assets. A generic height scaling operation does not produce individually correct body proportions. A configurable silhouette requires anthropometric parameters, morph maps or fitted body reconstruction, followed by a regenerated collision surface. Verify mesh winding, scale, origin, pelvis alignment, shoulder width, neck, underarm, knees and stance; contact error tends to concentrate in concavities and overlapping limbs. The visual model should not be the authority for measurements unless it was calibrated to those measurements.

## Viewport performance and visibility

The render loop runs alongside mesh generation, material updates and simulation. Triangle count, material variation, texture resolution, shadow maps and canvas pixel ratio compete for GPU resources. The code already limits pixel ratio and disposes renderers and materials on unmount. A separate `FabricMaterialPreview` also initializes WebGL, so many simultaneous previews could introduce additional GPU pressure.

Performance improvements should begin with timing, not arbitrary decimation. Record frame duration, mesh triangle counts, texture memory, draw calls and simulation duration on the same project. Cache procedural texture maps by stable input signatures, reuse shader materials where semantics allow, and avoid rebuilding cloth topology for purely visual edits. Use request-driven rendering for idle preview widgets. Higher mesh density should be concentrated around curvature, narrow seams and visible silhouettes, with geometric fidelity checks after each simplification.

The viewer manages avatar visibility, garment transparency and material ordering. An analytic avatar partially visible through a garment may help diagnose fit but can wash out cloth colors if depth writing is incorrect. The source comments describe special handling to ensure semi-transparent fitting avatars do not cover the garment visually. Use separate tests for opaque cloth, translucent organza, inside/outside layer ordering, overlapping panels and avatar invisibility. Confirm that screenshot state matches the tested collision state.

## Capture, demonstrations, and privacy

Public captures should show a real, identifiable revision of the running app. Use the MakeHuman CC0 avatar, neutral grid, coherent lighting and a garment generated from a source fixture. Show both a wide scene and close-up details, with camera and exposure fixed for comparative shots. The existing repository includes screenshots and a V16 film referenced from README; those are historical demonstrations and should not be presented as independently verified current functionality without recapture.

An engineering capture should state fixture, commit, fabric, avatar model, camera, exposure, simulation backend and frame number. To demonstrate actual simulation, show the Simulate action and two distinct temporal states. To demonstrate materials, change a visual parameter on the same garment and check geometry positions stay unchanged. Avoid implying that a smooth-looking render has passed contact or production tests.

## Next rendering milestones

The highest priorities are a calibrated public avatar preview, standardized camera bookmarks and color-consistent material comparisons. After that, implement adaptive silhouette-quality rendering and stable mesh-generation fingerprints so drawing operations only rebuild necessary geometry. Add a dedicated debug mode to overlay avatar and cloth contact surfaces, seam gaps, collision proxies, material UV directions, face normals and mesh defects without contaminating promotional captures.

Longer-term work includes morphable CC0 body assets, rigged pose consistency, mesh-quality-aware adaptive triangulation, physical fit measurements and well-defined camera animation. Every feature should have a visible UI affordance, a separable source model and a test. None should be marked production certified solely because its on-screen view looks realistic.

## Acceptance matrix

| Scenario | Procedure | Expected evidence |
|---|---|---|
| Default public avatar | Load default garment; select `makehuman-base` | Neutral MakeHuman OBJ shown; provenance documented |
| Studio ground reference | Toggle floor/grid; orbit around center | Grid and axes follow display toggle, simulation unchanged |
| Studio render fidelity | Capture neutral front/three-quarter under fixed exposure | Stable backdrop, no blown cloth highlights or clipping |
| Avatar fallback | Use unavailable or malformed detailed mesh | Analytic avatar remains visible and failure is reported |
| Contact alignment | Render analytic and detailed body in debug view | Quantified offset at torso, shoulder and hip |
| Interaction ownership | Orbit, select, rotate and drag panels | Tool actions do not unexpectedly change document geometry |
| Simulation display | Compare initial and later solver frames | Real particle motion, coherent normals, visible drape |
| Performance | Record frame and GPU statistics with same fixture | Regression budget and consistent resource cleanup |
| Public screenshot | Inspect asset selection and capture metadata | No nonredistributable body assets; current application shown |

Relevant checks include `scripts/check-avatar.mjs`, `scripts/qa-material-render-still.mjs`, `scripts/qa-fabric-material-iteration.mjs`, `scripts/check-mesh-selection.mjs` and `scripts/check-native-cpp-mesh-avatar-contact.mjs` where available. Run the checks and document actual results before claiming a pass. See [Architecture](EXO_ARCHITECTURE.md), [Data Model](EXO_DATA_MODEL.md) and [Fabric, Materials and Trims](EXO_FABRIC_MATERIALS_AND_TRIMS.md).
