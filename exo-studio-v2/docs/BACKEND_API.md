# Simulation Backend API

The backend API allows multiple cloth engines to simulate the same garment document.

## Protocol

Defined in `src/core/backends/protocol.js`.

A request contains:

- protocol/version
- project identity/revision
- avatar measurements/reference
- normalized physical fabrics
- pieces with centimeter pattern geometry and sampled boundaries
- sewing constraints and treatment metadata
- fasteners/attachments
- simulation settings
- requested output channels

## JavaScript backend shape

A registered backend implements `create(project)` and either synchronous `step(session, dt)` or asynchronous `stepAsync(session, frames)`. The viewport serializes async batches so external/native backends cannot overlap solver calls.

```js
{
  id,
  create(project),
  step(session, dt),       // in-process backends
  stepAsync(session, 8),   // external/native backends
}
```

Recommended methods:

```js
reset(session, project)
getStats(session)
getPieceState(session, pieceId)
dispose(session)
```

Backends publish a capabilities object so UI and tests can degrade gracefully instead of assuming every solver supports every feature.

## Output convention

World-space positions use meters. Pattern authoring remains centimeters in the canonical document. Piece IDs must remain stable. Results should expose finite positions and, where supported, normals, contact/pressure and strain.

## External backends

Native/CUDA/remote backends should consume a serialized backend payload rather than application-specific React state. They may return streamed frames, resumable state, cache files or a final state, but must retain piece/vertex provenance.

The current `native-xpbd` backend uses a local HTTP sidecar (`native_backend/server.mjs`) and compiled PositionBasedDynamics executable. `/step` accepts a native payload plus a frame count and returns position/previous-position state so subsequent batches resume exactly where the previous batch ended. Collision contact depth is returned with particle state and is fed through the same Garment Studio ease/pressure analysis used by the browser backend.

## Validation

`npm run check:backend` verifies backend registration and the browser implementation. `npm run check:native-xpbd` validates the upstream PositionBasedDynamics link, `npm run check:native-garment` runs a real tee through compiled XPBD, and `npm run check:native-service` verifies the stateful sidecar including resumable stepping and collision telemetry.
