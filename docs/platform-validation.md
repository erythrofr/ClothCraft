# Native platform validation

Task: EXO-QA-003, tracked in [issue #24](https://github.com/erythrofr/ClothCraft/issues/24).

## Observed baseline

At commit `991b4754e393427b7ddb1c26139d4008f3a43bfc`,
[build run 39828874228](https://github.com/erythrofr/ClothCraft/actions/runs/39828874228)
completed successfully on all three hosted runners:

| Artifact | Job | Observed checks |
|---|---|---|
| macos-arm64 | 119999383525 | Release desktop/CLI link, shipped two-panel template validation, artifact staging |
| linux-x86_64 | 119999383867 | Same |
| windows-x86_64 | 119999384280 | Same |

The baseline used `*-latest` runner labels and Rust `stable`. These labels
are not exact operating-system or compiler versions. Do not infer native UI
acceptance or GPU support from those successful jobs.

The separate [CPU reference run](https://github.com/erythrofr/ClothCraft/actions/runs/39828874218)
also succeeded on Linux, including CPU tests and the desktop test target.
Neither build run opened the editor or exercised a graphics adapter.

## Reproducible checks going forward

The build matrix now names macOS 15, Ubuntu 24.04 and Windows Server 2025
hosted runner families. The image revision still changes. Each job records
its commit, runner architecture, image revision, `rustc -Vv` and `cargo -V`
in `BUILD-ENVIRONMENT.txt`, shipped with the binaries and uploaded separately
even after a later failure. Rust remains stable rather than silently claiming
one fixed toolchain. Consult that metadata when reporting a regression.

Each platform runs the CPU suite with graphics features disabled, two build
jobs and two test threads, then links the real desktop binaries and validates
an original shipped template. No GPU tests are enabled. The standalone CPU
test precedes desktop linkage so failures remain distinguishable.

Local equivalent:

```sh
cargo test --locked --no-default-features -j 2 -- --test-threads=2
cargo build --locked --release -j 2 --features desktop --bin cloth-fit --bin marvelous-cloth --bin cloth-template
```

## Named-platform result, 23 October 2026

[Run 39956314870](https://github.com/erythrofr/ClothCraft/actions/runs/39956314870)
completed successfully for PR #41. Its head was
`087e160edee12de2baf5116bc5cf58f8381e00c0`; the checkout recorded in each
`BUILD-ENVIRONMENT.txt` was GitHub's tested merge commit
`6af039bd8254a131d0e544faec830e75ad448df5`, not the head or the eventual
squash merge `0d5384acc55413d44a60bb2901b3d433c4e0d89f`.

| Platform / host target | Recorded image | Successful job |
|---|---|---|
| macOS ARM64 / `aarch64-apple-darwin` | `macos15 20260907.0337.1` | [120422922264](https://github.com/erythrofr/ClothCraft/actions/runs/39956314870/job/120422922264) |
| Linux x64 / `x86_64-unknown-linux-gnu` | `ubuntu24 20261012.334.1` | [120422922626](https://github.com/erythrofr/ClothCraft/actions/runs/39956314870/job/120422922626) |
| Windows x64 / `x86_64-pc-windows-msvc` | `win25-vs2026 20261021.278.1` | [120422922495](https://github.com/erythrofr/ClothCraft/actions/runs/39956314870/job/120422922495) |

All three logs record `rustc 1.99.1 (58cf8f9c3 2026-10-13)` and
`cargo 1.99.1 (5f94df478 2026-08-27)`. Each passed **326 CPU tests**
(sum of the successful test-harness counts), linked the release desktop/CLI
binaries, validated `examples/templates/two-panel.json`, and uploaded its
artifacts. The template reported 2 panels, 60 vertices, 80 triangles and no
warnings on each platform. These observations come from the completed job
logs, not from intended workflow commands or an unrelated earlier revision.

This establishes the named-platform build path at that tested commit. It
does not establish native dialog, clipboard, graphics-driver, interactive
simulation or clean-machine acceptance. No window or GPU workload was run
for this verification. Future images/toolchains must retain their own metadata;
the labels and Rust stable channel remain moving references.

## Native acceptance still required

| Area | Windows | macOS | Linux |
|---|---|---|---|
| Window/rendering | Owner has used the editor; not a clean-machine certification | Native acceptance pending | Native acceptance pending on both X11 and Wayland |
| Dialogs | Verify `rfd` Open/Save As, cancellation and overwrite handling | Verify dialogs, focus and permissions | Verify dialogs in the installed desktop/portal environment |
| Files | Test spaces, Unicode and portable adjacent `.assets` directories | Also test case-sensitive volumes | Test case-sensitive paths and writable recovery directory |
| Clipboard/shortcuts | Verify Copy/Paste with text focus and panel selections | Verify Command versus Control behavior explicitly | Verify clipboard ownership and Copy/Paste in both display sessions |
| GPU | Adapter-specific test required | Adapter-specific test required | Adapter/driver-specific test required |

Desktop compilation enables eframe/wgpu; it does not initialize a device in
these jobs. Record the backend, adapter and driver actually selected at runtime
instead of assuming Metal, Vulkan or DirectX support from the platform name.
GPU simulation is a separate opt-in workload, not part of this CPU validation.

For a native check, extract the artifact into a writable directory containing
spaces, launch from that directory, open a bundled template, edit a panel,
undo, save a project, close and reopen it with its assets. Check dialog cancel,
text-field shortcuts and clipboard independently. Preserve the original file.
Record OS/image, architecture, toolchain, commit, display session, adapter,
steps and failures in issue #24. A window opening is not a solver-quality test.

The current artifacts are development bundles, not signed/notarized macOS
apps or Windows installers. Linux desktop link dependencies remain explicit
in the workflow. Native distribution and clean-machine packaging are separate
work, including EXO-QA-002; this task does not certify those paths.
