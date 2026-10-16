# Garment Studio — exhaustive CLO-class master engineering plan and checklist

Created 2026-10-13. Scope: entire application, 2D CAD, 3D tools, fitting/simulation, native app, manufacture, automation and QA. This is a **living inventory**, not proof of CLO3D feature parity or a claim of having checked every feature of every CLO release.

> **Safety of current work:** This roadmap is documentation only. Existing uncommitted source edits, garments, simulation fixtures, personal avatars and local builds were not reset, replaced or deleted.

## 1. Executive interpretation, status and priority vocabulary

- **Baseline:** prior user-facing estimate ~30–35% feature parity was rough opinion, not a measured benchmark; do not convert into a burndown percentage without actual scored acceptance data.
- **Current source evidence:** React/Vite + Three.js UI (`src/App.jsx`, `src/components/*`); core CAD/production modules (`src/core/*`); JS PBD, C++ native XPBD and Metal/PPF bridge; Blender bridge; native macOS bundle; many engineering check commands in `package.json`.
- **Verified historically:** a production build, the consolidated non-simulation engineering checks, and a signed/opened native bundle in an earlier pass. **No new builds/tests are claimed by this planning document.**
- **Known important defects (from previous audits):** floating garment and unacceptable strain; cloth-body and cloth-self intersections in dynamic fitting; incomplete CAD constraints and styleline operations; incomplete industrial interchange; shallow hierarchy/editor actions; UI automation selector ambiguity.
- **P0 = correctness or foundation blocker; P1 = significant workflow parity; P2 = production polish / advanced breadth.** All unchecked boxes below are *work/verification required*, not a declaration that the code does not yet exist. A box can be marked done only with direct evidence linked to a test and artifact.

## 1A. Traceability rules and honest scope boundaries

Each GS entry is an **atomic capability criterion**, not yet a resolved task ticket. To execute it, split into independently estimated tickets for design, implementation, unit tests, integration tests, native acceptance and docs. Before claiming parity, compare against a specified CLO3D product version, platform and documented command behavior using original assets. The expression “every possible feature” is open-ended; this plan aims for broad engineering coverage and must grow as verified gaps are discovered.

**Technical-debt and defect baseline:** preserve all uncommitted local changes; do not infer absence from an unsearched module; quantify solver regressions only under the same baseline; treat disabled/placeholder controls as incomplete but avoid calling a test timeout a product defect. Each backlog entry stays open until evidence shows it passes the universal acceptance gates. A source file existing is not acceptance evidence.

## 2. Universal Definition of Done for every feature

For every feature below, the assignee must complete all of these gates before marking it `done`:

- [ ] G-01 User workflow and precision requirements written down.
- [ ] G-02 Existing implementation inspected; duplicate capability avoided.
- [ ] G-03 Data model and units defined; stable IDs/provenance preserved.
- [ ] G-04 Behavior works with real project documents, not a UI-only mock.
- [ ] G-05 Undo and redo both restore exact state.
- [ ] G-06 Save, close, reopen preserves feature state and required assets.
- [ ] G-07 2D↔3D linkage is correct where applicable.
- [ ] G-08 Import/export and manufacturing consequences tested where applicable.
- [ ] G-09 Numeric edge cases, units, precision, degenerate geometry tested.
- [ ] G-10 Native Mac and browser/preview interaction checked where applicable.
- [ ] G-11 Automated regression plus representative manual quality review.
- [ ] G-12 Performance, cancellation and error feedback checked.
- [ ] G-13 No regression in other apparel samples and avatar poses.
- [ ] G-14 Docs, feature matrix, provenance and acceptance evidence updated.

## 3. Detailed system-by-system backlog

Checkbox IDs are permanent roadmap references. Use them as issue IDs in future agent passes. Each line is a discrete testable target, sometimes requiring several engineering subtasks. Long-term acceptance must be grounded in verified samples and not just a screenshot.

### 00 — Architecture, technical debt, source of truth (P0)

#### 00.01 Document model

- [ ] **GS-00-01-01** Versioned canonical project schema.
- [ ] **GS-00-01-02** Stable IDs.
- [ ] **GS-00-01-03** Units and axes.
- [ ] **GS-00-01-04** Authored vs derived data.
- [ ] **GS-00-01-05** Constraints and dependencies.
- [ ] **GS-00-01-06** Migration and compatibility.
- [ ] **GS-00-01-07** Project diff.
- [ ] **GS-00-01-08** Undo records.
- [ ] **GS-00-01-09** Forward compatibility.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 00.02 Geometry engine

- [ ] **GS-00-02-01** Double precision coordinates.
- [ ] **GS-00-02-02** Robust predicates.
- [ ] **GS-00-02-03** Deterministic polygon booleans.
- [ ] **GS-00-02-04** Exact curve intersections.
- [ ] **GS-00-02-05** Offsets.
- [ ] **GS-00-02-06** No sliver artifacts.
- [ ] **GS-00-02-07** Controlled tolerances.
- [ ] **GS-00-02-08** Precision reporting.
- [ ] **GS-00-02-09** Stable shape topology.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 00.03 2D/3D pipeline

- [ ] **GS-00-03-01** Source-to-mesh provenance.
- [ ] **GS-00-03-02** Incremental invalidation.
- [ ] **GS-00-03-03** Remesh map retention.
- [ ] **GS-00-03-04** Garment state machine.
- [ ] **GS-00-03-05** Immutable snapshots for async jobs.
- [ ] **GS-00-03-06** Event delivery ordering.
- [ ] **GS-00-03-07** Rendering separation.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 00.04 Backend strategy

- [ ] **GS-00-04-01** PBD/native XPBD/PPF capability matrix.
- [ ] **GS-00-04-02** Shared payload schema.
- [ ] **GS-00-04-03** Job cancellation.
- [ ] **GS-00-04-04** Progress/status.
- [ ] **GS-00-04-05** Failure modes.
- [ ] **GS-00-04-06** Deterministic seed.
- [ ] **GS-00-04-07** Solver version tracking.
- [ ] **GS-00-04-08** Fallback clearly labeled.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 00.05 Native direction

- [ ] **GS-00-05-01** Assess Qt/C++20 host vs current wrapper.
- [ ] **GS-00-05-02** Module API boundaries.
- [ ] **GS-00-05-03** Metal rendering feasibility.
- [ ] **GS-00-05-04** Native file dialogs.
- [ ] **GS-00-05-05** Codesign/notarization.
- [ ] **GS-00-05-06** Upgrade plan without disrupting React app.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 00.06 Code health

- [ ] **GS-00-06-01** Break up monolithic App.jsx.
- [ ] **GS-00-06-02** Isolate document actions.
- [ ] **GS-00-06-03** Typed validation.
- [ ] **GS-00-06-04** Lint/typecheck.
- [ ] **GS-00-06-05** Dependency risk.
- [ ] **GS-00-06-06** Feature flags.
- [ ] **GS-00-06-07** Error boundaries.
- [ ] **GS-00-06-08** Logs.
- [ ] **GS-00-06-09** Profiling.
- [ ] **GS-00-06-10** License inventory.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

### 01 — Native desktop application and project lifecycle (P0)

#### 01.01 Documents

- [ ] **GS-01-01-01** New/open/save/save as.
- [ ] **GS-01-01-02** Recent projects.
- [ ] **GS-01-01-03** Unsaved-changes prompt.
- [ ] **GS-01-01-04** Autosave.
- [ ] **GS-01-01-05** Backup.
- [ ] **GS-01-01-06** Recovery.
- [ ] **GS-01-01-07** External media.
- [ ] **GS-01-01-08** Changed-file conflict.
- [ ] **GS-01-01-09** Atomic writes.
- [ ] **GS-01-01-10** Path remapping.
- [ ] **GS-01-01-11** Version migration.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 01.02 App packaging

- [ ] **GS-01-02-01** Native arm64 build.
- [ ] **GS-01-02-02** Bundle resources.
- [ ] **GS-01-02-03** Signed binaries.
- [ ] **GS-01-02-04** Installer/updater.
- [ ] **GS-01-02-05** Quarantine behavior.
- [ ] **GS-01-02-06** App permission prompts.
- [ ] **GS-01-02-07** Offline operation.
- [ ] **GS-01-02-08** Graceful service launch/shutdown.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 01.03 Undo and history

- [ ] **GS-01-03-01** Every tool reversible.
- [ ] **GS-01-03-02** Grouping/transactions.
- [ ] **GS-01-03-03** Redo invalidation.
- [ ] **GS-01-03-04** Branch management.
- [ ] **GS-01-03-05** Persistent history design.
- [ ] **GS-01-03-06** Predictable large-simulation snapshots.
- [ ] **GS-01-03-07** Crash-state restore.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 01.04 Reliability

