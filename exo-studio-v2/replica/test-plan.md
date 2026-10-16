# CLO3D parity test plan

Conventions from MIT-licensed
[replica-test](https://github.com/Jakeschincariol/replica-skill):
name each flow and its happy, error and edge cases; test the independent
Garment Studio implementation rather than automating CLO3D.

| Case | Expected behavior | Current status / executable evidence |
| --- | --- | --- |
| F01-H1 | Drag selected pattern from fill without popup | PASS: `npm run check:2d-nonblocking` |
| F01-E1 | Drag selected pattern from an overlapping edge hit target | PASS: `npm run check:2d-nonblocking` |
| F01-E2 | Right click/trackpad gesture does not open obstructive menu | PASS: `npm run check:2d-nonblocking` |
| F01-E3 | Locked piece cannot move | TO TEST separately on a locked piece |
| F01-E4 | Move garment after save/open and Undo | TO TEST full persisted history |
| F02-H1 | Numeric point XY commits with Undo and Redo | PASS: `npm run check:drafting-ui` |
| F02-H2 | Curve chord/absolute handles and straightening | PASS: `npm run check:drafting-ui` |
| F02-E1 | Degenerate point and construction geometry rejected | PASS: `npm run check:drafting-constructions` |
| F02-E2 | Self-intersecting edits rejected with ID stability | NOT IMPLEMENTED universally |
| F03-H1 | Complete sewn shirt fits avatar collision-free | FAIL: physics fit audit, acceptance closed |
| F03-E1 | Invalid solver output rejected not shown as accepted | PASS: `npm run check:ppf-acceptance` |
| F03-E2 | First-pose seam gap fails closed above 3 cm | PASS: PPF audit |
| F04-H1 | Optical fabric edits preserve cloth simulation session | PASS: `npm run check:clo-layout-fabric-ui` |
| F04-H2 | PBR texture maps and nonempty PNG render | PASS: `npm run check:render-still` |
| F04-E1 | Path-traced image matches calibrated swatch | NOT IMPLEMENTED |
| F05-H1 | DXF round-trip and allowances maintain measured geometry | PASS on test fixtures: `npm run check:non-simulation` |
| F05-E1 | Industrial format interchange across external CAD suite | NOT CERTIFIED |
| F06-H1 | Resize adjacent 3D and 2D windows by dragging middle divider | PASS: `node scripts/qa-clo-workspace-command-loop.mjs` |
| F06-H2 | Maximize either 2D or 3D and restore split windows without losing pattern state | PASS: `node scripts/qa-clo-workspace-command-loop.mjs` |
| F06-H3 | Save custom workspace with 2D-only view and restore after switching to Render layout | PASS: `node scripts/qa-clo-workspace-command-loop.mjs` |
| F06-E1 | Collapsing asset library and inspector gives real window space back | PASS: `node scripts/qa-clo-workspace-command-loop.mjs` |
| F06-E2 | Workspace changes leave garment pieces, seams, fabrics and revision unchanged | PASS: `node scripts/qa-clo-workspace-command-loop.mjs` |
| F06-H4 | Stack 3D above 2D and independently drag/keyboard-resize the horizontal divider | PASS: `node scripts/qa-clo-workspace-command-loop.mjs` |
| F07-H1 | ⌘K searches implemented commands and dispatches sewing, pin and measure tools | PASS: `node scripts/qa-clo-workspace-command-loop.mjs` |
| F07-E1 | Unsupported Animation command is not presented as working | PASS: `node scripts/qa-clo-workspace-command-loop.mjs` |
| F07-E2 | Command palette Escape closes without mutating garment | PASS: `node scripts/qa-clo-workspace-command-loop.mjs` |
| F08-H1 | Fully user-detachable floating 2D / 3D / inspector windows like CLO | NOT IMPLEMENTED; static grid with collapsible sidebars and divider only |
| F09-H1 | Jump to an earlier real garment snapshot in History, then Redo every skipped document edit | PASS: `node scripts/qa-clo-workspace-history.mjs` |
| F09-E1 | History revision jump restores source patterns, seams and fabrics exactly | PASS: `node scripts/qa-clo-workspace-history.mjs` |

Do not mark missing cases as passed because a toolbar button exists. When a
new functionality claim is added to the feature matrix, add a matching
behavioral acceptance case here and link the relevant regression script.
