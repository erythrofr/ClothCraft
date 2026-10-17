import * as THREE from 'three'
import { garmentPreviewPose } from '../core/garmentPreviewGeometry.js'

/**
 * Presentation-only pattern pose. Source points, seam references and stitch
 * coordinates remain authoritative; this transform is not simulated draping.
 */
export function garmentThreeViewPose(piece, templateId, index, count) {
  const upperBody = ['tee', 'hoodie', 'zip-hoodie'].includes(templateId)
  const sourcePose = garmentPreviewPose(
    piece, templateId === 'tee' ? 'tee-exploded' : 'pattern-study', index, count,
  )
  if (!upperBody) return sourcePose
  const torso = piece.id === 'front' || piece.id === 'back' || (templateId === 'zip-hoodie' && ['front-left', 'front-right'].includes(piece.id))
  if (torso) {
    return point => {
      const halfWidth = templateId === 'tee' ? 27.5 : 31
      const p = templateId === 'tee' ? sourcePose(point) : new THREE.Vector3(
        .98 * Math.sin(point.x / halfWidth * 1.02), (point.y - 35.5) * .0355,
        (piece.id === 'back' ? -1 : 1) * (.21 + .27 * Math.cos(point.x / halfWidth * 1.02)),
      )
      // Concentrate the inward bow in the middle third of the cloth.
      // A smooth zero-slope falloff keeps the side seam/armhole positions
      // aligned with the original pattern even after increasing the bow.
      const width = Math.max(0, 1 - Math.pow(point.x / halfWidth, 2))
      const middle = width * width
      // The central fabric bows gently toward the space between the panels.
      // Both source contours remain unchanged in drafting coordinates.
      const waistDrape = (.018 * Math.sin(point.y * .22 + point.x * .09)
        + .025 * Math.sin((point.y - 18) * .065)) * middle
      // Shape a shallow, continuous scoop into each separate panel, with
      // zero displacement at the outer seams and no new drafted vertices.
      p.z -= (piece.id === 'back' ? -1 : 1) * (.37 * middle + waistDrape)
      return p
    }
  }
  if (piece.id === 'sleeve-left' || piece.id === 'sleeve-right') {
    return point => {
      // Each cap points toward the body; each cuff extends away and down.
      // Mirroring x and z gives symmetric sleeves without flipping vertical.
      const side = piece.id === 'sleeve-left' ? -1 : 1
      // Preserve a continuous derivative at the cap apex so lighting normals
      // stay finite when the geometry sampler steps just beyond the cut line.
      const sleeveLength = templateId === 'tee' ? 25 : 62
      const sleeveHalfWidth = templateId === 'tee' ? 17.25 : 19
      const run = (sleeveLength - point.y) / sleeveLength
      const phi = point.x / sleeveHalfWidth * 2.20
      // The hem rolls wider than the cap; both sleeves use the same
      // vertical mapping so one cannot end up inverted in the back view.
      const radius = .32 + .065 * Math.max(0, Math.min(1, run))
      return new THREE.Vector3(
        side * (1.00 + run * (templateId === 'tee' ? .79 : 1.18)),
        .74 - run * (templateId === 'tee' ? .39 : .78) + .18 * Math.cos(phi),
        side * (radius * Math.sin(phi)),
      )
    }
  }
  // Accessories stay source-derived in a smaller shelf below the torso.
  // This includes authored hoods, rib pieces and pockets, without inventing
  // any missing components or turning an outerwear preview into a T-shirt.
  if (templateId !== 'tee') return point => {
    const p = sourcePose(point)
    p.x *= .64
    p.y = -1.85 + p.y * .35
    p.z *= .55
    return p
  }
  return sourcePose
}
