# Install the Windows portable preview

ClothCraft is **free, open-source software**. The standalone editor and the
garment simulation do not require a login, AI subscription or payment. This
is an experimental development build, not a production-ready CLO replacement.

## Windows x64

Download the `clothcraft-windows-x64-portable-preview` ZIP artifact from a
successful [Windows portable preview workflow run](https://github.com/erythrofr/ClothCraft/actions/workflows/release-windows.yml).
For an unmerged pull request, use that PR's check run and inspect its source
revision before trying its artifact. GitHub may require sign-in to retrieve
workflow artifacts. The repository's general cross-platform build bundles
are separate development artifacts.

1. Download the workflow artifact and extract its outer GitHub ZIP to obtain
   `ClothCraft Portable Preview.zip` and the adjacent `.zip.sha256` file.
2. Verify the ZIP SHA256 against the hash in the checksum file (PowerShell:
   `Get-FileHash -Algorithm SHA256 -LiteralPath '.\ClothCraft Package With Spaces.zip'`).
3. Extract the entire ZIP into a writable folder, for example
   `C:\Users\YourName\Documents\ClothCraft Preview`. **Do not run the files
   directly from inside the ZIP.** Keep `assets`, `examples`, `LICENSE`,
   `BUILD-INFO.txt` and `SHA256SUMS.txt` alongside the `.exe` programs.
4. Double-click **Start ClothCraft.cmd** from the extracted folder. The script
   uses the extracted directory as the working directory so relative assets
   resolve correctly. Alternatively run `cloth-fit.exe --steps 0 --view` from
   a terminal opened in that directory.

The archive contains `cloth-fit.exe` (native fitting editor),
`marvelous-cloth.exe` (additional native CLI entrypoint) and
`cloth-template.exe` (headless CPU template commands), bundled MakeHuman
mannequin assets with their independent license notice, original sample
templates, project README, MIT `LICENSE`, build provenance and per-file SHA256
hashes. No proprietary garment libraries are bundled. Preserve a saved
project JSON and its adjacent `.assets` directory together when moving files.

The package is **unsigned and not an installer**: Windows may ask whether to
run an unrecognized program. Inspect the source revision and checksum first.
It does not modify the registry or install background services. Windows 10/11
x64 with a graphics adapter supported by wgpu is the intended target. A
Microsoft Visual C++ runtime may be required on some systems; obtain it from
[Microsoft's official downloads](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist)
if Windows reports a missing runtime DLL. No runtime installer is bundled.
GPU support, driver versions and performance must be checked on the actual
machine; building successfully does not certify a particular adapter.

## Check the package without a GPU

From PowerShell inside the extracted directory:

```powershell
.\cloth-template.exe validate 'examples/templates/two-panel.json'
.\cloth-template.exe example '.\My First Pattern.json'
.\cloth-template.exe validate '.\My First Pattern.json'
```

The `example` command refuses to overwrite an existing file. `SHA256SUMS.txt`
contains SHA256 hashes of each packaged file (relative to the extracted root).
`BUILD-INFO.txt` records the source revision, compiler version, package time
and build architecture. The separate `.zip.sha256` covers the archive itself.

## Native editor acceptance checklist

The automated Windows workflow compiles binaries, runs CPU tests, verifies the
ZIP checksums, extracts into a **directory containing spaces**, validates a
bundled template, and writes/reopens a separate CPU example. It then runs the
opt-in native launch/capture smoke from that extracted package:

- First it runs the packaged `cloth-fit` headlessly to write a fitting project
  and its assets. This is a CLI document write; no editor is open yet.
- Then `--ui-smoke --project <that file>` opens the CLI-written project in the
  actual editor, captures `ui.png`, and closes. The CLI also writes the launch
  output project before the editor starts, so the check covers project
  load/write plus native window launch/capture, not native Save or Export.

A hosted runner is a fresh Windows environment, but it may expose a software
adapter such as WARP. The smoke therefore does not certify a physical GPU,
driver version, file-dialog interaction, clipboard/focus behavior or a normal
desktop session. If no usable wgpu adapter or window is available, the smoke
step fails; the CPU package checks remain valid evidence only.

The longer `--ui-authoring-smoke` pointer suite is deliberately not part of
the hosted check. Its fixed 40-55 second frame budget cannot complete at a
supported editor layout on a software adapter; the 1100x700 minimum also makes
its rectangle drag self-intersect. Run that suite manually on a
hardware-accelerated Windows desktop before claiming full pointer/authoring
acceptance.

On an actual Windows desktop, perform the following before calling this a
clean-machine GUI release:

1. Extract into a new writable directory whose path contains spaces. Launch
   `Start ClothCraft.cmd` and record Windows version, CPU/GPU, driver and the
   Git commit in `BUILD-INFO.txt`. Compare the adapter/backend with the one in
   the hosted workflow log; a software adapter is not hardware acceptance.
2. Open a sample garment, select and edit a panel, sew if applicable, then
   undo and redo. Confirm cancellation of Open and Save As dialogs does not
   modify the active document.
3. Save to a new path containing spaces and Unicode characters, close, reopen
   and check the geometry, seam relationships and any adjacent `.assets` files.
4. Verify keyboard focus and clipboard actions in text fields and the 2D/3D
   editor independently. Verify normal exit and a second launch.
5. Record selected wgpu backend/adapter, warnings, failures and reproducing
   actions in [EXO-QA-002 issue #23](https://github.com/erythrofr/ClothCraft/issues/23).

Do not infer native edit/save success from the headless example test. The
floor is currently a visual reference rather than a physical collider; dense
meshes, residual oscillation and initial intersections can still fail.

## Reproduce the portable build from source

Requires Windows x64, Git, Rust stable with the MSVC target and a working
Microsoft C++ build toolchain. From the repository root:

```powershell
cargo test --locked --no-default-features -j 2 -- --test-threads=2
cargo build --locked --release -j 2 --features desktop --bin cloth-fit --bin marvelous-cloth --bin cloth-template
.\scripts\package-windows.ps1 -Destination "$env:TEMP\ClothCraft Package With Spaces" -BinariesDirectory '.\target\release' -Verify -UiSmoke
```

The packaging script never overwrites an existing staging folder or archive.
With `-Verify`, it also refuses an existing `.verify` directory, verifies every
extracted payload hash, and runs the CPU write/reopen check there. `-UiSmoke`
requires `-Verify`. It uses the packaged CLI to write and load a fitting
project, then launches the actual editor, opens that project, captures its
window, and closes. It does not exercise native Save, Export or editing, and is
not part of the ordinary CPU test suite. Verification files stay beside the
archive for inspection. Destinations inside recursively copied
asset/template folders are rejected. Package from freshly built binaries:
the recorded source revision identifies the intended checkout, not a signed
attestation of an arbitrary externally supplied executable.
Use a new destination for each release. See
[native platform validation](platform-validation.md) for the separate macOS,
Linux and Windows CPU compile matrix and its remaining UI acceptance gaps.


### Portable CI dependency reuse

Automatic PR/main packaging shares the mandatory `build (windows-x86_64)` CPU
suite on `windows-2025`; the `portable-windows` job still builds release binaries
and verifies the extracted package and native launch/capture. Both checks must
pass on the same revision. Standalone manual packaging runs its own CPU suite.
A successful packaging job alone is not evidence that the separate CPU job ran.

The portable workflow caches dependencies with a pinned action and a distinct
release/OS/architecture/lockfile key. Only successful trusted main pushes save
that cache. Workspace crates and executables are excluded; every run still
builds the package and performs its verification. No cache hit skips acceptance,
and no measured speedup is claimed until comparable hosted runs are available.
