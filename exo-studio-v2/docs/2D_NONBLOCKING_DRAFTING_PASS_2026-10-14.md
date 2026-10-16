# Garment Studio — unobstructed 2D drafting pass

**Date:** October 14, 2026

## Requested behavior

Pattern measurements must **never cover the 2D drafting canvas or pop up
automatically during drawing**. Precision point, curve and seam-edge editing
must remain available rather than being removed.

## Implemented

1. Removed the floating 2D QA measurements popup, its canvas-header trigger,
   and unused absolute-positioned overlay styles.
2. Relocated point, curve and seam-edge precision editors to the **right
   Property Editor**, using a React portal into the existing inspector.
   Selecting geometry no longer overlays the working pattern.
3. Relocated the piece-dimension and seam-length QA report to a collapsed
   **2D QA · Pattern measurements & sewing** section in the right inspector.
   Clicking that section is the only way to expose its detailed measurements.
4. Added lazy QA evaluation: expensive per-piece boundary and sewing
   length calculations occur only while the section is open.
5. Selecting a point/curve/edge scrolls the right Property Editor only
   to show its precision controls. The drawing does not shift or shrink.
6. Kept the precision dock accessible in Pattern, Sewing and Production;
   hidden in other workspaces, including Render.
7. Cancelled incomplete tape-measure, sewing and fastener operations when
   changing tools or pressing Escape, preventing stale first clicks.

## Verified acceptance

- check:2d-nonblocking — PASS, live Chrome with isolated testSession.
  Verified no floating measurement/point/curve/edge overlays, correct
  right inspector bounds, default-closed audit, explicit expansion,
  correct panel scrolling, cross-workspace visibility, saved tape measure,
  pending-measurement cancellation, unchanged canvas size and zero JS errors.
- check:drafting-ui — PASS, numeric point and Bézier controls, Undo/Redo.
- qa-precision-edge-inspector.mjs — PASS, editable seam allowance.
- check:non-simulation — PASS, factory/DXF/markers.
- check:clo-layout-fabric-ui — PASS, workspace and materials.
- check:render-still — PASS, real PNG render and PBR mapped panels.
- check:drafting-constructions — PASS, analytic geometric constructions.
- npm run build — PASS.

## Remaining work

This pass addresses **popup obstruction and drafting continuity**. It does
not complete Seamly2D's dependency graph, all CLO3D tool functionality,
certified garment simulation, industrial supplier approval, or offline
path-traced rendering.