- [ ] **GS-01-04-01** Memory bounds.
- [ ] **GS-01-04-02** Background processing.
- [ ] **GS-01-04-03** App reopen.
- [ ] **GS-01-04-04** Resource cleanup.
- [ ] **GS-01-04-05** Deactivation/reactivation.
- [ ] **GS-01-04-06** Sleep/wake.
- [ ] **GS-01-04-07** Missing GPU.
- [ ] **GS-01-04-08** Corrupted file alerts.
- [ ] **GS-01-04-09** Safe default recovery.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 01.05 Preferences

- [ ] **GS-01-05-01** Units.
- [ ] **GS-01-05-02** Precision.
- [ ] **GS-01-05-03** Mouse/trackpad.
- [ ] **GS-01-05-04** Localization.
- [ ] **GS-01-05-05** UI density.
- [ ] **GS-01-05-06** Shortcuts.
- [ ] **GS-01-05-07** Theme.
- [ ] **GS-01-05-08** Autosave interval.
- [ ] **GS-01-05-09** Workspace restore.
- [ ] **GS-01-05-10** Cache locations.
- [ ] **GS-01-05-11** Telemetry opt-in.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

### 02 — Workspace, UI and interaction parity (P1)

#### 02.01 Shell layout

- [ ] **GS-02-01-01** Resizable/dockable panels.
- [ ] **GS-02-01-02** Detachable 2D/3D views.
- [ ] **GS-02-01-03** Saved layouts.
- [ ] **GS-02-01-04** Multi-monitor.
- [ ] **GS-02-01-05** Collapsed sidebars.
- [ ] **GS-02-01-06** Toolbar placement.
- [ ] **GS-02-01-07** Responsive minimum sizes.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 02.02 Tool discoverability

- [ ] **GS-02-02-01** Complete tool inventory.
- [ ] **GS-02-02-02** Non-placeholder commands.
- [ ] **GS-02-02-03** Flyouts.
- [ ] **GS-02-02-04** Names and icons.
- [ ] **GS-02-02-05** Tooltip examples.
- [ ] **GS-02-02-06** Keyboard hints.
- [ ] **GS-02-02-07** Context-aware disabled reasons.
- [ ] **GS-02-02-08** Command palette.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 02.03 Object Browser

- [ ] **GS-02-03-01** Hierarchical scene graph.
- [ ] **GS-02-03-02** 2D and 3D visibility independently.
- [ ] **GS-02-03-03** Lock.
- [ ] **GS-02-03-04** Folders.
- [ ] **GS-02-03-05** Parent/child.
- [ ] **GS-02-03-06** Reordering.
- [ ] **GS-02-03-07** Drag/drop.
- [ ] **GS-02-03-08** Multi-selection.
- [ ] **GS-02-03-09** Search.
- [ ] **GS-02-03-10** Filters.
- [ ] **GS-02-03-11** Isolate/solo.
- [ ] **GS-02-03-12** Groups.
- [ ] **GS-02-03-13** Batch edit.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 02.04 Property Editor

- [ ] **GS-02-04-01** Selection-based inspectors.
- [ ] **GS-02-04-02** Batch mixed values.
- [ ] **GS-02-04-03** Undo-aware numeric fields.
- [ ] **GS-02-04-04** Units.
- [ ] **GS-02-04-05** Inline errors.
- [ ] **GS-02-04-06** Linked properties.
- [ ] **GS-02-04-07** Presets.
- [ ] **GS-02-04-08** Searchable sections.
- [ ] **GS-02-04-09** Contextual help.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 02.05 Selection model

- [ ] **GS-02-05-01** Select/extend/toggle.
- [ ] **GS-02-05-02** Lasso/box.
- [ ] **GS-02-05-03** Target priority.
- [ ] **GS-02-05-04** Locked-item protection.
- [ ] **GS-02-05-05** Hidden-item selection rules.
- [ ] **GS-02-05-06** Sync 2D-to-3D.
- [ ] **GS-02-05-07** Outliner-to-canvas.
- [ ] **GS-02-05-08** Hover focus.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 02.06 Input and accessibility

- [ ] **GS-02-06-01** Keyboard-only operation.
- [ ] **GS-02-06-02** Focus order.
- [ ] **GS-02-06-03** Screen reader labels.
- [ ] **GS-02-06-04** Pointer capture.
- [ ] **GS-02-06-05** Retina scaling.
- [ ] **GS-02-06-06** Touchpad pinch.
- [ ] **GS-02-06-07** Zoom center behavior.
- [ ] **GS-02-06-08** High contrast.
- [ ] **GS-02-06-09** Localization.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 02.07 UI testing

- [ ] **GS-02-07-01** Golden screenshots in native and browser.
- [ ] **GS-02-07-02** Actual click-to-change assertions.
- [ ] **GS-02-07-03** Duplicate selectors fixed.
- [ ] **GS-02-07-04** Panel overlap and clipping.
- [ ] **GS-02-07-05** Workspace persistence.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

### 03 — Precision 2D pattern CAD (P0)

#### 03.01 Primitive geometry

- [ ] **GS-03-01-01** Exact points.
- [ ] **GS-03-01-02** Lines.
- [ ] **GS-03-01-03** Ray/segment.
- [ ] **GS-03-01-04** Circular arcs.
- [ ] **GS-03-01-05** Splines.
- [ ] **GS-03-01-06** Cubic Bézier.
- [ ] **GS-03-01-07** Composite curves.
- [ ] **GS-03-01-08** Tangents.
- [ ] **GS-03-01-09** Normals.
- [ ] **GS-03-01-10** Intersections.
- [ ] **GS-03-01-11** Offset.
- [ ] **GS-03-01-12** Trim.
- [ ] **GS-03-01-13** Join.
- [ ] **GS-03-01-14** Fillet.
- [ ] **GS-03-01-15** Chamfer.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 03.02 Drafting interactions

- [ ] **GS-03-02-01** Pen/point insertion.
- [ ] **GS-03-02-02** Curve edit.
- [ ] **GS-03-02-03** Split.
- [ ] **GS-03-02-04** Merge.
- [ ] **GS-03-02-05** Trace.
- [ ] **GS-03-02-06** Clone.
- [ ] **GS-03-02-07** Rotate.
- [ ] **GS-03-02-08** Translate.
- [ ] **GS-03-02-09** Scale.
- [ ] **GS-03-02-10** Reflect.
- [ ] **GS-03-02-11** Pivot.
- [ ] **GS-03-02-12** Pivot-preserving dimension.
- [ ] **GS-03-02-13** Multi-point transform.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 03.03 Constraint solver

- [ ] **GS-03-03-01** Horizontal/vertical.
- [ ] **GS-03-03-02** Coincident.
- [ ] **GS-03-03-03** Parallel.
- [ ] **GS-03-03-04** Perpendicular.
- [ ] **GS-03-03-05** Tangent.
- [ ] **GS-03-03-06** Symmetric.
- [ ] **GS-03-03-07** Collinear.
- [ ] **GS-03-03-08** Concentric.
- [ ] **GS-03-03-09** Equal length/radius.
- [ ] **GS-03-03-10** Dimensions.
- [ ] **GS-03-03-11** Over/underconstrained diagnosis.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 03.04 Numeric input

- [ ] **GS-03-04-01** Precise length.
- [ ] **GS-03-04-02** Angle.
- [ ] **GS-03-04-03** Coordinate.
- [ ] **GS-03-04-04** Radius.
- [ ] **GS-03-04-05** Curve handles.
- [ ] **GS-03-04-06** Units mm/cm/in.
- [ ] **GS-03-04-07** Expression fields.
- [ ] **GS-03-04-08** Fractional inches.
- [ ] **GS-03-04-09** Keyboard confirm/cancel.
- [ ] **GS-03-04-10** Snapping tolerances.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 03.05 Snapping/guides

- [ ] **GS-03-05-01** Grid.
- [ ] **GS-03-05-02** Vertex.
- [ ] **GS-03-05-03** Midpoint.
- [ ] **GS-03-05-04** Tangent.
- [ ] **GS-03-05-05** Intersection.
- [ ] **GS-03-05-06** Projection.
- [ ] **GS-03-05-07** Grainline.
- [ ] **GS-03-05-08** Construction guide.
- [ ] **GS-03-05-09** Smart alignment.
- [ ] **GS-03-05-10** Weighted snapping.
- [ ] **GS-03-05-11** Temporary overrides.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 03.06 Topology

