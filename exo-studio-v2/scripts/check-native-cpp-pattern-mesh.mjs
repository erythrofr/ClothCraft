import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import * as THREE from 'three'
import { samplePieceBoundary } from '../src/core/project.js'

const root = resolve(import.meta.dirname, '..')
const folder = mkdtempSync(join(tmpdir(), 'garment-pattern-mesh-'))
const exe = join(folder, 'mesh')
const runner = join(folder, 'runner.cpp')
const piece = {
  id: 'front',
  points: [{ x: 0, y: 0 }, { x: 12, y: 0 }, { x: 12, y: 10 }, { x: 6, y: 5 }, { x: 0, y: 10 }],
  curves: { '0': { cx: 6, cy: -3 } },
  grainline: { dx: 0, dy: 1 },
}
const seam = { id: 'shoulder', a: { pieceId: 'front', edgeIndex: 1 }, b: { pieceId: 'back', edgeIndex: 0 } }
try {
  writeFileSync(runner, String.raw`
#include "pattern_mesh.hpp"
#include <iostream>
int main() {
  garment::Json j;std::cin>>j;
  auto m=garment::buildPatternMesh(j.at("piece"),j.at("seams"),8,1);
  garment::Json out={{"points",garment::Json::array()},{"triangles",m.triangles},{"edges",garment::Json::array()}};
  for(auto v:m.vertices)out["points"].push_back({{"x",v.positionCm.x},{"y",v.positionCm.y},{"u",v.uv.x},{"v",v.uv.y}});
  for(auto e:m.edges)out["edges"].push_back({{"index",e.sourceEdge},{"seamId",e.seamId},{"boundaryIndices",e.boundaryIndices}});
  std::cout<<out.dump();
}`)
  execFileSync('c++', ['-std=c++17', '-O2', '-I', join(root, 'native_cpp/core'), '-I', join(root, 'native_cpp/vendor'), join(root, 'native_cpp/core/pattern_mesh.cpp'), runner, '-o', exe], { stdio: 'pipe' })
  const native = JSON.parse(execFileSync(exe, { input: JSON.stringify({ piece, seams: [seam] }), encoding: 'utf8' }))
  const sampled = samplePieceBoundary(piece, 8)
  const referenceTriangles = THREE.ShapeUtils.triangulateShape(sampled.points.map(({ x, y }) => new THREE.Vector2(x, y)), [])
  const referenceArea = referenceTriangles.reduce((sum, t) => {
    const [a, b, c] = t.map(index => sampled.points[index])
    return sum + Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) / 2
  }, 0)
  const actualArea = native.triangles.reduce((sum, t) => {
    const [a, b, c] = t.map(index => native.points[index])
    return sum + Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) / 2
  }, 0)
  assert.equal(native.triangles.length, referenceTriangles.length * 4)
  assert.ok(Math.abs(actualArea - referenceArea) < 1e-7, `native area ${actualArea} != JS ${referenceArea}`)
  for (let i = 0; i < sampled.points.length; i++) {
    assert.ok(Math.abs(native.points[i].x - sampled.points[i].x) < 1e-9)
    assert.ok(Math.abs(native.points[i].y - sampled.points[i].y) < 1e-9)
  }
  assert.equal(native.edges[1].seamId, 'shoulder')
  assert.equal(native.edges[0].boundaryIndices.length, 17)
  assert.ok(native.points.every(v => [v.x, v.y, v.u, v.v].every(Number.isFinite)))
  console.log(`native/JS pattern mesh parity passed (${referenceTriangles.length} base triangles, ${native.triangles.length} refined triangles)`)
} finally {
  rmSync(folder, { recursive: true, force: true })
}
