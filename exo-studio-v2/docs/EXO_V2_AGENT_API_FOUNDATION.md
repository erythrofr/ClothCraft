# EXO V2 ClothCraft Agent API — foundation

## Verified backend surfaces

The existing `integrations/clothcraft/server.mjs` binds to `127.0.0.1` and owns one `createWorkspace(outputs)` instance. `workspace.mjs` opens a persistent native `exo-session` child when needed. The Rust session exposes a numeric `revision` in snapshots, validates it on native state-changing commands, and implements `step` with batches of one to four steps. The JavaScript workspace supports `snapshot`, `pause`, and `step`. `pause` is coordinated in JavaScript, so the facade checks revision before invoking it; the Rust revision guard applies separately to `step`.

## API contract

`integrations/clothcraft/agent-api.mjs` exports `createAgentApi(workspace, { audit })` and a typed, versioned capability manifest (`exo.clothcraft.agent`, `1.1.0`). Endpoints are `GET /agent/v1/capabilities`, `GET /agent/v1/status`, and `POST /agent/v1/actions`. Allowed action names are `workspace.snapshot`, `simulation.pause`, `simulation.step`, `line.inspect`, and `line.setTargetSpecification`. `steps` must be an integer from one through four. Every mutation requires `expectedRevision`, a nonnegative safe integer equal to the latest loaded snapshot revision; stale requests return HTTP 409. Rejected request fields return HTTP 400. Responses are JSON with `Cache-Control: no-store`.

`line.inspect` accepts `{ "action":"line.inspect", "panel":"front", "edge":"hem" }` for a named boundary present both in `template.panels[].polygon.edges` and the matching live mesh panel's `boundaries`. Its result includes ordered mesh indices, actual UV coordinates (`uvCm`), live 3D positions (`live3dCm`), summed polyline lengths `length2dCm` and `length3dCm`, current revision, and any stored target specification. Both source coordinate arrays are expressed by the native workspace in meters and converted to centimeters. The polyline sums measure the sampled mesh boundary, not an independently certified production pattern.

`line.setTargetSpecification` accepts `{ "action":"line.setTargetSpecification", "panel":"front", "edge":"hem", "targetCm":12, "expectedRevision":8 }`. `targetCm` must be a finite numeric centimeter value in `[0.01,1000]`. The facade checks the existing named boundary and current revision, refuses running/busy simulation, then forwards `{ op:'line-spec', panel, edge, target_m:targetCm/100, revision:expectedRevision }` to the existing Rust handler through `workspace.request`. This stores a **drafting annotation only** and increments the native revision; it does not apply elastic tension, solver forces, contour reshaping, or physical deformation. A nonphysical target is distinct from the measured live 2D/3D boundary lengths. The native handler performs its own edge and revision checks.

The facade checks workspace loaded status before querying snapshots so an agent read cannot implicitly open a new garment. It rejects unsupported operations and concurrent agent requests. Read-only `snapshot` obtains the current underlying workspace snapshot and may contain garment geometry; avoid distributing it beyond a trusted local process. `status` presents the workspace's existing loaded/busy state. `step` refuses to run while simulation is marked running or busy. A supplied audit callback receives a timestamp, requested action, HTTP status, success, and resulting revision, but does not receive geometry or garment contents.

## Mount into the existing bridge

Reuse the existing `workspace` instance in `server.mjs`; do not create a second workspace for the API. Import `createAgentApi`, instantiate it beside the existing workspace, and call `await agentApi.handle(req,res)` inside `http.createServer` **after** the existing Origin allowlist rejection and **before** legacy route handling. Preserve the bridge's loopback binding, CORS rejection, and any additional local authentication. For example:

```js
import { createAgentApi } from './agent-api.mjs'
const agentApi = createAgentApi(workspace, { audit: event => console.info('[agent-api]', JSON.stringify(event)) })
// After existing origin rejection inside server callback:
if (await agentApi.handle(req, res)) return
```

This integration point is supplied for the owner of `server.mjs` to apply; `server.mjs` is outside the worker's assigned edit scope. Because same-machine processes can reach loopback HTTP services, this transport is limited to local trusted agents. The server's existing origin validation protects browser callers, not arbitrary local programs.

## Example

First fetch the current revision using `workspace.snapshot` on the open garment. Then send `{"action":"simulation.step","expectedRevision":7,"steps":1}`. The response returns the new revision. Re-read the snapshot before another mutation. No API claim is made for fit accuracy, garment authoring, pattern edits, remote operation, simulated grab, or arbitrary native methods.

## Verification

Run `node integrations/clothcraft/qa-v2-agent-api.mjs` to test action allowlisting, strict arguments, stale revisions, rejected implicit opens, step/pause dispatch, actual boundary coordinate and length calculations, unknown boundaries, busy/running denial, native line-spec request payload, successful annotation, and audit metadata. This test uses an isolated mock workspace; it does not certify native physical results or timing. A live integration smoke test requires mounting the handler into the existing bridge and opening a garment in the native workspace before requesting a snapshot.
