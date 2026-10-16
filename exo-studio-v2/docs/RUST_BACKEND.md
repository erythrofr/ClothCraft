# Rust PPF backend

EXO Sample 3D supports an optional external Rust-based PPF Contact Solver
backend, alongside the browser simulator and experimental native C++/XPBD
development modules. The Rust option does not require finishing or replacing
the C++ migration.

The upstream project is [st-tech/ppf-contact-solver](https://github.com/st-tech/ppf-contact-solver).
Its source checkout and local compiled artifacts live under the ignored
`research/oss/` and `research/ppf-local/` paths. These files are **not**
bundled into the EXO Sample 3D source repository or represented as
first-party code. Consult the upstream README, build instructions, license,
and transitive dependency notices before distributing the binary.

Local development with an already installed, separately configured PPF
runtime:

```bash
npm ci
npm run dev
npm run ppf:serve
```

The PPF sidecar normally serves `http://127.0.0.1:5192`. Check it with:

```bash
npm run ppf:health
```

The frontend can also run without the PPF runtime, using the browser preview.
The PPF service requires a working separately installed solver, assets, and
environment configured according to the local service implementation.
Running a local service is not evidence of safe physical fit; do not treat
preview contact diagnostics as swept-triangle collision certification.

The optional `native_cpp/` and `native_backend/` source directories remain
available for preservation, test comparison and future interoperability.
They are not required to complete a Rust-based workflow.

For redistribution requirements see [LICENSING.md](LICENSING.md).
