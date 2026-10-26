# Import DXF pattern outlines

Use **File → Import DXF patterns…** and choose a local ASCII DXF. Review the
preview, select closed outlines, choose an existing fabric and mesh spacing,
acknowledge excluded data, then **Add panels**. The operation adds unsewn pieces
to the current garment. It does not replace its avatar, materials or seams.

File units are used when supported. For missing/unitless drawings, enter the
number of **millimetres per DXF unit**: `1` for millimetres, `10` for centimetres,
`25.4` for inches or `1000` for metres. A manual value overrides file units and
is identified as an override. After changing units or curve tolerance, click
**Update preview** and select the outlines again. Confirm is disabled while
the displayed units differ from those used to generate the preview.

DXF +Y is mapped upward in the preview and to decreasing material V in the
editor. Each imported contour is translated to its own local material origin;
physical lengths are preserved. Winding is normalized to the editor's contour
convention. New panels receive unique IDs, straight sampled boundary IDs and
the chosen fabric, with grain at 90 degrees. This does not reconstruct source
sewing relationships or names for individual source boundary segments.

New pieces are initially laid out in a separated row to the right of the
current cloth and avatar bounds. Move and sew them with the existing tools.
Apply compiles the complete garment before recording one history entry.
Unchanged panels retain their draped positions and velocities; dependent
simulation caches rebuild. Undo/redo and native Save/Open use the ordinary
template format. Source files are neither rewritten nor needed after saving.

Cancel, Escape, invalid inputs and failed preparation add no history entry.
Opening the importer pauses playback. Finish or cancel an active drawing,
placement or sewing draft before opening it. Closing the main window dismisses
the import modal and continues the normal unsaved-document flow.

## Supported subset and limits

- Planar model-space LINE, ARC, CIRCLE, LWPOLYLINE and legacy 2D POLYLINE/VERTEX
  with default +Z extrusion. Only closed paths can become panels; open paths
  remain visible and excluded. No automatic line stitching.
- Source layers remain distinct in the report. The user selects the outline
  to use; cut and sewing outlines are not merged or inferred. Nested, touching
  or overlapping selected contours are rejected rather than interpreted as holes
  or alternate manufacturing boundaries. Self-intersections fail validation.
- Curves are flattened at the explicitly shown chord tolerance, initially
  0.1 mm. The preview shows at most 128 paths with display-only sampling; this
  does not simplify imported geometry. The full path list is scrollable.
- UTF-8 text, at most 16 MiB. The geometry reader limits total/path samples;
  editable panels accept 3..4096 contour points. Import preserves those limits
  rather than truncating a contour. At most 128 panels may exist in the garment.
  Pairwise contour checks stop at two million segment comparisons; import fewer
  pieces at once if that bound is reached.
- Supported header units: inches, feet, millimetres, centimetres and metres;
  other values require an explicit scale. Nondefault extrusion, blocks,
  text, splines, widths and unsupported entities are reported. Non-geometry
  DXF sections are not imported. No code-page conversion or industrial
  DXF-AAMA/DXF-ASTM semantics are implemented.

The CPU adapter is `src/pattern_import.rs`; native controls live in
`src/atelier/pattern_import_ui.rs` and use the existing document/history adapter.
Tests use the CPU named-widget harness. Native OS picker, GPU rendering and
visual acceptance require a separate window run; CPU results do not prove them.
