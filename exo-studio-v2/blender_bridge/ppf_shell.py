"""Build a PPF-ready sewn shell from a native Garment Studio simulation.

The interactive XPBD backend owns dressing/sewing. PPF is a second-stage FEM
contact solver, so it needs topology that will not fall apart once the XPBD
distance constraints are gone. For ordinary 1:1 closed seams we can safely
weld the corresponding native particle IDs into one shell.

Non-standard seams (gather/ease/elastic/open/zipper/etc.) are deliberately
reported as unsupported instead of being silently flattened into bad topology.
"""

from __future__ import annotations

from collections import defaultdict


def _remove_dangling_seam_spikes(faces, face_fabrics, face_piece_ids):
    """Remove triangles that became non-manifold flaps after seam welding.

    Where two sewn pieces meet, a triangulated crotch/rise junction can produce
    a third *dangling* triangle on the same shared edge. A safe, local test is:
    the edge has >2 incident faces and both OTHER triangle edges are exposed
    (used by exactly one face). Removing that triangle restores the stitched
    fabric without altering the two actual cloth faces. Repeat after each pass
    because incidence counts can change; do not touch ambiguous multi-layer
    junctions.
    """
    removed = 0
    while True:
        by_edge = defaultdict(list)
        for fi, face in enumerate(faces):
            for a, b in ((face[0], face[1]), (face[1], face[2]), (face[2], face[0])):
                by_edge[tuple(sorted((a, b)))].append(fi)
        spikes = set()
        for bad_edge, incidents in by_edge.items():
            if len(incidents) <= 2:
                continue
            for fi in incidents:
                face = faces[fi]
                others = [
                    tuple(sorted((a, b)))
                    for a, b in ((face[0], face[1]), (face[1], face[2]), (face[2], face[0]))
                    if tuple(sorted((a, b))) != bad_edge
                ]
                if len(others) == 2 and all(len(by_edge[e]) == 1 for e in others):
                    spikes.add(fi)
        if not spikes:
            break
        keep = [i for i in range(len(faces)) if i not in spikes]
        faces = [faces[i] for i in keep]
        face_fabrics = [face_fabrics[i] for i in keep]
        face_piece_ids = [face_piece_ids[i] for i in keep]
        removed += len(spikes)

    remaining = sum(len(indices) > 2 for indices in by_edge.values())
    return faces, face_fabrics, face_piece_ids, removed, remaining


def _is_weldable_seam(seam):
    seam_type = str(seam.get("type") or "normal")
    ratio = float(seam.get("ratio") or 1.0)
    open_fraction = float(seam.get("openFraction") or 0.0)
    return (
        seam_type == "normal"
        and abs(ratio - 1.0) < 1e-6
        and open_fraction <= 1e-6
        and seam.get("elasticRatio") is None
        and not seam.get("easeSide")
        and not seam.get("gatherSide")
    )


class _UnionFind:
    def __init__(self):
        self.parent = {}

    def find(self, item):
        parent = self.parent.setdefault(item, item)
        if parent != item:
            self.parent[item] = self.find(parent)
        return self.parent[item]

    def union(self, a, b):
        ra = self.find(a)
        rb = self.find(b)
        if ra != rb:
            self.parent[rb] = ra


