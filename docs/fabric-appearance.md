# Fabric appearance

Work in progress for EXO-LOOK-001 (#126). CPU validation is separate from
native-window/GPU acceptance. Texture loading, normal maps and measured textile
BRDFs are not implemented by this slice.

## Authored data and controls

The optional `fabric_appearance` map in a native garment template is keyed by
stable fabric ID. Each entry contains `color_srgb` (three bytes) and `roughness`
(a finite dimensionless value in [0, 1]). Absence preserves the legacy renderer
and serializes without a new field. This optional metadata is accepted in native
template versions 1 and 2; older application builds may reject the new field.
No EXO document interchange compatibility is implied.

The Fabric inspector stages custom color and roughness until **Apply appearance**.
It changes every panel sharing that fabric. Unchecking custom appearance and
applying restores the legacy default. Applying an unchanged value is a no-op.
Mechanical material edits remain separate; splitting a shared mechanical fabric
inherits its optics. Applying one mechanical fabric to all panels also assigns
that shared fabric appearance to all of them. Clipboard capture filters unrelated optical records and
paste distinguishes equal mechanical fabrics with different appearances.

## Simulation and persistence

Appearance is excluded from `authoring::same_physics` and the fitting cache
fingerprint. A strictly appearance-only transaction uses the existing history
but preserves the compiled garment, live x/v/time, worker generation, pending
work, playing state and cached fitting data. Undo uses the same production
installer. Other board/placement edits retain their existing cancellation
policy. There is no modification of density, thickness, stiffness, grain,
collision geometry or contact algorithms.

Rendering rebinds current authored optics to compiled panel material slots.
It does not read optics from a stale physics cache. Color is shared by fabric;
a triangle's physical material index is only a transient rendering lookup.

## Rendering conventions and limits

Custom sRGB bytes are decoded to linear RGB. The shader applies a bounded
fixed-light dielectric GGX highlight controlled by perceptual roughness and
encodes the result to sRGB for the existing unorm viewport target. This is a
presentation approximation, not a calibrated woven/knitted material model,
film renderer or complete PBR pipeline. There are no texture maps, transparency,
metalness, sheen, optical displacement or asset download controls.

Absent appearance and diagnostic overlays use the previous shading path.
Marked faces, contact visualization and strain heatmaps retain their priority
and are not tinted by custom optics. Wireframe strength is still independent
of optical roughness. The avatar and sewing overlay use legacy shading.

The camera uniform is 80 bytes: a 64-byte projection matrix and a 16-byte eye
or orthographic direction. Mesh vertices contain 15 floats, including a final
roughness value; a negative value selects legacy shading. WGSL is validated
on CPU, and real native-window acceptance remains pending explicit GPU access.

## Acceptance and reproduction

Run the CPU-only appearance and shader fixtures with
`cargo test --locked --no-default-features -j 2 --test appearance --test shader -- --test-threads=2`.
They exercise legacy serialization, invalid values, cached drape reopening,
clipboard optical identity, mechanical material splitting and shader layout.
Desktop-feature tests also run on CPU: the named-widget fixture stages and
applies the controls, and the production editor-transition fixture checks
appearance apply/undo/redo with an in-flight worker response. Renderer tests
check diagnostic-overlay precedence. These checks do not validate a GPU pipeline
or the appearance of a rendered image.

For native-window acceptance, open a saved drape, start simulation, change a
shared fabric's color and roughness, then undo and redo while it runs. Verify
that motion continues, all intended panels update, other fabrics remain unchanged,
and Save/Open retains both optics and the drape. Check perspective and
orthographic views, diagnostic overlays, and restoration of the legacy default.
Record the tested revision and GPU; this manual acceptance is still pending.

## Provenance

Independent Rust/WGSL implementation. EXO surface-optics and PBR-appearance
files at `352c6086b622caeda95f16d9bd923624b95e05d9` were read as behavioral
references (see #126), not copied or translated. No upstream scans, tables,
heuristics or other assets are included. Optical values do not establish
measured physical textile properties.