- [ ] **GS-03-06-01** Holes.
- [ ] **GS-03-06-02** Cut lines.
- [ ] **GS-03-06-03** Multiple contours.
- [ ] **GS-03-06-04** Nested pattern regions.
- [ ] **GS-03-06-05** Closed/open validation.
- [ ] **GS-03-06-06** Nonmanifold diagnosis.
- [ ] **GS-03-06-07** Winding.
- [ ] **GS-03-06-08** Seam-to-edge stable IDs.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 03.07 Pattern transformations

- [ ] **GS-03-07-01** Slash/spread.
- [ ] **GS-03-07-02** Dart pivot/rotate/convert/close.
- [ ] **GS-03-07-03** Pleat.
- [ ] **GS-03-07-04** Flare.
- [ ] **GS-03-07-05** Slash-and-overlap.
- [ ] **GS-03-07-06** Flatten.
- [ ] **GS-03-07-07** True.
- [ ] **GS-03-07-08** Blend.
- [ ] **GS-03-07-09** Reshape.
- [ ] **GS-03-07-10** Curved hem.
- [ ] **GS-03-07-11** Notch transfer.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 03.08 Symmetry

- [ ] **GS-03-08-01** Linked half pattern.
- [ ] **GS-03-08-02** Unfold.
- [ ] **GS-03-08-03** Paired edits.
- [ ] **GS-03-08-04** Mirrored darts.
- [ ] **GS-03-08-05** Independent break-link.
- [ ] **GS-03-08-06** Symmetry around chosen axis.
- [ ] **GS-03-08-07** Exact reproducible transformations.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 03.09 Internal construction

- [ ] **GS-03-09-01** Internal curves.
- [ ] **GS-03-09-02** Cut/fold lines.
- [ ] **GS-03-09-03** Drill holes.
- [ ] **GS-03-09-04** Placement marks.
- [ ] **GS-03-09-05** Button/buttonhole paths.
- [ ] **GS-03-09-06** Alignment.
- [ ] **GS-03-09-07** Grain and nap arrows.
- [ ] **GS-03-09-08** Annotation properties.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 03.10 Pattern labeling

- [ ] **GS-03-10-01** Piece names.
- [ ] **GS-03-10-02** Cut quantities.
- [ ] **GS-03-10-03** Material assignment.
- [ ] **GS-03-10-04** Sizes.
- [ ] **GS-03-10-05** Fold status.
- [ ] **GS-03-10-06** Grainline direction.
- [ ] **GS-03-10-07** Labels in print/plot exports.
- [ ] **GS-03-10-08** Placement and collision avoidance.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 03.11 Seam allowances

- [ ] **GS-03-11-01** Per-edge widths.
- [ ] **GS-03-11-02** Corner miters.
- [ ] **GS-03-11-03** Notch retention.
- [ ] **GS-03-11-04** Variable width.
- [ ] **GS-03-11-05** Inset/outset.
- [ ] **GS-03-11-06** Cut/sew contour separation.
- [ ] **GS-03-11-07** Join topology.
- [ ] **GS-03-11-08** Corner error detection.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 03.12 Pattern verification

- [ ] **GS-03-12-01** Area/perimeter.
- [ ] **GS-03-12-02** Edge length.
- [ ] **GS-03-12-03** Angle.
- [ ] **GS-03-12-04** Curvature.
- [ ] **GS-03-12-05** Dimensions.
- [ ] **GS-03-12-06** Sewing length.
- [ ] **GS-03-12-07** Baseline geometry regression.
- [ ] **GS-03-12-08** Reference manufacturer-ready blocks.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 03.13 Drafting QA

- [ ] **GS-03-13-01** Constraint solve residual.
- [ ] **GS-03-13-02** Sub-mm deterministic test.
- [ ] **GS-03-13-03** Random topology fuzzing.
- [ ] **GS-03-13-04** Undo/redo.
- [ ] **GS-03-13-05** Save/reload.
- [ ] **GS-03-13-06** Large piece count.
- [ ] **GS-03-13-07** Export/import geometry.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

### 04 — Measurement, avatars as drafting references, grading (P0)

#### 04.01 Measurement system

- [ ] **GS-04-01-01** Named POM.
- [ ] **GS-04-01-02** Landmarks.
- [ ] **GS-04-01-03** Horizontal/vertical/curved distances.
- [ ] **GS-04-01-04** Circumference.
- [ ] **GS-04-01-05** Ease.
- [ ] **GS-04-01-06** Tolerance.
- [ ] **GS-04-01-07** Chart.
- [ ] **GS-04-01-08** Cross-size measurement interpolation.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 04.02 Parametric patterns

- [ ] **GS-04-02-01** Formula measurements.
- [ ] **GS-04-02-02** Dependent geometry.
- [ ] **GS-04-02-03** Parameter graph.
- [ ] **GS-04-02-04** Sizing rules.
- [ ] **GS-04-02-05** Adjustable silhouette.
- [ ] **GS-04-02-06** Ease distribution.
- [ ] **GS-04-02-07** Validated update propagation.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 04.03 Pattern block library

- [ ] **GS-04-03-01** Tees.
- [ ] **GS-04-03-02** Hoodies.
- [ ] **GS-04-03-03** Shirts.
- [ ] **GS-04-03-04** Pants/jeans.
- [ ] **GS-04-03-05** Skirts.
- [ ] **GS-04-03-06** Dresses.
- [ ] **GS-04-03-07** Jackets.
- [ ] **GS-04-03-08** Linings.
- [ ] **GS-04-03-09** Collars.
- [ ] **GS-04-03-10** Cuffs.
- [ ] **GS-04-03-11** Pockets.
- [ ] **GS-04-03-12** Hoods.
- [ ] **GS-04-03-13** Variants.
- [ ] **GS-04-03-14** Tested fit baseline.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 04.04 Grading authoring

- [ ] **GS-04-04-01** Point grading.
- [ ] **GS-04-04-02** X/y rules.
- [ ] **GS-04-04-03** Grading tables.
- [ ] **GS-04-04-04** Base size.
- [ ] **GS-04-04-05** Asymmetric rules.
- [ ] **GS-04-04-06** Piece-specific rules.
- [ ] **GS-04-04-07** Cross-size edits.
- [ ] **GS-04-04-08** Nested sizes.
- [ ] **GS-04-04-09** Rule reuse.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 04.05 Grading validation

- [ ] **GS-04-05-01** Seam lengths across sizes.
- [ ] **GS-04-05-02** No inverted curves.
- [ ] **GS-04-05-03** Allowance preservation.
- [ ] **GS-04-05-04** Balance notches.
- [ ] **GS-04-05-05** Measurement tolerances.
- [ ] **GS-04-05-06** Size run roundtrip.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 04.06 Measurement export

- [ ] **GS-04-06-01** POM diagrams.
- [ ] **GS-04-06-02** Size charts.
- [ ] **GS-04-06-03** Factory tolerance tables.
- [ ] **GS-04-06-04** Inspection point IDs.
- [ ] **GS-04-06-05** Printable measure diagrams.
- [ ] **GS-04-06-06** Change history.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

### 05 — Sewing graph, construction and 3D arrangement (P0)

#### 05.01 Sew links

- [ ] **GS-05-01-01** Edge interval selection.
- [ ] **GS-05-01-02** Segment sewing.
- [ ] **GS-05-01-03** Free sewing.
- [ ] **GS-05-01-04** Orientation arrows.
- [ ] **GS-05-01-05** Seam IDs.
- [ ] **GS-05-01-06** Multiple seam relationships.
- [ ] **GS-05-01-07** Arc-length remapping.
- [ ] **GS-05-01-08** Mismatch warnings.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 05.02 Stitch logic

- [ ] **GS-05-02-01** Seam line vs cut edge.
- [ ] **GS-05-02-02** Seam allowances.
- [ ] **GS-05-02-03** Notches.
- [ ] **GS-05-02-04** Ease/gather ratio.
- [ ] **GS-05-02-05** Differential feed.
- [ ] **GS-05-02-06** Stitch spacing.
- [ ] **GS-05-02-07** Sew order.
- [ ] **GS-05-02-08** Offset/unequal edges.
- [ ] **GS-05-02-09** Fold construction.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 05.03 Seam diagnostics

- [ ] **GS-05-03-01** Seam walk.
- [ ] **GS-05-03-02** Mismatch histogram.
- [ ] **GS-05-03-03** Reversed links.
- [ ] **GS-05-03-04** Self-links.
- [ ] **GS-05-03-05** T-junctions.
- [ ] **GS-05-03-06** Intersecting stitching.
- [ ] **GS-05-03-07** Dangling ends.
- [ ] **GS-05-03-08** Graph completeness.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 05.04 3D arrangement

