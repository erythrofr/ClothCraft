# EXO session bridge contribution

The optional `exo-session` executable is a downstream adapter between a JSON-lines client and ClothCraft's existing authoring, fitting, VBD and OGC APIs. It is the first small contribution candidate from [EXO Sample 3D](https://github.com/mikristian/exo-sample-3d/tree/feature/studio-v2-clo-visuals), which keeps its React/CSS interfaces, fabric scans, community design and locally licensed pattern files in a different repository.

## Compile and use

Run a CPU-only build:

```sh
cargo build --locked --no-default-features -j 2 --bin exo-session
cargo test --locked --no-default-features -j 2 --test exo_session_protocol
```

Start `target/debug/exo-session assets/makehuman/mannequin.obj [optional-save-path]`. The executable consumes one JSON object per newline on stdin and emits one JSON response per newline on stdout. It retains its document and undo history between requests. Example client exchange:

```json
{"op":"open","preset":"tshirt"}
{"op":"snapshot"}
```

`open` creates a T-shirt or dress project, or accepts a serialized `FittingProject` under `project`. The adapter always assigns its launcher-provided avatar path. `snapshot` returns `ok`, revision, editable template, material coordinates and current positions. All mutating requests include the latest revision; stale requests return `{ "ok": false, "error": "...", "data": ... }` instead of silently replacing the document. `edit` maps a subset of the existing `authoring::Command` enum; `undo`, `redo`, `set-property`, `line-spec`, `grab`, `pull-panel`, `pose-panel`, `step`, `reset`, and `save` are adapter commands. The property update currently persists a native **panel/fabric name only**; workspace-side optional metadata such as supplier and item number remains outside the upstream schema.

This adapter adds no fabric textures, proprietary CLO resources, commercial garments or downloaded marketplace files. It does not provide CLO3D file compatibility, demonstrated measured fabric physics, a native macOS bundle, or automated access to a user's desktop. The CPU `step` path uses the existing VBD/OGC solver with bounded step counts; passing `--gpu` is optional and requires the desktop feature and explicitly available GPU device. The adapter is proposed as an integration surface for upstream review, and its API is not a committed public library ABI.

## Review considerations

- Preserve `FittingProject` serialization, material rest coordinates, ClothCraft history and valid authoring IDs.
- Verify that rejected requests do not partially mutate a project or leave stale solver caches. Add negative cases when extending the parser.
- Keep this adapter optional and distinct from ClothCraft's regular UI and core solver contracts.
- Downstream EXO keeps product-specific UI, 400 illustrative fabric variants and provenance-gated assets in its own repository.
