# EXO 400 Fabric Loop — Native CLO 7 Reference Audit

## What was actually reviewed, October 16, 2026

The installed application is CLO Standalone OnlineAuth Academic, **7.0.242 (r39887)**, running as a genuine macOS app. The separately authorized **EXO CLO Inspector.app** read the on-screen native CLO window using ScreenCaptureKit and Accessibility without loading CLO in a browser. Local screenshot evidence: screenshots/QA-CLO7-FABRIC-PROPERTY-BROWSER-20261016.png, screenshots/QA-CLO7-FABRIC-SELECTED.png and screenshots/QA-CLO7-FABRIC-PHYSICAL-SCROLL-2.png.

**Directly observed on screen** after selecting FABRIC 1 in the CLO Object Browser:

- Material property editor: Texture Mapping / Repeat; Type / Fabric_Matte; Basic Parameters with Texture, Normal Map, Displacement Map, Color, Opacity, Opacity Map; Reflection with intensity and metalness controls.
- Physical Property group: Preset / Custom, an expandable Detail row, and Thickness (mm). The displayed default fabric thickness in this particular scene was 0.50 mm; it is NOT a published preset or independently measured textile.
- The in-app Physical Property **Detail** group was not expanded in the captured state. Version-specific individual directional row order/values were therefore not directly verified from the native GUI. Other CLO field concepts are grounded in official documentation, not falsely presented as directly observed UI.

MacOS System Events and direct terminal screen capture lacked accessibility/recording access; the stable signed native inspector succeeded. The signed helper was not re-signed or replaced in this audit. This avoids disrupting previously granted macOS permissions.

## Local CLO fabric file library — 77 file occurrences

Read-only inventory of the installed app resource folder and the user's Documents/clo/Assets/Materials/Fabric:

| Source | Local .zfab files | Readable material weight and thickness |
| --- | ---: | ---: |
| User CLO Fabric folder | **69** | **44** |
| CLO app bundled utility fabrics | **8** | **8** |
| **Total observed** | **77** | **52** |

The metadata-only extractor read file signatures and readable top-level metadata, not proprietary binary fabric stiffness/curve data or embedded photographs. It recovered the local file's Classification, fiber Content, color code, nominal Weight (g/m²), Thickness (mm) and the presence of a texture reference, where readable. **23 user-local files timed out on read** and were explicitly marked unavailable; a filename is not proof their detailed contents were inspected. Values are reference metadata, not independently verified laboratory measurements. Do not bulk import these CLO proprietary presets into EXO.

The observed 44 usable user-local fabric records ranged from **27.7778–453.03 g/m²** and **0.1–1.75 mm** in their readable file metadata. Those ranges characterize only the locally accessible records, not CLO's total fabric library or EXO's correct design envelopes. Some user filenames identify cotton, denim, knit, nylon, silk, fur and leather; the 8 app-bundled files are chiefly bonding/construction utilities.

Outputs: docs/reports/EXO_CLO7_INSTALLED_FABRIC_METADATA.json and docs/CLO7_INSTALLED_FABRIC_LIBRARY_INVENTORY_20261016.md. Reproducible scripts: scripts/audit-clo7-fabric-visible-metadata.mjs and scripts/audit-clo7-installed-fabric-metadata.mjs.

The available **77 file occurrences** are not the complete CLO online or downloadable fabric catalog. The current scene showed one default FABRIC 1 item, not the entire Library opened and inspected one-by-one. Access to CLO cloud libraries and native values for each of the remaining proprietary presets is not established.

## Improvement loop applied to all 400 EXO materials

- Preserved exactly **400 main-editor material identifiers** (80 original construction families plus 320 estimated variants) and **405 native Rust material choices** including historical specimens.
- Generated and validated a **400 × 20 = 8,000 concept-property audit**, categorizing 800 authoring fields as supported, 5,200 as approximated, and 2,000 as missing. These are schema coverage classifications, NEVER 800/8,000 physical calibration measurements or a parity percentage. Machine-readable matrix: docs/reports/EXO_400_CLO_PROPERTY_PARITY.json.
- Added a **CLO-style detailed fabric inspector** in EXO that can be expanded for any of the 400 presets. It displays EXO solver inputs, optical controls and reference provenance separately, explicitly marking independent warp/weft/bias bending, shear resistance, buckling, two-sided surface materials and nonlinear measured curves as missing where appropriate. The underlying physical values are not relabeled as CLO intensities. Main UI: src/App.jsx; readout logic: src/core/clo7FabricReadout.js.
- The readout test validates **400 × 28 = 11,200 field entries**, including null/missing rules and real unit conversions for density/weight, thickness and EXO extension percentages. Test: scripts/check-400-clo7-readout.mjs.
- No CLO proprietary image files, full proprietary fabric presets, or proprietary mechanical curves were copied into EXO. Prior EXO licensed appearance scans and user material edits remain unchanged by this comparison.

## Sources and verified versus not verified

CLO published documentation, distinct from CLO 7.0.242 live visual evidence:

- https://support.clo3d.com/hc/en-us/articles/115000483047-Physical-Property-Detail-Setting
- https://support.clo3d.com/hc/en-us/articles/115000483087-Adjust-Stretch-Weft-Warp-Shear
- https://support.clo3d.com/hc/en-us/articles/115000483187-Adjust-Bending-Weft-Warp
- https://support.clo3d.com/hc/en-us/articles/115002685527-Adjust-Buckling-Stiffness
- https://support.clo3d.com/hc/en-us/articles/115002797948-Adjust-Friction-Coefficient
- https://support.clo3d.com/hc/en-us/articles/360047317454-Set-Fabric-Materials
- https://support.clo3d.com/hc/en-us/articles/360041074334-Fabric-Kit-Manual

These sources confirm the concepts of separate directional physical properties, bending, shear, friction, material faces and measurement workflows; their latest page versions are not proof of exact CLO 7.0.242 control order. The current version-exact live FABRIC 1 GUI capture only confirms the headings described above.

## Remaining work for real CLO parity

Open individual CLO Fabric Library assets in the live application and inspect their selected Property Editor entries, ideally with the Detail group expanded and a read-only capture of all scroll positions. Confirm UI version, category, source licensing, physical preset, range and units per entry. Compare representative **verified user-owned** material specimens against EXO's simulation by controlled drape tests and physics lab measurements. A true 400-item measured calibration run cannot be created by copying CLO intensity sliders or stock scans; it requires specimen tests and solver fitting.

To repeat the current safe audits: run npm run check:clo7-fabrics, npm run check:materials, npm run build. For the local file inventory only, run npm run audit:clo7-local-fabrics (some iCloud/local files may time out).
