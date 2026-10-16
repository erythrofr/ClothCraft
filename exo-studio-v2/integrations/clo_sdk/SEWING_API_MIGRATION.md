# CLO automated sewing: version-gated implementation plan

## What is proven locally (October 12, 2026)

- CLO `7.0.242` with matching SDK `v4.0.0` can load the MIKRISTIAN native menu plugin, inspect pattern count/names and export valid `.zprj` copies.
- `Simulate(2)` did **not** complete its native response in the first disposable reference test. CLO subsequently exited/restarted. The native simulation command is now experimental-only.
- SDK v4.0.0's Pattern API lacks the `AddSeamlinePairGroup` operation, so a native end-to-end sewing operation **cannot be claimed** with this plugin.
- Garment Studio now generates the distinct `501_Body4_V10_SEGMENTS_ALIGNED.dxf` scaffold with matched paired edges. It remains a **flat cutting pattern**, not sewn CLO state.

## Official API upgrade path

The official CLO API changelog lists `AddSeamlinePairGroup` and `GetSeamlinePairGroupCount` among features introduced in SDK v4.3.2 (January 2024):

- https://developer.clo3d.com/changelog.html
- https://developer.clo3d.com/list.html
- https://developer.clo3d.com/download.html

The latest listed 2026.1 SDK is v11.0.0 for CLO 2026.1.224. CLO's app download page separately lists CLO 2026.1.310. SDK binary/plugin builds must match the **specific installed CLO release**; do not install a mismatched SDK binary or silently replace the user's authenticated CLO 7 application. Before upgrading, verify installer access, license/account compatibility and that `.zprj` backward compatibility is acceptable.

## Auto-sewing adapter milestones

1. **Name mapping**: after importing the V10 DXF, inspect pattern counts/names and associate each of the four known IDs with an exact CLO pattern index. If names are anonymized or order changes, abort instead of guessing.
2. **Line-index mapping**: obtain CLO's actual per-pattern line geometry or exported pattern JSON, and match the eight outseam and six inseam pairs to the V10 contour vertices. CLO line indices are not assumed equal to DXF vertex indices without read-back.
3. **Direction validation**: explicitly verify A/B line directions against the 3D arrangement and require a non-twisted sewing graph. Documentation overload signatures differ; compile against the matching installed SDK header, not the website alone.
4. **Sewing transaction**: duplicate project, write a before-audit, call `AddSeamlinePairGroup` once per verified pair, then query seam group counts/relationships and export a new `.zprj`. No same-path overwrite.
5. **Center rise**: connect left/right front rise and left/right back rise, preserving crotch geometry and handling separate upper segments. Include the yoke/waistband/pocket layers only after the core four-panel shell passes collision/fit checks.
6. **Simulation**: test native simulation **on a disposable sewn shell** with fixed tiny frame batches and the UI visible, then inspect geometry/collision and save a second version. If unstable, keep native SDK simulation disabled and use a supported CLO UI simulation path.
7. **Acceptance**: no missing sewn edges, no open crotch, no significant penetrations, consistent avatar clearance, stable drape, source-preserving saved `.zprj`, 3 orthographic fit screenshots and repeatable measurements.

## V10 pair mapping proposal (not yet CLO-validated)

- Left/right outseams: respective front edges `0,1,2,3` matched to back edges `0,1,2,3`.
- Left/right inseams: respective front edges `5,6,7` matched to back edges `5,6,7`.
- Front center rise: left front edges `8,9` to right front `8,9`.
- Back center rise: left back edges `8,9,10` to right back `8,9,10`.
- All directions **unknown until live CLO inspection**. Do not execute this map as blindly assumed index pairs.

For detailed per-edge measurements and the verified DXF file, see:
`~/Documents/CLO_Automation/501_Original_Jeans_W32L32/501_Body4_V10_SEGMENTS_ALIGNED.json`.
