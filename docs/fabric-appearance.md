# Fabric appearance

Work in progress for EXO-LOOK-001 (#126). CPU validation is separate from
native-window/GPU acceptance. Normal maps and measured textile BRDFs are not
implemented.

An experimental embedded albedo workflow is being developed on a draft branch.
Its PNG loader, inspector and shader path are implemented but have not been
validated in an actual window. Do not merge or advertise it as supported until
the GPU/window, rendering and end-to-end acceptance checks pass. The prototype
stores opaque sRGB pixels, material-space tile dimensions and rotation. Its
JSON representation and resolution limits require review against actual project
size, runtime cost and portable clipboard/save workflows.

The experimental loader limits PNG input to 1 MiB and dimensions to 256×256;
it rejects transparency. At most 16 distinct fabric texture records are
permitted in a document. Pixels are embedded in JSON, so project size can be
substantially larger than the input PNG. Tile size is 0.001–100 m per axis;
rotation is in degrees around the material-space origin, independent of panel
placement and grain. An image is multiplied by the chosen fabric color. The
draft renderer expands images to 256×256 with nearest-neighbor resampling and
uses linear repeated sampling without mipmaps. This may alias at distance and
is not a calibrated fabric appearance. Diagnostic overlays take precedence.
The existing pattern clipboard has a 2 MiB serialized size limit. A selection
with multiple large embedded images can exceed it; copying then returns an error
without dropping texture data. Portable compact storage remains open work.
Pixel arrays are shared immutably between document/history copies; the viewport
reuses a previously validated pixel allocation and still rechecks dimensions
and texture parameters. The GPU cache is rebuilt when authored maps change.
An opt-in CPU microbenchmark in `tests/appearance.rs` compares opacity scans
with shared-allocation identity checks; it does not measure a full frame or GPU.

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
film renderer or complete PBR pipeline. There is no transparency, metalness,
sheen, optical displacement or asset download control. The albedo workflow
described above remains experimental and unverified on a GPU.

Absent appearance and diagnostic overlays use the previous shading path.
Marked faces, contact visualization and strain heatmaps retain their priority
and are not tinted by custom optics. Wireframe strength is still independent
of optical roughness. The avatar and sewing overlay use legacy shading.

The camera uniform is 112 bytes. Mesh vertices contain 18 floats, including
roughness and material UV/layer; negative roughness selects legacy shading. WGSL is validated
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
