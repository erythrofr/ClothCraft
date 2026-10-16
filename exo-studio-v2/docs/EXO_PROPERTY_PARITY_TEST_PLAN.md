# EXO V2 contextual Property Editor parity QA

## Run

From the V2 project root: `node integrations/clothcraft/qa-v2-property-context-extended.mjs`.

This starts one disposable Vite application on port 5482 and an isolated native Rust bridge service on port 5481; it uses one headless Chrome browser and terminates spawned process groups. Screenshots and service workspace data go under `integrations/clothcraft/output/qa-property-context-*`. The primary browser route is `/?desktop=1`, the EXO draft editor, because `CloObjectPropertyFields` explicitly edits EXO draft records and rejects edits to the Rust garment. The bridge health check is verified, but native garment startup and selection are intentionally separate acceptance tests.

## Verified on October 16, 2026

The isolated browser test passed: JavaScript errors `[]`; the first Scene row selects the Avatar and exposes only Information / Miscellaneous, without editable garment fields. The second Scene row selects a pattern and exposes eight editor groups. Fabric selection narrows to Information / Simulation Properties / Fabric / Miscellaneous; the original drafting portal survives collapsing Arrange. Pattern name and fabric name changes persist and Undo restores originals. A cut quantity of 101 and fabric GSM of 0 each cause an explicit validation error, with no valid save; editable fabric thickness and color controls appear. Topstitch fixture shows Stitch Length, Offset, Number of Lines, Line Distance, Thread Color; stitch length updates and project Undo restores it. Button tab is present but this fixture has no button instances, so button mutation was skipped and cannot be marked passed.

## Native loading investigation

The prior test navigated `/?desktop=1&engine=clothcraft` and waited for `.cc-board [data-edge]`. It timed out after 50 seconds, even though the isolated bridge `/health` and Vite root both became ready. This observation does not establish whether snapshot initialization, native Rust session state, embedded rendering, or a client-side error caused the blank board. Native line geometry, 2D/3D length consistency and the agent API mutation guard must be verified separately by `qa-v2-selected-line.mjs` after diagnosing the native snapshot response and embedded workspace errors. Passing `/health` alone does not prove a ready garment session.

## Remaining acceptance work

Add a real button fixture, then assert Diameter (cm), Holes, Color, 2D X/Y placement, invalid value rejection and Undo. Add selected-edge, pattern, seam and 3D native material fixtures and independently measure native UV/live vertices before asserting 2D and 3D centimeter readouts. Verify line target-length revision guards and read-only `line.inspect` once the native board loads. Add reference screenshots for each category and verify actual physical features only after corresponding solver capabilities exist. Elastic, Seam Taping, Bond and Solidify UI descriptions do not establish solver support.
