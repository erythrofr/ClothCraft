# CLO 7 installed fabric metadata inventory — 2026-10-16

## Scope and reproducibility

Read-only inventory of CLO_Standalone_OnlineAuth.app's installed `Contents/Resources/Preset` folder and two user-accessible CLO locations on this Mac. Run from the EXO repository with `node scripts/audit-clo7-installed-fabric-metadata.mjs`; JSON prints to stdout. Only directory entries, filename extensions, and names are inspected. No `.zfab` contents, proprietary measured curves, images or presets are exported to EXO.

## Observed installed files

| Location | `.zfab` files | Meaning |
| --- | ---: | --- |
| `/Applications/CLO_Standalone_OnlineAuth.app/Contents/Resources/Preset` | **8** | 6 `Bond` presets, 1 `Bond_Defual/Bond.zfab`, 1 `Fold3D/folding fabric.zfab`; chiefly utility fabrics |
| `~/Documents/clo/Assets/Materials/Fabric` | **69** | Local CLO fabric assets, including 2 simulation defaults |
| `~/Library/Application Support/CLO` | **0** in the inspected user-support tree | User app settings/cache may include non-fabric simulation settings |
| **Observed total `.zfab` file occurrences** | **77** | Installed and local file occurrences, not a verified CLO catalog total |

The bundle `Preset` tree contained **973 files overall** when examined, including `.jpg`, `.txt`, `.png`, `.bd`, `.top`, `.pfm`, `.cmat`, `.smp` and many other extensions. Its **16** `.cmat` files (plus one mixed-case `.cMat`), for example, reside in avatar texture directories and should not be counted as fabric presets. Four `.smp` presets in `Simulation_Property` are named `Fast`, `Normal`, `Complete` and `Nonlinear`; these are simulation configurations, not 4 additional textile fabrics. The user fabric folder also contains **15 `.jpg`** files in addition to its 69 `.zfab` files.

## Fabric classes evident from local filenames

| Filename family | Count |
| --- | ---: |
| Cotton | 17 |
| Denim | 3 |
| Fur | 6 |
| Interlining | 2 |
| Knit | 6 |
| Leather | 1 |
| Linen | 1 |
| Muslin | 4 |
| Nylon | 3 |
| Polyester | 1 |
| Rib | 3 |
| Sherpa fleece | 5 |
| Silk | 9 |
| Trim | 3 |
| Wool | 3 |
| Simulation defaults | 2 |
| **Total** | **69** |

These names support a breadth comparison against EXO's 400 fabric presets; they do not establish accurate physical parameters, verified fiber composition, or ownership/license for reuse. Particularly relevant examples include `Denim_Raw`, `Denim_Stretch`, `Knit_Fleece_Terry`, `Cotton_Terry_Cloth`, `Cotton_Heavy_Canvas`, and `Rib_1X1_319gsm`.

## Physics vocabulary and limitations

CLO's fabric property terminology includes **stretch** in warp/weft directions, **shear**, **bending**, **buckling**, **density/weight**, **thickness**, and **friction**. CLO documentation describes fabric physical properties, preset application, and the fabric emulator: [CLO support knowledge base](https://support.clo3d.com/hc/en-us/search?utf8=%E2%9C%93&query=fabric+physical+properties). This is public terminology useful when naming EXO controls, not measured values obtained from these files. Some property names, availability, and UI arrangement vary by CLO version and simulation mode; live CLO 7 UI inspection remains a separate evidence source.

**Coverage caveat:** The 77 count is **local `.zfab` file occurrences in the three surveyed trees**, not 77 distinct physically calibrated commercial fabrics. The 8 in the application bundle are mostly construction utilities. Additional downloadable/cloud fabrics, other user-selected asset roots, and virtual libraries may exist outside these trees; this audit cannot support a claim about the total CLO online/cloud fabric catalog or prove CLO has only 77 fabrics. Do not represent nominal EXO materials as calibrated to these presets without permission, independent physical tests and validation.
