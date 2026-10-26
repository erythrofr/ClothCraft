# Avatar collision diagnostics

Open **Properties → Simulation → Avatar collision diagnostics**.
These controls inspect the actual static triangle surface used by collision,
independently of cosmetic avatar visibility. They do not repair geometry,
change contact parameters or advance the cloth.

- **Inspect collision mesh** computes referenced-vertex bounds in metres,
  dimensions, vertex/triangle counts, open edges, edges with more than two faces,
  inconsistent orientation across two-face edges and duplicate index triples.
  Unreferenced vertices count toward source identity but not collision bounds.
- **Check current initialization** additionally constructs an independent CPU
  VBD instance with a copy of the current cloth state and the same garment and
  avatar geometry. This reuses the production initialization gate, including
  its local sewing exclusions, and discards that instance without stepping.
  Pause simulation first; the control is disabled while the worker is pending.

The two operations run on a separate CPU thread. At most one inspection is
pending per editor context; another click cannot queue extra work. Ordinary
repaints only read the result. A small report is retained with the captured
surface, generation and physical timestamp. The UI marks it stale after
editing/replacement; an initialization check also expires after simulation
advances. A static geometry-only inspection remains valid while cloth moves.
Failures remain visible and do not replace a live worker or warm its caches.

The report's `avatar-v1-…` fingerprint is deterministic, order-sensitive FNV-1a
over vertex coordinates and triangle indices. It identifies the inspected data;
it is neither a security hash nor proof of geometric equivalence. Reindexing an
otherwise equivalent surface changes it. Vertices are not welded for analysis.

## Interpreting the result

An open edge can be deliberate. Nonmanifold or inconsistent edges require
inspection, but the report does not silently flip, close or simplify anything.
Zero topology warnings **does not prove absence of self-intersections**, correct
outward orientation, a physically valid avatar or a globally exterior garment.
Duplicate positions with different indices are not merged. This is not a
topology repair tool or an animated/skinned-avatar evaluator.

A passed initialization check means only that the existing VBD constructor
accepted the **captured** arrangement. It checks the applicable cloth/cloth and
cloth/avatar start conditions with the solver's sewing exclusions. Static/static
avatar intersections and global inside/outside containment are not certified.
An entirely embedded but separated garment is not made valid by a passing gate.
The tool reports the existing gate's error rather than substituting a looser
collision approximation. It is distinct from **Sample final state**, which
measures an accepted simulation step's residual and contacts.

The active VBD/OGC radius is displayed separately from the reference penalty
collider's clearance and stiffness. The latter are not the current VBD contact
law. No numerical envelope is presented as cosmetic mesh thickness.

## Evidence and implementation

`avatar::diagnostics` owns the CPU report and isolated initialization call.
`atelier/avatar_diagnostics.rs` owns the inspector, bounded background request
and result freshness; `chrome.rs` hosts its controls. No solver implementation
or document schema is modified.

CPU fixtures cover closed/open/nonmanifold/inconsistently oriented surfaces,
duplicate faces, unused vertices, invalid inputs and deterministic identity.
The bundled mannequin was independently counted as 13,380 vertices and 26,756
triangles with no open/nonmanifold/inconsistent two-face edges in its index
topology. That observation is not an intersection certificate. A touching
cloth/avatar fixture exercises rejection while preserving the input state.
Named-widget tests exercise real inspector controls, refresh/staleness, pause
requirements, asynchronous completion, failed initialization and disconnected
worker recovery. Native GPU rendering/visual acceptance is separate.

The pinned [EXO reference](https://github.com/mikristian/exo-sample-3d/blob/352c6086b622caeda95f16d9bd923624b95e05d9/src/core/meshAvatarContact.js)
was read for its explicit static-proxy coverage/counts and uncertified-contact
reporting. Its positional correction and ray-parity implementation are not used.
The Rust inspection and tests are independent implementations over ClothCraft's
existing collider and VBD constructor.
