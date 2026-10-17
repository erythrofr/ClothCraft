# EXO native 2D board actions (16 October 2026)

The `ClothCraftBoardV2` window accepts `window.dispatchEvent(new CustomEvent('exo-clothcraft-select-2d-tool', {detail:{tool}}))`.

| `detail.tool` | Upstream mode | Actual action |
| --- | --- | --- |
| `select` | `edit` | Select panels and move or rotate their metric layout via `BoardTransform`. |
| `point` | `edit` | Drag existing polygon vertices, submitting native `Anchor` edits. Does not create new vertices. |
| `curve` | `edit` | Drag existing curve controls, submitting native `Shape` edits. Does not create new curve controls. |
| `sew` | `sew` | Select two boundary edges through the workspace sewing pair picker; the workspace's **Create seam** button submits native `Sew`. |
| `internal` or `line` | `line` | Click at least two positions and press **Create internal line**; the workspace submits native `InternalLine` using selected panel local coordinates. |
| `measure` | `edit` | Click two positions to display their exact metric distance on the board; click **Clear tape** to remove the temporary tape. Read-only overlay, intentionally not a saved construction measurement. |

`pen` is an upstream polygon drafting mode supported by the board but not advertised as a new toolbar equivalent. Existing board controls retain it.

Drawing events are captured by the SVG before filled fabric and boundary elements consume pointer input. This is necessary for internal lines that start **inside** a fabric piece. Selection and existing point/curve drag handlers remain in their prior code path when drawing is inactive. The temporary tape is in real board metres and includes the same front/grid viewport alignment as the pattern pieces.

Unsupported notch insertion, new vertex insertion, and automatic sew completion are **not** claimed as native equivalents. Native seam authoring still requires the workspace's Create seam action and seam configuration.