def build_welded_shell(project, simulation_payload, simulation_result):
    payload_by_id = {
        piece.get("id"): piece
        for piece in simulation_payload.get("pieces", [])
    }
    result_by_id = {
        piece.get("id"): piece
        for piece in simulation_result.get("pieces", [])
    }

    positions = {}
    faces = []
    face_fabrics = []
    face_piece_ids = []
    piece_particles = defaultdict(list)
    fabric_by_piece = {}

    errors = []
    for piece_id, payload_piece in payload_by_id.items():
        result_piece = result_by_id.get(piece_id)
        if result_piece is None:
            errors.append(f"missing simulation result for piece {piece_id}")
            continue
        particle_ids = payload_piece.get("particleIndices") or []
        vertices = result_piece.get("vertices") or []
        if len(particle_ids) != len(vertices):
            errors.append(
                f"particle/vertex count mismatch for {piece_id}: "
                f"{len(particle_ids)} != {len(vertices)}"
            )
            continue
        fabric_id = payload_piece.get("fabricId") or "main"
        fabric_by_piece[piece_id] = fabric_id
        for local_index, global_id in enumerate(particle_ids):
            gid = int(global_id)
            positions[gid] = tuple(float(v) for v in vertices[local_index])
            piece_particles[piece_id].append(gid)
        for face in result_piece.get("faces") or []:
            try:
                global_face = tuple(int(particle_ids[int(i)]) for i in face)
            except (IndexError, TypeError, ValueError):
                errors.append(f"invalid face index in piece {piece_id}")
                continue
            faces.append(global_face)
            face_fabrics.append(fabric_id)
            face_piece_ids.append(piece_id)

    seam_by_id = {
        seam.get("id"): seam
        for seam in project.get("seams", [])
        if seam.get("id")
    }
    weldable_ids = {
        seam_id
        for seam_id, seam in seam_by_id.items()
        if _is_weldable_seam(seam)
    }
    unsupported_ids = sorted(set(seam_by_id) - weldable_ids)

    seam_constraints = [
        constraint
        for constraint in simulation_payload.get("constraints", [])
        if constraint.get("type") == "seam"
    ]
    constrained_ids = {
        constraint.get("seamId")
        for constraint in seam_constraints
        if constraint.get("seamId")
    }
    missing_constraints = sorted(weldable_ids - constrained_ids)
    if missing_constraints:
        errors.append(
            "missing native seam constraints for: " + ", ".join(missing_constraints)
        )

    uf = _UnionFind()
    weld_constraint_count = 0
    for constraint in seam_constraints:
        seam_id = constraint.get("seamId")
        if seam_id not in weldable_ids:
            continue
        a = int(constraint["a"])
        b = int(constraint["b"])
        if a not in positions or b not in positions:
            errors.append(f"seam {seam_id} references missing particle {a}/{b}")
            continue
        uf.union(a, b)
        weld_constraint_count += 1

    members = defaultdict(list)
    for particle_id, position in positions.items():
        members[uf.find(particle_id)].append((particle_id, position))

    # Sewn vertices are placed at the mean of their XPBD-settled positions.
    # The interactive solver's seam rest gap is a collision/stability detail;
    # PPF receives the garment mid-surface as a continuous stitched shell.
    representative_position = {}
    for representative, items in members.items():
        count = len(items)
        representative_position[representative] = tuple(
            sum(position[axis] for _, position in items) / count
            for axis in range(3)
        )

    representative_ids = sorted(representative_position)
    compact_index = {
        representative: index
        for index, representative in enumerate(representative_ids)
    }
    vertices = [
        representative_position[representative]
        for representative in representative_ids
    ]

    compact_faces = []
    compact_face_fabrics = []
    compact_face_piece_ids = []
    seen_faces = set()
    degenerate_faces = 0
    duplicate_faces = 0
    for face, fabric_id, piece_id in zip(faces, face_fabrics, face_piece_ids):
        mapped = tuple(compact_index[uf.find(vertex)] for vertex in face)
        if len(set(mapped)) < 3:
            degenerate_faces += 1
            continue
        face_key = tuple(sorted(mapped))
        if face_key in seen_faces:
            duplicate_faces += 1
            continue
        seen_faces.add(face_key)
        compact_faces.append(mapped)
        compact_face_fabrics.append(fabric_id)
        compact_face_piece_ids.append(piece_id)

    (compact_faces, compact_face_fabrics, compact_face_piece_ids,
     spike_faces_removed, remaining_nonmanifold_edges) = _remove_dangling_seam_spikes(
        compact_faces, compact_face_fabrics, compact_face_piece_ids,
    )
    if remaining_nonmanifold_edges:
        errors.append(
            f"{remaining_nonmanifold_edges} non-manifold seam edges remain "
            "after conservative spike removal"
        )

    fabrics = sorted(set(compact_face_fabrics))
    ready = (
        not errors
        and not unsupported_ids
        and bool(compact_faces)
        and len(fabrics) == 1
        and weld_constraint_count > 0
    )

    return {
        "vertices": vertices,
        "faces": compact_faces,
        "faceFabrics": compact_face_fabrics,
        "facePieceIds": compact_face_piece_ids,
        "fabrics": fabrics,
        "pieceParticles": dict(piece_particles),
        "weldableSeamIds": sorted(weldable_ids),
        "unsupportedSeamIds": unsupported_ids,
        "weldConstraintCount": weld_constraint_count,
        "degenerateFacesRemoved": degenerate_faces,
        "duplicateFacesRemoved": duplicate_faces,
        "danglingSeamSpikeFacesRemoved": spike_faces_removed,
        "nonmanifoldEdgesRemaining": remaining_nonmanifold_edges,
        "errors": errors,
        "ready": ready,
        "reason": (
            "ready"
            if ready
            else "PPF automatic weld currently requires only ordinary closed "
                 "1:1 seams and one fabric per connected shell"
        ),
    }
