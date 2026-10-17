// Numeric CLO-style Add Point / Split Line measurements, in centimeters.
// This is an independent implementation of user-facing documented behaviors:
// Split by length / ratio / uniform divisions on true straight or curved arcs.
import { edgeLength } from './project.js'
import { quadraticAtLengthFraction } from './draftingPrecision.js'

export const SPLIT_MODES = Object.freeze({
  uniform: 'Equal length divisions',
  length: 'Distance from edge start',
  ratio: 'Ratio from edge start',
})

export function draftingSplitFractions(piece, edgeIndex, {
  method = 'uniform', count = 2, lengthCm, ratioPercent,
} = {}) {
  if (!piece || !Array.isArray(piece.points) || !Number.isInteger(edgeIndex)
    || edgeIndex < 0 || edgeIndex >= piece.points.length) throw new Error('Select a valid pattern edge')
  const length = edgeLength(piece, edgeIndex)
  if (!Number.isFinite(length) || length < .001) throw new Error('Edge must have a positive measurable length')
  if (method === 'uniform') {
    const number = Number(count)
    if (!Number.isInteger(number) || number < 2 || number > 12) {
      throw new Error('Use 2 to 12 equal-length segments')
    }
    return Array.from({ length: number - 1 }, (_, index) => (index + 1) / number)
  }
  let fraction
  if (method === 'length') {
    const distance = Number(lengthCm)
    if (lengthCm === '' || !Number.isFinite(distance)) throw new Error('Enter a finite edge distance in centimeters')
    fraction = distance / length
  } else if (method === 'ratio') {
    const ratio = Number(ratioPercent)
    if (ratioPercent === '' || !Number.isFinite(ratio)) throw new Error('Enter a finite edge percentage')
    fraction = ratio / 100
  } else throw new Error('Unknown split mode')
  // Existing project topology split maintains a five-percent minimum per
  // subdivision to prevent degenerate manufacturing and seam edges.
  if (fraction < .05 || fraction > .95) {
    throw new Error('Split position must lie between 5% and 95% of the edge length')
  }
  return [fraction]
}

export function splitParameterAtArcFraction(piece, edgeIndex, fraction) {
  if (!piece?.points?.[edgeIndex]) throw new Error('Invalid split edge')
  if (!Number.isFinite(fraction) || fraction < .05 - 1e-9 || fraction > .95 + 1e-9) {
    throw new Error('Split arc fraction must remain inside the edge')
  }
  const control = piece.curves?.[edgeIndex]
  if (!control) return fraction
  const a = piece.points[edgeIndex]
  const b = piece.points[(edgeIndex + 1) % piece.points.length]
  return quadraticAtLengthFraction(a, { x: control.cx, y: control.cy }, b, fraction).parameter
}
