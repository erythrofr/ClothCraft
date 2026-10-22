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

This change does not establish that the new matrix has passed until its own
Actions run completes. Historical green results above apply only to the
recorded baseline revision.

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
