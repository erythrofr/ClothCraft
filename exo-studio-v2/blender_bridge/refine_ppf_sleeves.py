"""Conforming sleeve triangulation for high-curvature cylindrical draping.

Subdivide triangles in the original flat metric BEFORE folding. The old
~9 cm sleeve edges measured chord compression as ~9% material strain even
for an intrinsically isometric cylindrical layout. Midpoint refinement
reduces the chord approximation error without altering sewing endpoints.

The original particle indices and sew correspondences are never renumbered.
"""
import copy


def refine_pattern_triangles(payload, piece_ids, levels=1):
    if not isinstance(levels, int) or levels < 0 or levels > 3:
        raise ValueError('Sleeve subdivisions must be in [0, 3]')
    refined = copy.deepcopy(payload)
    shell = refined['shell']
    for _ in range(levels):
        vertices = shell['vertices']
        faces = shell['faces']
        face_owners = shell['facePieceIds']
        if len(face_owners) != len(faces):
            raise ValueError('Face ownership mismatch before subdivision')
        midpoint_ids = {}
        new_faces = []
        new_owners = []
        for face, piece in zip(faces, face_owners):
            a, b, c = face
            if piece not in piece_ids:
                new_faces.append([a, b, c])
                new_owners.append(piece)
                continue

            def midpoint(i, j):
                key = (min(i, j), max(i, j))
                if key not in midpoint_ids:
                    midpoint_ids[key] = len(vertices)
                    vertices.append([(vertices[i][axis] + vertices[j][axis]) * .5 for axis in range(3)])
                return midpoint_ids[key]

            ab, bc, ca = midpoint(a, b), midpoint(b, c), midpoint(c, a)
            for f in ([a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]):
                new_faces.append(f)
                new_owners.append(piece)
        shell['faces'] = new_faces
        shell['facePieceIds'] = new_owners
        for piece in shell['pieces']:
            owner = piece['id']
            piece['particleIndices'] = sorted(set(piece['particleIndices']) | {
                index for f, face_owner in zip(new_faces, new_owners)
                if face_owner == owner for index in f
            })
            # Keep the face ranges synchronized with the rebuilt face order.
            indices = [i for i, item in enumerate(new_owners) if item == owner]
            if indices and indices != list(range(indices[0], indices[-1] + 1)):
                raise ValueError('Piece faces are no longer contiguous')
            piece['faceStart'] = indices[0] if indices else 0
            piece['faceCount'] = len(indices)
        # Each sleeve's cross-panel constraint stays on the original vertex
        # indices; introducing new stitches requires an independent sewability
        # check, not a silent change to the 2D manufacturing pattern.
    return refined


def refine_sleeve_triangles(payload, levels=1):
    return refine_pattern_triangles(payload, ('sleeve-left', 'sleeve-right'), levels)
