import React, {useMemo} from 'react'
import {projectAvatarSilhouette} from './avatarSilhouetteFromMesh.js'

/** Flat vector silhouette projected from the *currently displayed* 3D avatar.
 * The 3D viewport and this SVG share the same Rust snapshot.avatar mesh.
 * When there is no 3D avatar geometry we intentionally render nothing.
 */
export default function ClothCraftStudioSilhouette({avatar, onPick}) {
  const projected = useMemo(() => projectAvatarSilhouette(avatar), [avatar?.positions, avatar?.triangles])
  if (!projected) return null
  return <g className="cc-studio-avatar" aria-label="Silhouette of current 3D avatar" pointerEvents={onPick?'visiblePainted':'none'}
    data-source-vertices={projected.sourceVertices} data-source-faces={projected.sourceFaces}
    data-contours={projected.contourCount}>
    <path data-2d-avatar-hit="true" onPointerDown={onPick?event=>event.stopPropagation():undefined}
      onClick={onPick?event=>{event.stopPropagation();onPick()}:undefined}
      style={onPick?{cursor:'pointer'}:undefined}
      d={projected.d} fillRule="evenodd" fill="#81898d" stroke="#606d72"
      strokeWidth=".0025" strokeLinejoin="round"/>
  </g>
}
