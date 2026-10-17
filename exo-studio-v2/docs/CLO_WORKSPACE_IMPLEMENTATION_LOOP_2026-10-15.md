# CLO3D vs Garment Studio: workspace and interface functionality loop

Date: **October 15, 2026**. Scope: observable desktop workspace, editing controls and ergonomic behavior. Reference: local running CLO Academic 7.0.242 / `Male_T-shirt.zpac`, CLO UI/tool index and the private screen capture documented in `docs/CLO_2D_REFERENCE_LAYOUT_DIFF_2026-10-14.md`. The comparison is inspired by the MIT `replica-skill` fixture matrix. It is **not** evidence that our fabric solver, command breadth or all CLO UI workflows have reached 90% parity.

## Baseline and measurable change

| Measured subset | Before | After | Limits |
| --- | ---: | ---: | --- |
| 43 selected CLO-inspired feature behaviors | 54.1% | **54.6%** | Much of the score concerns simulation/manufacturing; partial credit is 0.5. 17/25 must-have workflows still incomplete. |
| 8 selected interface behaviors | 68.4% | **71.1%** | Still missing floating/reparentable docks, full CLO tool index and full shortcut bindings. |
| CLO7 2D workspace chrome visual layout | 72.3% | **72.3%** | Content-masked area only; not 1:1 view composition or complete visual parity. |

The 0.5-point feature increase is *deliberately conservative*: despite major ergonomic improvement, **configurable workspace layouts remain `partial`** until true detachable docks are demonstrated; the **complete** keyboard mapping/tool search row moves from `no` to **`partial`**, not `yes`, because advanced CLO commands are not implemented. Command count is not CLO parity.

## Implemented functional changes

1. **CLO-style 3D + 2D window layout**: split, 3D-only and 2D-only modes keep both editor components mounted. Camera, selection, 2D pattern draft and undo state are unchanged when maximizing a window. View choice survives a browser/application reload via `garment-studio-workspace-windows-v1`, independent of the garment project key.
2. **Drag/keyboard resize between 3D and 2D**: center divider constrained to 20–80%, with Arrow Left/Right (5-point steps), Home/End and double-click 50/50 reset. Underlying position is CSS grid geometry, not decorative. Actual width increased **80 px** in the instrumented drag test.
3. **Collapsible asset Library and Property Editor**: side panel toggles release the actual grid widths. In the instrumented 1520 px test, the workspace gained **232 px** from Library collapse and another **392 px** from Property Editor collapse. The 2D drafting tool rail stays visible. Side history/library tabs reopen the panel. Collapse state is retained by custom workspace profiles and does not touch the garment document.
4. **Saved workspace profiles**: original Drafting/Sewing/Materials/Render presets now include viewport layout, split ratio, and browser/inspector visibility. Custom Save/Restore uses the existing workspace-profile key, independent of autosaved garments.
5. **Functional command finder**: `⌘K` or the titlebar search button opens a keyboard-accessible palette for **71 distinct implemented actions** derived from one shared menu index, including viewport arrangements, scene/trim/production browsers, point/curve/pin/ruler/sewing tools and existing file/edit commands. Search excludes all `null`/planned actions. Arrow keys and Enter dispatch through `executeStudioAction`; Escape closes the dialog without mutating the project. This is not a complete CLO keyboard shortcut map.

Implementation: `src/App.jsx`, `src/core/workspaceProfiles.js`, `src/core/workspaceCommandIndex.js`, `src/core/cloMenus.js`, `src/components/WorkspaceCommandPalette.jsx`, `src/components/CloUI.jsx`, `src/clo-neutral-theme.css`. No source-owned CLO icons or licensed assets copied.

## Browser acceptance

`npm run check:clo-workspace` / `node scripts/qa-clo-workspace-command-loop.mjs` uses an isolated `?testSession=tee` browser context, asserts control geometry and actual 2D/3D visibility, checks native PDF-like split resizing, saved/restored layouts, hidden side panels, searchable menu actions (sewing, pin and measure), excludes unsupported Animation, and compares the actual before/after garment **pieces, seams, fabrics and revision**. **Passed; zero browser errors**, screenshot `qa-clo-workspace-functional-20261015.png`.

Existing regressions also pass:

- `node scripts/qa-clo-interface.mjs`: 14 menus, 10 object-browser tabs, 34 distinct right-rail icons, working sewing and fabric workflows.
- `npm run check:2d-nonblocking`: direct 2D pattern dragging remains unobstructed.
- `npm run check:clo-2d-visual`: chrome score remains 72.3; no unsupported visual similarity claim.
- `npm run build`: production build passes.
- `npm run check:clo-parity-ci`: report and all source evidence paths match matrix.

## Still required for objectively defensible 90% interface/workspace parity

- **CLO-grade docking**: genuine detachable/reparentable Object Browser, Property Editor and editor windows, remembering dock positions across sessions, not only resizing/collapsing within a fixed grid.
- **CLO tool-by-tool control coverage**: complete published toolbar index and context-sensitive popovers. The two-column SVG rail has 34 slots; some specialized physics/sewing commands remain disabled or incomplete. Test each action against real pattern/solver changes rather than icon presence.
- **Inspector depth**: full context-sensitive numeric editing across patterns, sewing, grading, trims, avatar and rendering, including multi-selection and batch operations.
- **Version-matched visual audit**: same viewport size and identical garment/test state compared with licensed CLO7, plus individual screenshot crops for Object Browser, fabric editor, history, tool menus and 2D/3D selected objects.
- **Native desktop cutover**: new C++/Qt editor has a separate scaffold, but no signed fully native Qt replacement has been deployed. Its process/UI state must remain independent of this React/WebKit workspace until tests pass.

**Verdict:** substantial functional improvements completed; the requested **90% full interface/workspace parity has NOT been verified or reached**. Continue by implementing docking and fuller inspector/tool behavior; never elevate partial evidence to full parity or assume physics improves with UI changes.
