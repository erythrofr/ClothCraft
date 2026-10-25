# Static avatar import

Use **File → Import avatar… → Choose file…** to select a local OBJ, glTF or GLB.
The confirmation shows the source, vertex and triangle counts, bounding box,
dimensions in metres and geometry-loss warnings. The action row stays outside
the scrolling details, including at 480 × 360.

**Replace avatar** keeps authored panels, seams, materials, placements and live
simulation settings. It resets the draped positions/velocities to the authored
initial arrangement, clears cached mesh state, unfinished edits and undo history,
and marks the document modified. Save the current drape first if it is needed.
Replacing an avatar is not currently an undoable authoring command.

Opening the importer pauses simulation without changing its worker generation.
A previously running step can still finish normally. Choosing a file only
prepares an isolated candidate. Cancel, Escape, invalid input or failed scene
compilation never install that candidate. Successful installation advances the
generation so a late result from the old avatar cannot overwrite the new scene.

## Geometry and files

- glTF/GLB uses the existing static geometry importer, including node transforms
  and mirrored winding. Coordinates remain metres, right-handed and Y-up.
  A declared default or sole scene is required; ambiguous scenes are rejected.
  There is no scene selector yet. Animation, skinning and unsupported extensions
  remain explicit errors; see `src/gltf_avatar.rs` for the complete subset.
- OBJ uses the existing parser and interprets coordinates as metres and Y-up.
  No height guessing, scaling or axis conversion occurs. Use triangulated OBJ;
  polygons use the existing fan triangulation, not a general concave triangulator.
- Only surface positions and triangles are retained. Materials, textures, UVs,
  authored normals and object identities are lost. This is an avatar collider
  import, not a material-aware interchange workflow.
- Import validates finite, nondegenerate geometry; it does not repair initial
  intersections, close holes or prove coherent winding. Check the arrangement
  before starting the simulation. Collision and solver algorithms are unchanged.

The importer writes a canonical OBJ into an owned temporary directory, without
overwriting the source. Its lifetime follows the active document and survives
template replacement and Save As. Save/recovery use the existing v1 portable
asset writer, copying the OBJ into the project's adjacent `.assets` directory.
Saved projects therefore survive temporary-directory cleanup and relocation.
Keep the project JSON and its `.assets` directory together.

Preparation and compilation are synchronous CPU operations; dense assets can
pause the UI. The existing glTF resource limits apply. OBJ input is limited to
64 MiB, 2 million vertices and 4 million expanded triangles. A background import
worker, mesh simplification and native visual acceptance remain future work.

## Tests and handoff

`src/avatar_import.rs` owns staging and candidate preparation, independently of
egui/wgpu. `atelier/avatar_import_ui.rs` owns the confirmation controls;
`documents_ui.rs` installs the candidate and retains the staged asset. The
existing `atelier.rs` worker-generation contract is reused without modification.

```sh
cargo test --locked --no-default-features -j 2 --test avatar_import -- --test-threads=2
cargo test --locked -j 2 --bin cloth-fit named_widgets_avatar -- --test-threads=2
```

The CPU fixtures independently specify transformed coordinates and winding,
preserve source bytes, and save/reload after dropping the staging owner. The UI
tests drive the actual named controls and production installer for cancellation,
errors, confirmation, generation invalidation and a small window. Native OS file
pickers and GPU rendering are outside that harness and are not claimed as tested.
No third-party source or assets are copied by this implementation.

Local validation, 25 October 2026: five import integration tests, the fourteen
existing glTF/document tests and all 68 active desktop unit tests passed (one
optional preview ignored). This includes three named-widget import gestures,
the visible confirmation-text check and the template-replacement lifetime test.
CPU library/import-test Clippy and desktop/test Clippy passed with warnings
denied. Formatting and whitespace checks passed. No GPU or native window ran.