- [ ] **GS-05-04-01** Panel transform.
- [ ] **GS-05-04-02** Arrangement points.
- [ ] **GS-05-04-03** Around-body shell.
- [ ] **GS-05-04-04** Orientation and flip.
- [ ] **GS-05-04-05** Flat pre-sew arrangement.
- [ ] **GS-05-04-06** No overlapping initial shell.
- [ ] **GS-05-04-07** Reversible staging.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 05.05 Construction features

- [ ] **GS-05-05-01** Facings.
- [ ] **GS-05-05-02** Collars.
- [ ] **GS-05-05-03** Cuffs.
- [ ] **GS-05-05-04** Vents.
- [ ] **GS-05-05-05** Lapels.
- [ ] **GS-05-05-06** Waistbands.
- [ ] **GS-05-05-07** Pockets.
- [ ] **GS-05-05-08** Darts.
- [ ] **GS-05-05-09** Pleats.
- [ ] **GS-05-05-10** Gussets.
- [ ] **GS-05-05-11** Multiple material panels.
- [ ] **GS-05-05-12** Lining.
- [ ] **GS-05-05-13** Fusible layers.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 05.06 Sewing UX

- [ ] **GS-05-06-01** Linked 2D/3D highlighting.
- [ ] **GS-05-06-02** Drag to sew.
- [ ] **GS-05-06-03** Sew/unsew.
- [ ] **GS-05-06-04** Seam inspector.
- [ ] **GS-05-06-05** Temporary tack.
- [ ] **GS-05-06-06** Seam edit after pattern deformation.
- [ ] **GS-05-06-07** Guided correction.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 05.07 Acceptance

- [ ] **GS-05-07-01** Manufacturer-style tee front/back/2 sleeves sewn by explicit oriented seams.
- [ ] **GS-05-07-02** Validate vertex correspondence.
- [ ] **GS-05-07-03** No orphan stitch endpoints across updates.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

### 06 — Mesh generation, correspondence and remeshing (P0)

#### 06.01 Mesher

- [ ] **GS-06-01-01** Metric target edge length.
- [ ] **GS-06-01-02** Constrained triangulation.
- [ ] **GS-06-01-03** Curve discretization.
- [ ] **GS-06-01-04** Seam boundary synchronization.
- [ ] **GS-06-01-05** Stable orientation.
- [ ] **GS-06-01-06** Aspect ratio limits.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 06.02 Topology mapping

- [ ] **GS-06-02-01** Source edge/point provenance.
- [ ] **GS-06-02-02** Barycentric face map.
- [ ] **GS-06-02-03** UVs.
- [ ] **GS-06-02-04** Grain direction.
- [ ] **GS-06-02-05** Remesh transferring pins, trims, seams, annotations and graphics.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 06.03 Adaptive remesh

- [ ] **GS-06-03-01** Refine at high curvature.
- [ ] **GS-06-03-02** Stress regions.
- [ ] **GS-06-03-03** Intersections and stitches.
- [ ] **GS-06-03-04** Coarsen stable zones.
- [ ] **GS-06-03-05** Preserve boundaries.
- [ ] **GS-06-03-06** Avoid invalid triangles.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 06.04 Mesh QA

- [ ] **GS-06-04-01** Inverted faces.
- [ ] **GS-06-04-02** Triangles with zero area.
- [ ] **GS-06-04-03** Nonmanifold edges.
- [ ] **GS-06-04-04** Duplicate vertices.
- [ ] **GS-06-04-05** Inconsistent normals.
- [ ] **GS-06-04-06** Slivers.
- [ ] **GS-06-04-07** Degenerate UV.
- [ ] **GS-06-04-08** Mesh convergence.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 06.05 Mesh authoring

- [ ] **GS-06-05-01** 2D-driven vs direct 3D mesh edits.
- [ ] **GS-06-05-02** Mesh selection.
- [ ] **GS-06-05-03** Brush/lasso.
- [ ] **GS-06-05-04** Garment stylelines.
- [ ] **GS-06-05-05** Pin topology.
- [ ] **GS-06-05-06** Maintain pattern ownership and save/load.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

### 07 — Body/garment contact, cloth physics and solver correctness (P0)

#### 07.01 Unified collider

- [ ] **GS-07-01-01** Same skinned posed avatar for display and collision.
- [ ] **GS-07-01-02** Body-only mesh separation.
- [ ] **GS-07-01-03** Transforms.
- [ ] **GS-07-01-04** BVH/SDF.
- [ ] **GS-07-01-05** Normals.
- [ ] **GS-07-01-06** Scale.
- [ ] **GS-07-01-07** Thickness.
- [ ] **GS-07-01-08** Joints.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 07.02 Body collision

- [ ] **GS-07-02-01** Continuous collision detection.
- [ ] **GS-07-02-02** Vertex-face and edge-edge sweeps.
- [ ] **GS-07-02-03** Signed penetration depth.
- [ ] **GS-07-02-04** Stable collision normals.
- [ ] **GS-07-02-05** Friction.
- [ ] **GS-07-02-06** Tunneling rejection.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 07.03 Self-contact

- [ ] **GS-07-03-01** Cloth-cloth triangle collision.
- [ ] **GS-07-03-02** Edge-edge.
- [ ] **GS-07-03-03** Layered collision.
- [ ] **GS-07-03-04** Near-fold precision.
- [ ] **GS-07-03-05** Robust broadphase.
- [ ] **GS-07-03-06** Thin-shell thickness.
- [ ] **GS-07-03-07** Nonlocal self-contact.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 07.04 Constraint coupling

- [ ] **GS-07-04-01** Sewing/contact/shape/bending solve coupled.
- [ ] **GS-07-04-02** Coherent compliance.
- [ ] **GS-07-04-03** No aggressive sequential projection.
- [ ] **GS-07-04-04** Convergence checks.
- [ ] **GS-07-04-05** Adaptive stepping.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 07.05 Material mechanics

- [ ] **GS-07-05-01** Measured anisotropic warp/weft.
- [ ] **GS-07-05-02** Bias and shear.
- [ ] **GS-07-05-03** Bending.
- [ ] **GS-07-05-04** Buckling.
- [ ] **GS-07-05-05** Damping.
- [ ] **GS-07-05-06** Friction.
- [ ] **GS-07-05-07** Thickness.
- [ ] **GS-07-05-08** Stretch recovery.
- [ ] **GS-07-05-09** Weight.
- [ ] **GS-07-05-10** Shrinkage.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 07.06 Gravity equilibrium

- [ ] **GS-07-06-01** Natural collar/shoulder contact.
- [ ] **GS-07-06-02** No floating.
- [ ] **GS-07-06-03** No upward bias.
- [ ] **GS-07-06-04** Stable settled kinetic energy.
- [ ] **GS-07-06-05** Hem hangs realistically.
- [ ] **GS-07-06-06** Drape under motion.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 07.07 Interactive controls

- [ ] **GS-07-07-01** Start/pause/reset.
- [ ] **GS-07-07-02** Staged sew.
- [ ] **GS-07-07-03** Drag/pin.
- [ ] **GS-07-07-04** Strain freeze.
- [ ] **GS-07-07-05** Wind and gravity.
- [ ] **GS-07-07-06** Deterministic pause/restart.
- [ ] **GS-07-07-07** Resimulate after edits.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 07.08 Long-run numerical stability

- [ ] **GS-07-08-01** Finite positions.
- [ ] **GS-07-08-02** Bounded kinetic/strain.
- [ ] **GS-07-08-03** 10k-step stress.
- [ ] **GS-07-08-04** Timestep/substep convergence.
- [ ] **GS-07-08-05** Mesh-size convergence.
- [ ] **GS-07-08-06** Fail closed on divergence.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 07.09 PPF/Metal bridge

- [ ] **GS-07-09-01** Physical stitch/contact integration.
- [ ] **GS-07-09-02** Quality-bake adapter.
- [ ] **GS-07-09-03** Exact input avatar/pattern snapshot.
- [ ] **GS-07-09-04** Solver job status.
- [ ] **GS-07-09-05** Output provenance.
- [ ] **GS-07-09-06** Failures not auto-accepted.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 07.10 Validation metrics

- [ ] **GS-07-10-01** Peak/p95 strain per region.
- [ ] **GS-07-10-02** Mean/p95/max stitch gap.
- [ ] **GS-07-10-03** Body and self intersections per frame.
- [ ] **GS-07-10-04** Depth in mm.
- [ ] **GS-07-10-05** Contact clearance.
- [ ] **GS-07-10-06** Silhouette.
- [ ] **GS-07-10-07** Runtime.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 07.11 Golden scenarios

