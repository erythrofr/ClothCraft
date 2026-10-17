# EXO V2 hardware construction boundary

`src/core/clo7NativeHardwareActions.js` exports `applyDraftHardwareAction(project, command)` and `constructDraftHardware(project, command)` for **persisted EXO draft objects**. The module deliberately makes no claim that these are Rust-native physical buttons, holes cut into a cloth mesh, or zipper contact mechanics. The Rust ClothCraft session commands require their own implementation and acknowledgement before a toolbar item may say “Native”.

## Supported draft actions

| `kind` | Persistent collection | Existing consumer | Physical limitation |
| --- | --- | --- | --- |
| `button` | `piece.buttons` | 2D/3D trim renderer, factory BOM | Position annotation, no rigid contact |
| `buttonhole` | `piece.buttonholes` | DXF export and BOM | DXF slit guide, no cutout topology |
| `topstitch` | `piece.topstitches` | sampled edge path and EXO physics reinforcement | EXO draft reinforcement, no Rust seam construction |
| `zipper` | `piece.zippers` | paired rendered tape paths and EXO closure if seam is separately paired | Adding zipper does not automatically sew edges or construct teeth |
| `binding` | `piece.bindings` | BOM and EXO draft binding edge constraint | Edge constraint, no separate mesh tape |

All five require an unlocked pattern with three or more points; edge actions additionally require a real nondegenerate edge. The command validates dimensional values before committing to its collection, and returns `{ok:true,engine:'exo-draft',kind,pieceId,id,collection,item}`. JSON project saves and `trimHardware()` export already preserve these collections. Unsupported native physics stays explicitly unavailable.

## App integration for prime

```js
import {applyDraftHardwareAction} from './core/clo7NativeHardwareActions.js'
// Within App.jsx, where mutateProject is the established undoable transaction:
const createDraftHardware=(kind,pieceId,edgeIndex,options={})=>{
  let applied
  mutateProject(next=>{
    applied=applyDraftHardwareAction(next,{kind,pieceId,edgeIndex,...options})
  })
  if(applied)setCommandResult(`${kind} saved to EXO draft · Undo available`)
  return applied
}
```

The existing App button and zipper handlers also apply selected hardware presets and synchronize **explicitly paired** zipper seams. Preserve those flows when wiring the generic function; the generic zipper action intentionally does **not** infer a sewing pairing or copy unvalidated preset fields. `constructDraftHardware(project, command)` clones the project and returns a new project for immutable consumers; do not call it inside `mutateProject` and discard the returned project. If running Rust hybrid mode, label these commands “EXO draft” and do not dispatch them as a native `rustCommand`.

Test: `node integrations/clothcraft/check-v2-hardware-native-actions.mjs`. The script verifies all five collections, path sampling, factory BOM, JSON save, rejected operations, and immutable undo snapshots.
