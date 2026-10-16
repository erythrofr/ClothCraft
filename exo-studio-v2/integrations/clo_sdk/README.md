# MIKRISTIAN CLO Operator — native CLO SDK bridge

**Status:** live CLO 7.0.242 native bridge registered, inspected and `.zprj` save-tested successfully on 2026-10-12. Native SDK simulation test **stalled** and the process was later restarted; it is disabled by default. DXF import is coded but not yet live verified.

## Verified environment

- Installed application: `/Applications/CLO_Standalone_OnlineAuth.app`, **CLO 7.0.242**, Intel/x86_64 under Rosetta on Apple Silicon.
- Official matching SDK: **v4.0.0 / CLO 7.0.242**, linked from the [CLO API/SDK Guide](https://support.clo3d.com/hc/en-us/articles/360017616633-CLO-API-SDK-Guide).
- SDK download is in `vendor/` (excluded from git). The installed app is **not** the 2026 version; do not try to load a 2026 SDK plugin into it.
- Build with `sh integrations/clo_sdk/build.sh` from the repository root. Output is `integrations/clo_sdk/build/MIKRISTIAN_CLO_Operator.dylib`.

## Activation in CLO 7

The compiled dylib was registered at **Settings > User Settings > CLO API > + Add** from the stable path `~/Documents/CLO_Automation/CLO_Operator/MIKRISTIAN_CLO_Operator.dylib`. It became immediately available under Settings > Plug-in, without a restart.

Once the entry is shown in CLO's **Settings > Plug-in** menu as `MIKRISTIAN CLO Operator (run queued job)`, use:

```bash
node integrations/clo_sdk/cli.mjs inspect --execute
node integrations/clo_sdk/cli.mjs status
```

The plug-in reads exactly one `~/Documents/CLO_Automation/CLO_Operator/pending.job` and writes a JSON response under `responses/`. With `--execute`, the local CLI invokes the CLO plug-in menu through macOS Accessibility. It never performs work on project load; CLO must be open with the desktop UI available.

**Actual initial handshake:** SDK returned `ok: true`, `version: 7.0.242`, `pattern_count: 15`, and active project `REFERENCE_acidwash_pants_before_sim.zprj`. No simulation was run on that unrelated reference.

**Native project-save test:** SDK successfully produced `~/Documents/CLO_Automation/CLO_Operator/REFERENCE_acidwash_SDK_export_test.zprj` (83 MB) and returned `ok: true`. The earlier `REFERENCE_acidwash_pants_before_sim.zprj` was not overwritten. The active CLO document path changed to the newly saved copy; this behavior is recorded as a safety-relevant finding.

Available commands:

- `inspect`: CLO version, project name/path, pattern count + pattern names; no changes.
- `simulate --expected <full current .zprj> --experimental-sim --steps <1..300>`: **experimental only**. SDK call stalled in initial test; do not use for production until resolved.
- `export --expected <full current .zprj> --path <new .zprj>`: saves a NEW file below `~/Documents/CLO_Automation/`, never overwrites. **Important: CLO treats SDK ExportZPrj as Save As and changes the active document path.** Reinspect after each export before queuing another mutation.
- `import_dxf --expected <full current .zprj> --path <existing .dxf>`: append-only DXF import; requires exact current document guard. Back up first and use a duplicate current project.

**Caution:** version 7.0.242 SDK can inspect, import DXF, simulate and save but lacks newer programmatic sewing-graph construction APIs. The four-panel jeans still need native seam construction. A compiled plugin does **not** prove CLO is loading it; only a returned inspect response proves that. CLO native simulator execution also does **not** prove a correct garment fit.

### Simulation stall and safe queue recovery

At approximately 22:04:48 EDT on Oct 12, a `UTILITY_API->Simulate(2)` command was queued for a disposable reference project. No native JSON result arrived after 120 seconds. The original CLO process was no longer running by 22:11, and a new CLO process started at approximately 22:10:50. We do not know whether this was a crash or an external restart. **No successful simulation was recorded.**

The queue deliberately preserves an unacknowledged job after a process restart. **Only after independently confirming the old CLO process is gone and the new process started after the pending job**, archive it with:

```bash
node integrations/clo_sdk/cli.mjs recover-stale --id <pending-job-id> --confirm-restarted
# If CLO has fully exited instead, recovery checks the process table itself:
node integrations/clo_sdk/cli.mjs recover-stale --id <pending-job-id> --confirm-closed
```

This archives the pending job and logs a local failure record. It does not touch any garment. Never use this while CLO is still executing the original request.

### Read-only native project integrity checks

```bash
python3 integrations/clo_sdk/audit_zprj.py ~/Documents/CLO_Automation/CLO_Operator/REFERENCE_acidwash_SDK_export_test.zprj
```

This verifies the `.zprj` archive CRCs and the presence of native garment payload files. Both the SDK export and the saved 501 V8 diagnostic project passed this archive-integrity check. It is **not** a sewn-fit or simulation success test.

## First 501 integration test

1. Make a separate working copy of `501_W32L32_V7_SEWN_OUTSEAMS_MIDINSEAM.zprj` and open that in CLO.
2. Queue `inspect`, invoke the menu item, and validate response version, project path, and 4+ pattern pieces.
3. Use `501_Body4_V9_OUTSEAM_POINT_FIXED.dxf` on a new copy: it restores a skipped back-leg segmentation point, and all four major inseams/outseams now pass length validation. Correct seam orientations / open rises in the CLO UI while preserving older sources.
4. After stitching is confirmed, simulate using CLO's UI while the native API simulation call remains under investigation. Verify the garment visually and log pressure/collision issues.
5. Queue a guarded export to a new `_SDK_TEST.zprj` file, check it exists and reopens.

The bridge intentionally never claims full sewing or perfect fit unless explicitly validated inside CLO.