- [ ] **GS-07-11-01** Tee at 160/180/200 cm.
- [ ] **GS-07-11-02** Arms down/out.
- [ ] **GS-07-11-03** Sleeves correct orientation.
- [ ] **GS-07-11-04** Hoodie.
- [ ] **GS-07-11-05** Fitted jeans.
- [ ] **GS-07-11-06** Pants.
- [ ] **GS-07-11-07** Multi-layer garment.
- [ ] **GS-07-11-08** Manipulations.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 07.12 Known urgent defects

- [ ] **GS-07-12-01** Floating/standing-off shirt.
- [ ] **GS-07-12-02** Seam vs shoulder constraint conflict.
- [ ] **GS-07-12-03** Prior massive strain.
- [ ] **GS-07-12-04** Final-frame PPF body and self intersections.
- [ ] **GS-07-12-05** Solver timeouts.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 07.13 Release gate

- [ ] **GS-07-13-01** No accepted fit unless complete dynamic trajectory passes contact, seam, strain, settling and geometry checks.
- [ ] **GS-07-13-02** Report failed criteria.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

### 08 — Auto fitting, pattern optimization and AI assembly (P1)

#### 08.01 Placement inference

- [ ] **GS-08-01-01** Infer panel-to-body anatomical region.
- [ ] **GS-08-01-02** Sleeve handness.
- [ ] **GS-08-01-03** Up direction.
- [ ] **GS-08-01-04** Front/back.
- [ ] **GS-08-01-05** Mirror errors.
- [ ] **GS-08-01-06** Clearance.
- [ ] **GS-08-01-07** Reversible staging.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 08.02 Auto seam recognition

- [ ] **GS-08-02-01** Candidate seam pairs ranked by geometry.
- [ ] **GS-08-02-02** Notches.
- [ ] **GS-08-02-03** Naming.
- [ ] **GS-08-02-04** Edge lengths.
- [ ] **GS-08-02-05** Sewing direction.
- [ ] **GS-08-02-06** Human confirmation and editable previews.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 08.03 Auto fit pipeline

- [ ] **GS-08-03-01** Pattern->staging->sew->simulate->metrics->candidate adjustments->retest.
- [ ] **GS-08-03-02** No silent source changes.
- [ ] **GS-08-03-03** Retain seed and snapshots.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 08.04 Fit adjustment

- [ ] **GS-08-04-01** Pattern length/width.
- [ ] **GS-08-04-02** Shoulder slope.
- [ ] **GS-08-04-03** Armhole.
- [ ] **GS-08-04-04** Sleeve cap.
- [ ] **GS-08-04-05** Ease.
- [ ] **GS-08-04-06** Hem.
- [ ] **GS-08-04-07** Rise.
- [ ] **GS-08-04-08** Inseam.
- [ ] **GS-08-04-09** Waistband.
- [ ] **GS-08-04-10** Localized objective functions.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 08.05 AI command system

- [ ] **GS-08-05-01** Typed editing API.
- [ ] **GS-08-05-02** Complete command coverage.
- [ ] **GS-08-05-03** Dry-run.
- [ ] **GS-08-05-04** Proposals.
- [ ] **GS-08-05-05** Preview.
- [ ] **GS-08-05-06** Undo/rollback.
- [ ] **GS-08-05-07** Schema validation.
- [ ] **GS-08-05-08** Permission scopes.
- [ ] **GS-08-05-09** Audit trail.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 08.06 Optimization QA

- [ ] **GS-08-06-01** Test fit score against withheld avatars.
- [ ] **GS-08-06-02** Do not trade penetration for seam closure.
- [ ] **GS-08-06-03** No overfitting one pose.
- [ ] **GS-08-06-04** Preserve garment identity.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

### 09 — Fabrics, trims, seam finishes and graphical decoration (P1)

#### 09.01 Fabric library

- [ ] **GS-09-01-01** Presets with measurement provenance.
- [ ] **GS-09-01-02** Fabric weight.
- [ ] **GS-09-01-03** Thickness.
- [ ] **GS-09-01-04** Stretch.
- [ ] **GS-09-01-05** Bending.
- [ ] **GS-09-01-06** Shear.
- [ ] **GS-09-01-07** Damping.
- [ ] **GS-09-01-08** Friction.
- [ ] **GS-09-01-09** Calibrated simulation conversion.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 09.02 Rendering maps

- [ ] **GS-09-02-01** Base color.
- [ ] **GS-09-02-02** Normal.
- [ ] **GS-09-02-03** Roughness.
- [ ] **GS-09-02-04** Metallic where applicable.
- [ ] **GS-09-02-05** Weave microdetail.
- [ ] **GS-09-02-06** Anisotropy.
- [ ] **GS-09-02-07** Translucency.
- [ ] **GS-09-02-08** Fuzz.
- [ ] **GS-09-02-09** Sheen.
- [ ] **GS-09-02-10** Displacement.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 09.03 Texture workflows

- [ ] **GS-09-03-01** UV.
- [ ] **GS-09-03-02** Tile/repeat.
- [ ] **GS-09-03-03** Grain alignment.
- [ ] **GS-09-03-04** Offset.
- [ ] **GS-09-03-05** Rotation.
- [ ] **GS-09-03-06** Fabric face and back.
- [ ] **GS-09-03-07** Plaids/stripes.
- [ ] **GS-09-03-08** Scale reference.
- [ ] **GS-09-03-09** Graphics mask and color space.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 09.04 Seam finishes

- [ ] **GS-09-04-01** Topstitch multi-line.
- [ ] **GS-09-04-02** Overlock.
- [ ] **GS-09-04-03** Zigzag.
- [ ] **GS-09-04-04** Coverstitch.
- [ ] **GS-09-04-05** Chain.
- [ ] **GS-09-04-06** Bartack.
- [ ] **GS-09-04-07** Thread properties.
- [ ] **GS-09-04-08** Stitch distance and density.
- [ ] **GS-09-04-09** Separate print vs sim detail.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 09.05 Trims

- [ ] **GS-09-05-01** Buttons.
- [ ] **GS-09-05-02** Buttonholes.
- [ ] **GS-09-05-03** Snaps.
- [ ] **GS-09-05-04** Zippers.
- [ ] **GS-09-05-05** Drawstrings.
- [ ] **GS-09-05-06** Buckles.
- [ ] **GS-09-05-07** Eyelets.
- [ ] **GS-09-05-08** Labels.
- [ ] **GS-09-05-09** Elastic.
- [ ] **GS-09-05-10** Grommets.
- [ ] **GS-09-05-11** 2D placement and 3D attachment.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 09.06 Structural components

- [ ] **GS-09-06-01** Interfacing.
- [ ] **GS-09-06-02** Fusing.
- [ ] **GS-09-06-03** Padding.
- [ ] **GS-09-06-04** Quilt/trapunto.
- [ ] **GS-09-06-05** Inner/outer layers.
- [ ] **GS-09-06-06** Collision ordering.
- [ ] **GS-09-06-07** Stiffness layers.
- [ ] **GS-09-06-08** Welt/pocket construction.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 09.07 Decorations

- [ ] **GS-09-07-01** Decals.
- [ ] **GS-09-07-02** Placement prints.
- [ ] **GS-09-07-03** Embroidery preview.
- [ ] **GS-09-07-04** Patches.
- [ ] **GS-09-07-05** Applique.
- [ ] **GS-09-07-06** PBR graphic material.
- [ ] **GS-09-07-07** Print/export positions.
- [ ] **GS-09-07-08** Asset anchoring.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 09.08 Material acceptance

- [ ] **GS-09-08-01** Calibration swatches.
- [ ] **GS-09-08-02** Stable saving.
- [ ] **GS-09-08-03** Physical parameters validated separately from appearance.
- [ ] **GS-09-08-04** Consistent UV and print sizes.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

### 10 — 3D editing, viewport and fit inspection (P1)

#### 10.01 Camera navigation

- [ ] **GS-10-01-01** Orbit/pan/zoom.
- [ ] **GS-10-01-02** Focal-point tracking.
- [ ] **GS-10-01-03** Front/back/side.
- [ ] **GS-10-01-04** Orthographic/perspective.
- [ ] **GS-10-01-05** Bookmarks.
- [ ] **GS-10-01-06** Camera reset.
- [ ] **GS-10-01-07** Focus selection.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 10.02 3D selection

- [ ] **GS-10-02-01** Piece.
- [ ] **GS-10-02-02** Face.
- [ ] **GS-10-02-03** Vertex.
- [ ] **GS-10-02-04** Edge.
- [ ] **GS-10-02-05** Box/lasso/brush.
- [ ] **GS-10-02-06** Additive/subtractive selection.
- [ ] **GS-10-02-07** Hidden/locked logic.
- [ ] **GS-10-02-08** Accuracy near occlusion.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 10.03 Manipulators

