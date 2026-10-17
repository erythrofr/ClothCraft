import Foundation
import SceneKit
import simd

/// Triangle surface builder shared by static and pre-solved native preview.
/// Recomputing area-weighted vertex normals avoids an unlit / faceted white
/// garment in the native SceneKit renderer. Coordinates are meters.
func makeNativeGarmentGeometry(_ vertices: [SCNVector3], faces: [[Int]]) -> SCNGeometry {
    var vertexNormals = Array(repeating: SIMD3<Double>(repeating: 0), count: vertices.count)
    var triangleIndices: [Int32] = []
    triangleIndices.reserveCapacity(faces.count * 3)
    for face in faces where face.count == 3 {
        let a = face[0], b = face[1], c = face[2]
        guard [a,b,c].allSatisfy({ $0 >= 0 && $0 < vertices.count }) else { continue }
        let p = SIMD3<Double>(Double(vertices[a].x), Double(vertices[a].y), Double(vertices[a].z))
        let q = SIMD3<Double>(Double(vertices[b].x), Double(vertices[b].y), Double(vertices[b].z))
        let r = SIMD3<Double>(Double(vertices[c].x), Double(vertices[c].y), Double(vertices[c].z))
        let n = simd_cross(q - p, r - p)
        guard simd_length_squared(n) > 1.0e-16 else { continue }
        vertexNormals[a] += n
        vertexNormals[b] += n
        vertexNormals[c] += n
        triangleIndices.append(contentsOf: [Int32(a),Int32(b),Int32(c)])
    }
    let normals = vertexNormals.map { value -> SCNVector3 in
        let norm = simd_length(value)
        let n = norm > 1.0e-12 ? value / norm : SIMD3<Double>(0, 0, 1)
        return SCNVector3(Float(n.x), Float(n.y), Float(n.z))
    }
    return SCNGeometry(
        sources: [SCNGeometrySource(vertices: vertices), SCNGeometrySource(normals: normals)],
        elements: [SCNGeometryElement(indices: triangleIndices, primitiveType: .triangles)]
    )
}
