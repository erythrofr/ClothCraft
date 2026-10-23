# Template browser

Open **File → Templates…**, or the grid button at the top of the tool rail.
The browser contains six original ClothCraft examples: T-shirt, dress, curved
panels, two rectangles, partial/chained seams and local easing. These are
engineering fixtures with uncalibrated fabrics, not production-ready or graded
manufacturing patterns. The T-shirt and dress were drafted for the bundled
1.75 m mannequin; another avatar may require manual placement adjustments.

Selecting a template shows its flat contours, panel/seam counts, metre units,
source and license. Curves are sampled using the existing contour tolerance;
The metadata and preview scroll independently of the action row, including in
small windows; the confirmation controls remain reachable at 480 × 360.
holes and internal lines are included. The preview uses the authored 2D layout,
not the draped mesh. Bundled data is embedded in the executable and requires no
network connection. No third-party pattern catalog is downloaded.

**Import template JSON…** accepts a local native GarmentTemplate v1/v2 document,
up to 8 MiB. It does not accept an arbitrary interchange format or a complete
FittingProject save. Imported patterns display unverified licensing; the user
must check rights and provenance. Picking or validating a file does not replace
the open garment. Invalid input is reported in the browser.

**Use this template…** first validates the candidate against the current avatar
and settings, then asks for confirmation. Cancel keeps the document and its
history. Save current, then open uses the ordinary save flow; cancellation or
save failure aborts replacement. The explicit open/discard action creates a new
project after another validation. It retains the avatar and physical settings,
clears old draped state and mesh signatures, resets editing drafts and undo/redo,
and removes the previous saved path. The next save asks for a filename.

The browser is paused while choosing. It does not change the solver, fabric
models, or collision algorithms. Compilation is CPU work performed on selection
and opening, not on every preview frame. Very dense imported templates can still
take time to validate; this initial browser has no background import worker.

## Implementation and checks

`template_catalog.rs` owns metadata, embedded fixtures, validated preview data
and candidate preparation. `atelier/template_browser.rs` owns the actual egui
controls. `documents_ui.rs` handles file dialogs and document replacement;
`authoring_ui.rs` provides the tool-rail entry point.

CPU-only checks (two jobs/threads):

```sh
cargo test --locked --no-default-features -j 2 --test template_catalog -- --test-threads=2
cargo test --locked -j 2 --bin cloth-fit named_widgets_templates -- --test-threads=2
```

The UI scenarios use the named-widget harness and the production document
installation function. They do not open a native window or initialize a GPU.
Native file pickers are outside the harness; the catalog parser has separate
invalid-input tests. This is not a claim of native-dialog or visual acceptance.

Local validation on 2026-10-24: four catalog tests and all 62 active atelier
unit tests passed (one optional preview test ignored). This includes the three
template widget scenarios: cancel/confirm, invalid avatar, and keyboard focus
with Escape cancellation. Targeted Clippy with warnings denied and formatting
checks passed. No GPU was used.

A follow-up named-widget regression reproduced a clipped confirmation button
at 480 × 360. A bounded scroll region with explicit minimum height fixes both
clipping and gradual growth when reopening after confirmation. All four
template widget scenarios then passed, including the new small-window case.