- [ ] **GS-10-03-01** Translate/rotate/scale.
- [ ] **GS-10-03-02** Axis/plane.
- [ ] **GS-10-03-03** Numeric transform.
- [ ] **GS-10-03-04** Snapping.
- [ ] **GS-10-03-05** Local/world.
- [ ] **GS-10-03-06** Pivot.
- [ ] **GS-10-03-07** Multi-select.
- [ ] **GS-10-03-08** Undo.
- [ ] **GS-10-03-09** Mapping from 3D to 2D.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 10.04 Styleline editing

- [ ] **GS-10-04-01** Draw 3D lines.
- [ ] **GS-10-04-02** Wrap/snap on garment surface.
- [ ] **GS-10-04-03** Surface cut.
- [ ] **GS-10-04-04** Propagate splits to 2D.
- [ ] **GS-10-04-05** Re-sew.
- [ ] **GS-10-04-06** Remesh.
- [ ] **GS-10-04-07** Preserve fabric assignments.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 10.05 Pins and attachments

- [ ] **GS-10-05-01** Pin to avatar or world.
- [ ] **GS-10-05-02** Sticky point.
- [ ] **GS-10-05-03** Position constraints.
- [ ] **GS-10-05-04** Delete and edit.
- [ ] **GS-10-05-05** Stable save/load.
- [ ] **GS-10-05-06** Collision during direct garment drag.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 10.06 Fit diagnosis

- [ ] **GS-10-06-01** Strain/pressure/contact heatmaps.
- [ ] **GS-10-06-02** Ease map.
- [ ] **GS-10-06-03** Tension arrows.
- [ ] **GS-10-06-04** Length comparisons.
- [ ] **GS-10-06-05** Panel overlaps.
- [ ] **GS-10-06-06** Visual seam/collider wireframes.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 10.07 Viewport QA

- [ ] **GS-10-07-01** Screen-space picking.
- [ ] **GS-10-07-02** High DPI.
- [ ] **GS-10-07-03** 2D/3D focus sync.
- [ ] **GS-10-07-04** Z-fighting.
- [ ] **GS-10-07-05** Culling.
- [ ] **GS-10-07-06** Transparent fabric sorting.
- [ ] **GS-10-07-07** Outline stability.
- [ ] **GS-10-07-08** GPU disposal.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

### 11 — Avatars, body measurement, poses and animation (P1)

#### 11.01 Avatar library

- [ ] **GS-11-01-01** Male/female body presets.
- [ ] **GS-11-01-02** Thomas and custom models.
- [ ] **GS-11-01-03** Height/shape variety.
- [ ] **GS-11-01-04** Realistic silhouettes.
- [ ] **GS-11-01-05** Anatomically grounded dimensions.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 11.02 Import and rig

- [ ] **GS-11-02-01** GLB/FBX/USD import feasibility.
- [ ] **GS-11-02-02** Skeleton validation.
- [ ] **GS-11-02-03** Skinning weights.
- [ ] **GS-11-02-04** Scaling.
- [ ] **GS-11-02-05** Body-region tags.
- [ ] **GS-11-02-06** Clothing/skin separation.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 11.03 Shape editor

- [ ] **GS-11-03-01** Body circumferences.
- [ ] **GS-11-03-02** Proportions.
- [ ] **GS-11-03-03** Anatomical ranges.
- [ ] **GS-11-03-04** Symmetry.
- [ ] **GS-11-03-05** Landmarks.
- [ ] **GS-11-03-06** Pose-safe modifications.
- [ ] **GS-11-03-07** Body scan import path.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 11.04 Pose system

- [ ] **GS-11-04-01** Standing.
- [ ] **GS-11-04-02** T/A pose.
- [ ] **GS-11-04-03** Arms raised.
- [ ] **GS-11-04-04** Walking.
- [ ] **GS-11-04-05** Seated.
- [ ] **GS-11-04-06** Joint limits.
- [ ] **GS-11-04-07** Collision mesh updates from posed rig.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 11.05 Motion and animation

- [ ] **GS-11-05-01** Timeline.
- [ ] **GS-11-05-02** Keyframes.
- [ ] **GS-11-05-03** Rig clips.
- [ ] **GS-11-05-04** Retargeting.
- [ ] **GS-11-05-05** Blend.
- [ ] **GS-11-05-06** Physical cloth playback.
- [ ] **GS-11-05-07** Baked cache.
- [ ] **GS-11-05-08** Collision safe movement.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 11.06 Export

- [ ] **GS-11-06-01** Avatar mesh/rig.
- [ ] **GS-11-06-02** Clothing sim sequence.
- [ ] **GS-11-06-03** UV and materials.
- [ ] **GS-11-06-04** Blender bridge.
- [ ] **GS-11-06-05** Consistent scale and frame rate.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

### 12 — Rendering, lighting and presentation (P2)

#### 12.01 PBR

- [ ] **GS-12-01-01** Correct material layers.
- [ ] **GS-12-01-02** Physically plausible microtexture.
- [ ] **GS-12-01-03** Fabric sheen and fuzz.
- [ ] **GS-12-01-04** Thickness.
- [ ] **GS-12-01-05** Transmission.
- [ ] **GS-12-01-06** Consistent normal maps.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 12.02 Lights and environments

- [ ] **GS-12-02-01** HDRI.
- [ ] **GS-12-02-02** Area/key/rim lights.
- [ ] **GS-12-02-03** Floor and backdrop.
- [ ] **GS-12-02-04** Shadows.
- [ ] **GS-12-02-05** Ambient occlusion.
- [ ] **GS-12-02-06** Exposure.
- [ ] **GS-12-02-07** Tone mapping.
- [ ] **GS-12-02-08** Color management.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 12.03 Camera and output

- [ ] **GS-12-03-01** Camera presets.
- [ ] **GS-12-03-02** Saved views.
- [ ] **GS-12-03-03** Depth of field.
- [ ] **GS-12-03-04** Alpha background.
- [ ] **GS-12-03-05** High-res still.
- [ ] **GS-12-03-06** Turntable.
- [ ] **GS-12-03-07** Animation.
- [ ] **GS-12-03-08** Render queue and presets.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 12.04 Production handoff

- [ ] **GS-12-04-01** Blender import round-trip.
- [ ] **GS-12-04-02** UV validation.
- [ ] **GS-12-04-03** Material parity.
- [ ] **GS-12-04-04** Stable authored seam/trim positions.
- [ ] **GS-12-04-05** File names and metadata.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 12.05 Rendering QA

- [ ] **GS-12-05-01** Golden material scenes.
- [ ] **GS-12-05-02** Texture scale.
- [ ] **GS-12-05-03** Tone color consistency.
- [ ] **GS-12-05-04** GPU memory.
- [ ] **GS-12-05-05** Lighting differences tracked across engines.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

### 13 — Manufacturing, tech packs and factory-ready data (P1)

#### 13.01 Tech packs

- [ ] **GS-13-01-01** Cover sheet.
- [ ] **GS-13-01-02** Flats.
- [ ] **GS-13-01-03** BOM.
- [ ] **GS-13-01-04** POM.
- [ ] **GS-13-01-05** Specs.
- [ ] **GS-13-01-06** Graded measurements.
- [ ] **GS-13-01-07** Sketches.
- [ ] **GS-13-01-08** Construction notes.
- [ ] **GS-13-01-09** Colorways.
- [ ] **GS-13-01-10** Fit notes.
- [ ] **GS-13-01-11** Care labels.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 13.02 BOM

- [ ] **GS-13-02-01** Fabric and trim supplier metadata.
- [ ] **GS-13-02-02** Quantities.
- [ ] **GS-13-02-03** Unit of measure.
- [ ] **GS-13-02-04** Wastage.
- [ ] **GS-13-02-05** SKUs.
- [ ] **GS-13-02-06** Versions.
- [ ] **GS-13-02-07** Size/color variants.
- [ ] **GS-13-02-08** Costing hooks.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 13.03 Grading and sizes

- [ ] **GS-13-03-01** Nested cut outlines.
- [ ] **GS-13-03-02** Per-size allowances and notches.
- [ ] **GS-13-03-03** Growth equations.
- [ ] **GS-13-03-04** No invalid patterns.
- [ ] **GS-13-03-05** Factory style size tables.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 13.04 Marker making

- [ ] **GS-13-04-01** Width/roll constraints.
- [ ] **GS-13-04-02** Grain and nap.
- [ ] **GS-13-04-03** Ply.
- [ ] **GS-13-04-04** Multi-size.
- [ ] **GS-13-04-05** Defect avoidance.
- [ ] **GS-13-04-06** Nesting.
- [ ] **GS-13-04-07** Stripe/plaid matching.
- [ ] **GS-13-04-08** Yield/utilization report.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 13.05 Construction annotations

