import assert from 'node:assert/strict'
import {
  snapDraftGrid, snapDraftPattern, nearestOnDraftSegment, constrainDraftAxis,
} from '../src/core/draftingSnapping.js'

const close = (a, b, tolerance = 1e-6) => assert.ok(Math.abs(a - b) <= tolerance,
  'Expected ' + a + ' to equal ' + b)
const piece = {
  id: 'front', layout2d: { x: 100, y: 20 }, points: [
    { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 },
  ],
  curves: { 1: { cx: 13, cy: 5 } },
}
assert.deepEqual(snapDraftGrid({ x: 13.23, y: -6.62 }, 1), { x: 13, y: -7 })
assert.deepEqual(snapDraftGrid({ x: 13.23, y: -6.62 }, 0.25), { x: 13.25, y: -6.5 })
assert.deepEqual(snapDraftGrid({ x: 13.1, y: -5.8 }, 2, { x: 0.5, y: 0.5 }), { x: 12.5, y: -5.5 })
assert.throws(() => snapDraftGrid({ x: Infinity, y: 2 }, 1), /grid/)
assert.throws(() => snapDraftGrid({ x: 0, y: 0 }, 0), /grid/)
const seg = nearestOnDraftSegment({ x: 7, y: 4 }, { x: 0, y: 0 }, { x: 10, y: 0 })
close(seg.x, 7); close(seg.y, 0)
assert.deepEqual(nearestOnDraftSegment({ x: 12, y: 4 }, { x: 0, y: 0 }, { x: 10, y: 0 }),
  { x: 10, y: 0, t: 1 })
assert.equal(snapDraftPattern({ x: 92, y: 1 }, [piece]), null)
const vertex = snapDraftPattern({ x: 100.2, y: 19.85 }, [piece], { toleranceCm: 0.5 })
assert.equal(vertex.kind, 'vertex')
assert.equal(vertex.pieceId, 'front')
assert.equal(vertex.pointIndex, 0)
close(vertex.x, 100); close(vertex.y, 20)
const edge = snapDraftPattern({ x: 105, y: 19.5 }, [piece], { toleranceCm: 1 })
assert.equal(edge.kind, 'edge')
close(edge.x, 105); close(edge.y, 20)
const curve = snapDraftPattern({ x: 112.46, y: 15.2 }, [piece], { toleranceCm: 1 })
assert.equal(curve.kind, 'edge')
assert.equal(curve.edgeIndex, 1)
assert.equal(snapDraftPattern({ x: 105, y: 19.5 }, [piece], { excludedPieceId: 'front' }), null)
assert.equal(snapDraftPattern({ x: 100.01, y: 19.99 }, [piece], {
  excludedPoint: { pieceId: 'front', pointIndex: 0 }, allowEdges: false, toleranceCm: 0.5,
}), null)
const guide = constrainDraftAxis({ x: 0, y: 0 }, { x: 10, y: 1 })
close(guide.y, 0); close(guide.x, 10)
const diagonal = constrainDraftAxis({ x: 0, y: 0 }, { x: 5, y: 4 })
close(diagonal.x, 4.5); close(diagonal.y, 4.5)
console.log('2D snap: grid, projections, pattern vertices/curves, exclusions, 45-degree guides: PASS')
