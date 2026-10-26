# Rust dependency caching in CI

CPU validation and cross-platform builds use `Swatinem/rust-cache`, pinned to
`d1527c8f67ef9af357290475d4af4b0fab8f12e0` (the inspected `v2` revision on
2026-10-26). This is a hosted CI tool, not a dependency shipped with ClothCraft.

The cache restores Cargo downloads and compiled dependencies. Workspace crates
and installed Cargo binaries are excluded from cache publication. Every run
still invokes its existing locked Cargo build, test and lint commands. Cache
hits never skip checks or substitute a previously packaged application.

Only successful pushes to `main` may publish caches. PRs, including forks, and
manual runs only restore. The first run is cold; hosted speedup is unmeasured
until a successful main run populates a cache and a later revision restores it.

Keys separate CPU/no-default-feature validation, desktop validation and each
cross-platform matrix target. They include the exact Cargo.lock hash. The
action additionally keys by job, OS/architecture, compiler version, Cargo/Rust
environment and manifests. ImageOS/ImageVersion are included to avoid reusing
native build outputs across runner-image changes. A toolchain, image or lockfile
change can intentionally cause a cold build. Bump `clothcraft-deps-v1` to discard
the cache namespace without changing job names or required checks.

`release-windows.yml` remains uncached pending coordination with the owner of
the portable-package task. It still duplicates the Windows release compilation
from `build.yml`; caching does not solve that separate workflow dependency issue.
The serialized coordination writer is unchanged.

## Hosted acceptance

After merge, record the cache key and publication result from a successful main
run. On a later PR, confirm restoration, fresh workspace compilation, all tests
and artifact verification, and the absence of cache publication. Compare complete
job times with the prior cold run on the same runner class; separate restore/upload
time from compilation. Test a lockfile change and a fork contribution before
claiming broad coverage. A local policy test is not hosted cache-hit evidence.

Source review: [action inputs](https://github.com/Swatinem/rust-cache/blob/d1527c8f67ef9af357290475d4af4b0fab8f12e0/action.yml),
[key construction](https://github.com/Swatinem/rust-cache/blob/d1527c8f67ef9af357290475d4af4b0fab8f12e0/src/config.ts)
and [save policy](https://github.com/Swatinem/rust-cache/blob/d1527c8f67ef9af357290475d4af4b0fab8f12e0/src/save.ts).
