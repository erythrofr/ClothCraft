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

1. Download the ZIP and adjacent `.zip.sha256` checksum file.
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
bundled template, and writes/reopens a separate CPU example. The hosted CI
runner does **not** open an interactive desktop or test a graphics adapter.

On an actual Windows desktop, perform the following before calling this a
clean-machine GUI release:

1. Extract into a new writable directory whose path contains spaces. Launch
   `Start ClothCraft.cmd` and record Windows version, CPU/GPU, driver and the
   Git commit in `BUILD-INFO.txt`.
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
.\scripts\package-windows.ps1 -Destination "$env:TEMP\ClothCraft Package With Spaces" -BinariesDirectory '.\target\release'
```

The packaging script never overwrites an existing staging folder or archive.
Use a new destination for each release. See
[native platform validation](platform-validation.md) for the separate macOS,
Linux and Windows CPU compile matrix and its remaining UI acceptance gaps.