- [ ] **GS-13-05-01** Seam type.
- [ ] **GS-13-05-02** Topstitch.
- [ ] **GS-13-05-03** Stitch density.
- [ ] **GS-13-05-04** Notches.
- [ ] **GS-13-05-05** Drill points.
- [ ] **GS-13-05-06** Cut-on-fold.
- [ ] **GS-13-05-07** Facing.
- [ ] **GS-13-05-08** Fusing.
- [ ] **GS-13-05-09** Operation instructions.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 13.06 Validation and approvals

- [ ] **GS-13-06-01** Tolerances.
- [ ] **GS-13-06-02** Measured sample vs target.
- [ ] **GS-13-06-03** Issue log.
- [ ] **GS-13-06-04** Comments.
- [ ] **GS-13-06-05** Approval revisions.
- [ ] **GS-13-06-06** Export manifest.
- [ ] **GS-13-06-07** Audit history.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 13.07 Exports

- [ ] **GS-13-07-01** Print PDF.
- [ ] **GS-13-07-02** SVG.
- [ ] **GS-13-07-03** DXF.
- [ ] **GS-13-07-04** AAMA/ASTM compatibility feasibility.
- [ ] **GS-13-07-05** Units.
- [ ] **GS-13-07-06** Layers.
- [ ] **GS-13-07-07** Rotations.
- [ ] **GS-13-07-08** Graded marker.
- [ ] **GS-13-07-09** Factory ZIP.
- [ ] **GS-13-07-10** Exact plot scale.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 13.08 Factory acceptance

- [ ] **GS-13-08-01** Vendor sample fixtures.
- [ ] **GS-13-08-02** Preserve notches/internal lines/grainline/quantity/angles.
- [ ] **GS-13-08-03** Round-trip report.
- [ ] **GS-13-08-04** No loss without warning.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

### 14 — File formats, asset management and interoperability (P1)

#### 14.01 Native format

- [ ] **GS-14-01-01** Versioned project.
- [ ] **GS-14-01-02** Deterministic serialization.
- [ ] **GS-14-01-03** Round-trip identical geometry.
- [ ] **GS-14-01-04** Link external assets.
- [ ] **GS-14-01-05** Inline vs reference policy.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 14.02 2D interchange

- [ ] **GS-14-02-01** DXF open/save.
- [ ] **GS-14-02-02** Standards compatibility.
- [ ] **GS-14-02-03** Curves and construction lines.
- [ ] **GS-14-02-04** Mm/in.
- [ ] **GS-14-02-05** Rotation.
- [ ] **GS-14-02-06** Line layers.
- [ ] **GS-14-02-07** Notches.
- [ ] **GS-14-02-08** Grading.
- [ ] **GS-14-02-09** Warnings.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 14.03 3D interchange

- [ ] **GS-14-03-01** OBJ.
- [ ] **GS-14-03-02** GLB.
- [ ] **GS-14-03-03** GlTF.
- [ ] **GS-14-03-04** FBX where practical.
- [ ] **GS-14-03-05** USD.
- [ ] **GS-14-03-06** Morph/rig.
- [ ] **GS-14-03-07** UVs.
- [ ] **GS-14-03-08** Textures.
- [ ] **GS-14-03-09** Animation.
- [ ] **GS-14-03-10** Blender and DCC consistency.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 14.04 CLO compatibility

- [ ] **GS-14-04-01** Document unsupported proprietary formats.
- [ ] **GS-14-04-02** Investigate lawful supported import/export paths.
- [ ] **GS-14-04-03** No claim of native .zprj round-trip without tests.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 14.05 Asset catalogue

- [ ] **GS-14-05-01** Thumbnails.
- [ ] **GS-14-05-02** Tagging.
- [ ] **GS-14-05-03** Search.
- [ ] **GS-14-05-04** Import folders.
- [ ] **GS-14-05-05** Deduplicate.
- [ ] **GS-14-05-06** Relocate/relink.
- [ ] **GS-14-05-07** Categories.
- [ ] **GS-14-05-08** Versions.
- [ ] **GS-14-05-09** Permissions.
- [ ] **GS-14-05-10** Starter content.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 14.06 External workflow

- [ ] **GS-14-06-01** Seamly2D import.
- [ ] **GS-14-06-02** GarmentCode procedural apparel.
- [ ] **GS-14-06-03** Blender exports.
- [ ] **GS-14-06-04** Documented transform and naming contracts.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

### 15 — Quality assurance, benchmarks, observability and release (P0)

#### 15.01 Coverage matrix

- [ ] **GS-15-01-01** Every toolbar/command linked to implementation, model mutation, undo/redo, save/reload, exports and screenshots.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 15.02 Unit tests

- [ ] **GS-15-02-01** Geometry precision.
- [ ] **GS-15-02-02** Constraints.
- [ ] **GS-15-02-03** Grading.
- [ ] **GS-15-02-04** Measure.
- [ ] **GS-15-02-05** Sew ranges.
- [ ] **GS-15-02-06** Seam allowances.
- [ ] **GS-15-02-07** Math edge cases.
- [ ] **GS-15-02-08** Zero/NaN guards.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 15.03 Integration tests

- [ ] **GS-15-03-01** 2D edit->3D->save->load->export.
- [ ] **GS-15-03-02** Fabric->renderer/sim.
- [ ] **GS-15-03-03** Avatar pose->collision.
- [ ] **GS-15-03-04** AI API->undo.
- [ ] **GS-15-03-05** Services restart.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 15.04 UI E2E

- [ ] **GS-15-04-01** Native click paths.
- [ ] **GS-15-04-02** Dropdown/flyout.
- [ ] **GS-15-04-03** Right click.
- [ ] **GS-15-04-04** Drag.
- [ ] **GS-15-04-05** Context menus.
- [ ] **GS-15-04-06** Automated fixture screenshot.
- [ ] **GS-15-04-07** Stable selectors.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 15.05 Physics regressions

- [ ] **GS-15-05-01** Continuous-frame contact/strain/closure/energy metrics.
- [ ] **GS-15-05-02** Deterministic runs.
- [ ] **GS-15-05-03** No fake PASS from initial/last-frame-only checks.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 15.06 Performance

- [ ] **GS-15-06-01** Cold start.
- [ ] **GS-15-06-02** Load 100 pattern pieces.
- [ ] **GS-15-06-03** Memory growth.
- [ ] **GS-15-06-04** Target 2D latency.
- [ ] **GS-15-06-05** Frame rate.
- [ ] **GS-15-06-06** 3D select latency.
- [ ] **GS-15-06-07** Simulation throughput.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 15.07 Crash/error handling

- [ ] **GS-15-07-01** Malformed project.
- [ ] **GS-15-07-02** Failed assets.
- [ ] **GS-15-07-03** Missing native service.
- [ ] **GS-15-07-04** Unexpected EOF.
- [ ] **GS-15-07-05** Cancel job.
- [ ] **GS-15-07-06** Disk full.
- [ ] **GS-15-07-07** Sleep/resume.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 15.08 Benchmark comparison

- [ ] **GS-15-08-01** Same avatar/pattern/material/pose/time against licensed CLO build.
- [ ] **GS-15-08-02** Record version.
- [ ] **GS-15-08-03** Source assets.
- [ ] **GS-15-08-04** Silhouette metrics.
- [ ] **GS-15-08-05** Manual expert review.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 15.09 Automation and CI

- [ ] **GS-15-09-01** Unit/visual/nightly solver jobs.
- [ ] **GS-15-09-02** CI artifact reports.
- [ ] **GS-15-09-03** Reproducible dependencies.
- [ ] **GS-15-09-04** Release smoke test.
- [ ] **GS-15-09-05** Regression triage.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 15.10 Security/licensing

- [ ] **GS-15-10-01** Local service binding.
- [ ] **GS-15-10-02** File path validation.
- [ ] **GS-15-10-03** Resource limits.
- [ ] **GS-15-10-04** No arbitrary script injection.
- [ ] **GS-15-10-05** SBOM.
- [ ] **GS-15-10-06** GPL/LGPL compliance.
- [ ] **GS-15-10-07** Import provenance.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 15.11 Release gates

- [ ] **GS-15-11-01** P0 zero known data loss.
- [ ] **GS-15-11-02** No fake supported feature.
- [ ] **GS-15-11-03** Native app smoke.
- [ ] **GS-15-11-04** Saved sample opens.
- [ ] **GS-15-11-05** Published known limitations.
- [ ] **GS-15-11-06** Rollback plan.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

### 16 — Documentation, examples, onboarding and productization (P2)

#### 16.01 User journeys

