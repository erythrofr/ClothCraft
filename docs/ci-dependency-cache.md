# Rust dependency caching in CI

CPU validation and cross-platform builds use `Swatinem/rust-cache`, pinned to
`d1527c8f67ef9af357290475d4af4b0fab8f12e0` (the inspected `v2` revision on
2026-10-26). This is a hosted CI tool, not a dependency shipped with ClothCraft.

The cache restores Cargo downloads and compiled dependencies. Workspace crates
and installed Cargo binaries are excluded from cache publication. Required jobs
still invoke locked Cargo build, test and lint commands. Cache
hits never skip checks or substitute a previously packaged application.

Only successful pushes to `main` may publish caches. PRs, including forks, and
manual runs only restore. The first run is cold; later restoration is verified
in the hosted observation below.

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

## Linux test ownership

The required `cpu` job owns the no-default-feature Linux suite on Ubuntu 24.04.
The Linux entry in `build.yml` uses the same image and skips that duplicate test
step on automatic push/PR runs. It still builds the desktop release binaries,
validates a shipped template with the built binary and stages the artifacts.
macOS and Windows retain their platform CPU suites. A standalone manual dispatch
of `build.yml` also retains the Linux CPU suite because it does not launch the
separate CPU workflow. This policy is independent of cache hits.

All required check names and workflow triggers stay unchanged. The repository's
active `Protect main` ruleset (25693109, checked 26 October) requires both `cpu`
and `build (linux-x86_64)` along with desktop/catalog/other-platform checks.
Neither a successful artifact build alone nor a skipped duplicate test proves
that the canonical CPU suite passed; inspect both checks on the same PR head.

## First hosted observation

Main CPU job [121495808261](https://github.com/erythrofr/ClothCraft/actions/runs/40300172356/job/121495808261)
published a dependency cache after passing. PR #92 CPU job
[121503853020](https://github.com/erythrofr/ClothCraft/actions/runs/40302599264/job/121503853020)
restored an exact matching 268 MB cache, compiled the workspace and passed the
tests, Clippy, template validation and simulation without publishing a PR cache.
Restore start to cleanup was about 6m00s cold versus 2m28s warm, including about
12s restoration. The revisions and runners differ, so this is an observation,
not a controlled speedup benchmark. Fork and lockfile-change cases remain
unverified. These measurements predate the Linux matrix test deduplication.

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
