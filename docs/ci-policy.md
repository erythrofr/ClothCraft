# Validation scope

Each pull-request revision retains all seven required checks: catalog, CPU,
desktop, three platform builds and Windows portable preview. Jobs always start;
there are no path filters or skipped required jobs.

Only changes confined to `coordination/tasks.json` and `coordination/TASKS.md`
qualify as metadata. These describe task scope and its generated view, not
software shipped to users. Catalog generation, manifest validation, coordinator
tests, CI-policy tests and classifier tests still run. A metadata decision
explicitly skips compilation, native smoke and packaging; it produces no
release binaries and does not claim those checks were executed.

Everything else receives full validation, including README (packaged in
archives), source, shaders, assets, templates, workflows, scripts, dependencies
and unknown paths. Main pushes and manual dispatch always run full validation.
The coordinator remains a separate trusted, serialized writer.

## Exact revisions and fallback

`scripts/ci-change-scope.mjs` reads the PR event's immutable base and head SHAs,
fetches and verifies both commit objects, then reads a NUL-delimited name/status
diff. It examines both paths of a rename/copy and includes deletions. This is a
direct base/head comparison, deliberately conservative when the base has moved:
unrelated base changes can cause extra full checks, never suppress them.

Missing revisions, fetch failures, timeouts, output overflow, invalid UTF-8,
unrecognized records, incomplete or empty diffs all select full validation.
Git arguments are passed without shell interpolation. A classifier process
failure fails the job rather than yielding a successful metadata check. The
workflow gates only the exact `metadata` output; absent/unknown output is not
permission to skip. Artifact uploads, including failure diagnostics, use the
same gate to avoid publishing stale files for metadata runs.

## Evidence

Offline classifier fixtures cover allowed paths, mixed changes, renames,
deletions, malformed input and acquisition errors. Policy fixtures check that
all expensive steps are gated while check jobs and catalog checks remain
unconditional. GitHub validates workflow expressions and hosted execution;
offline tests do not establish actual time savings. Hosted metadata-only and
full-validation evidence remains pending for this implementation.

Run locally without GPU:

```sh
node --test --test-concurrency=2 scripts/ci-change-scope.test.mjs scripts/ci-policy.test.mjs scripts/rewrite-tasks.test.mjs scripts/coordination/engine.test.mjs
```