- [ ] **GS-16-01-01** First tee.
- [ ] **GS-16-01-02** Hoodie.
- [ ] **GS-16-01-03** Jeans.
- [ ] **GS-16-01-04** Custom pattern.
- [ ] **GS-16-01-05** Import CAD.
- [ ] **GS-16-01-06** Auto fit.
- [ ] **GS-16-01-07** Garment edit.
- [ ] **GS-16-01-08** Factory tech pack.
- [ ] **GS-16-01-09** Render demo.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 16.02 Training

- [ ] **GS-16-02-01** Step-by-step tool tips.
- [ ] **GS-16-02-02** Videos.
- [ ] **GS-16-02-03** Keyboard cheatsheet.
- [ ] **GS-16-02-04** 2D/3D correspondence explanations.
- [ ] **GS-16-02-05** Glossary and search.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 16.03 Developer docs

- [ ] **GS-16-03-01** Architecture.
- [ ] **GS-16-03-02** Schema and migrations.
- [ ] **GS-16-03-03** IPC APIs.
- [ ] **GS-16-03-04** Solver flags.
- [ ] **GS-16-03-05** Profile/repro commands.
- [ ] **GS-16-03-06** Accepted benchmarks.
- [ ] **GS-16-03-07** Contribution guidance.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 16.04 Support

- [ ] **GS-16-04-01** Diagnostic bundle.
- [ ] **GS-16-04-02** Redaction.
- [ ] **GS-16-04-03** Known issues.
- [ ] **GS-16-04-04** Reproducible steps.
- [ ] **GS-16-04-05** Screenshots.
- [ ] **GS-16-04-06** Crash reporting privacy.
- [ ] **GS-16-04-07** Feedback tracking.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

#### 16.05 Product readiness

- [ ] **GS-16-05-01** Minimum useful feature tiers.
- [ ] **GS-16-05-02** MacOS support matrix.
- [ ] **GS-16-05-03** Offline operation.
- [ ] **GS-16-05-04** Accessibility.
- [ ] **GS-16-05-05** Install/update quality.
- [ ] **GS-16-05-06** License review.

**Acceptance:** Demonstrate this subsection using a real garment/project fixture, record intended data mutation and undo/redo/save/load, test precise geometry or physical metrics when relevant, and attach before/after evidence with an automated assertion.

## 4. Confirmed / recorded failures and diagnostic worklist

These are not speculative parity wishes; they come from the existing engineering audit and need current-build reproduction before a bug is closed.

- [ ] **BUG-001 Floating shirt:** reproduce body-to-neck/shoulder clearance and collar lift with current Thomas geometry; diagnose competing anchors and collider overlap; fix; verify all frames.
- [ ] **BUG-002 Excess strain:** prior 180 cm tee scenario recorded peak ~546% relative extension; reproduce with version/preset, locate source constraints, reduce to measured material tolerances, not merely a permissive regression cap.
- [ ] **BUG-003 Dynamic intersections:** prior 10-frame PPF tee recorded final 177 avatar intersection pairs and 56 self-intersection pairs; retest; implement CCD/coupled contact and certify continuous trajectory.
- [ ] **BUG-004 Sewing/contact conflict:** quantify each solver pass residual and resulting displacement; remove seam reopenings and interpenetrations.
- [ ] **BUG-005 PPF long-sew timeout:** profile pathological contact graph; enforce cancellability and convergence thresholds, valid failure reporting.
- [ ] **BUG-006 Fixture identity:** ensure 2D source pattern, 3D pose, avatar scale and collider mesh have exactly matching transform/units and source IDs across backends.
- [ ] **BUG-007 UI QA selector ambiguity:** prior `scripts/qa-clo-interface.mjs` matched multiple “Free sewing” buttons. Replace brittle exact-name assumptions with semantic selectors; re-run native/browser E2E.
- [ ] **BUG-008 Grading test coverage:** prior audit found missing `scripts/check-grading.mjs` command; add explicit grading golden tests, then register in consolidated QA.
- [ ] **BUG-009 Mesh/styleline partial tooling:** audit currently disabled/planned controls and incomplete mesh selection styles; verify actual state after latest patches; implement true persistent operations with 2D mapping.
- [ ] **BUG-010 DXF fidelity beyond existing golden samples:** verify rotated buttonholes, grainlines, notches, internal lines, curves, nested graded pieces, scaling and industrial vendor interchange.
- [ ] **BUG-011 Browser visual QA timeout under concurrent builds:** isolate stable dedicated QA run and save success/failure artifacts rather than counting timeout as pass.
- [ ] **BUG-012 Multiple-actor edit safety:** document ownership, avoid resets/cleans and fixture overwrites; snapshot before destructive migrations; verify simultaneous native build processes do not race.

## 5. Milestones and dependency gates

| Milestone | Goal and deliverables | Blocking gates | Evidence required |
|---|---|---|---|
| M0: Document integrity | Canonical schema, action API, migrations, undo/save and source mapping | None | Open/modify/save/reopen/undo/redo across multiple fixtures |
| M1: Manufacturer-ready 2D | Exact CAD primitives/constraints, seam allowances, T-shirt/jeans base patterns | M0 | Golden numeric patterns, fixture import/export tolerances |
| M2: Seam graph & meshing | Durable edge IDs, seam orientation, adaptive mesh, complete flat-to-3D mapping | M0–M1 | Closed sewing graph and persistent remesh with stable mappings |
| M3: Physical fit truth | Unified avatar skin collider, CCD, coupled seam/contact, calibrated materials | M1–M2 | Zero unsafe crossings across trajectory, acceptable fabric strain/gaps |
| M4: Reliable auto-fit | Inferred arrangement, reversible tweaks and scored candidate acceptance | M3 | Tee fits at 160/180/200 cm across multiple poses |
| M5: Professional editing | 3D selection/stylelines, hierarchical browser, property editing, trims and fabrics | M0–M2 | Full multi-tool E2E CRUD + synchronized 2D/3D editing |
| M6: Factory outputs | Grading, BOM, POM, markers, standards-grounded export | M1,M5 | Vendor fixture cross-import and production package completeness |
| M7: Complete visuals | Avatar poses, rendering, animation, library and Blender interchange | M3,M5 | Consistent assets and approved rendered scenes |
| M8: Release quality | Native packaging, full regression, performance, security, docs | All previous | Release checklist, benchmark matrix, migration and recovery drills |

## 6. Focused next-pass implementation order

1. **Do not lose existing source:** inspect working tree, confirm local backups and running solver processes; note other agents editing files.
2. **Fix structural reliability first:** canonical schema, piece/edge/seam IDs, explicit unit conversion, command transactions and undo/save tests.
3. **Complete the precision drafting golden shirt:** true four-piece pattern, seam graph, measured allowances, tolerance and grading fixtures.
4. **Add full-trajectory physical quality gates before more visual tweaks:** per-frame body/self contact, strain, seam p95/max and settling using the exact posed Thomas collider.
5. **Couple solver contact, stitching and material behavior:** maintain correct arrangement; never accept a fit only because a render looks good.
6. **Close 3D/editor workflow gaps:** editable stylelines and mesh selection, hierarchical Object Browser and numeric inspector, all reversible.
7. **Industrial export and calibration:** validate apparel factory files on external consumers and versioned benchmark fixtures.
8. **Advance rendering, animation and asset library only after verified data integrity and fitting milestones are stable.

## 7. Ownership and reporting template

For each engineering pass record: `ID | current evidence | exact files | fixture | before metrics | implementation | after metrics | automated test output | manual screenshot | native app build | status | next blocker`. Statuses: `unreviewed`, `confirmed absent`, `partial`, `implemented-unverified`, `verified`, `blocked`. Do not promote `partial` to `verified` on build-pass alone.

## 8. Source material within this repository

- `docs/CLO3D_NON_SIMULATION_FULL_BUILD_AUDIT_2026-10-13.md`
- `docs/CLO3D_CLOTHING_SIMULATION_GAP_AUDIT_2026-10-13.md`
- `docs/GARMENT_STUDIO_NATIVE_ROADMAP.md`
- `docs/ZOZO_PPF_ON_BODY_INTEGRATION_2026-10-13.md`
- `docs/GARMENT_SIMULATION_NEXT_GEN.md`
- `docs/ARCHITECTURE.md`
- `docs/CLO_UI_TOOL_INVENTORY.md`
- `docs/PPF_PHYSICAL_SEWING_IMPLEMENTATION_2026-10-13.md`
- Source, fixtures and tests under `src/`, `native_backend/`, `ppf_backend/`, `blender_bridge/`, `scripts/` and `native_app/`.

**Inventory:** 17 major categories, 124 functional subcategories and 924 atomic feature checklist items, plus 12 concrete recorded bug investigations and 14 universal done gates.
