import React, {useMemo} from 'react'
import {projectAvatarSilhouette} from './avatarSilhouetteFromMesh.js'

/** Flat vector silhouette projected from the *currently displayed* 3D avatar.
 * The 3D viewport and this SVG share the same Rust snapshot.avatar mesh.
 * When there is no 3D avatar geometry we intentionally render nothing.
 */
export default function ClothCraftStudioSilhouette({avatar}) {
  const projected = useMemo(() => projectAvatarSilhouette(avatar), [avatar?.positions, avatar?.triangles])
  if (!projected) return null
  return <g className="cc-studio-avatar" aria-label="Silhouette of current 3D avatar" pointerEvents="none"
    data-source-vertices={projected.sourceVertices} data-source-faces={projected.sourceFaces}
    data-contours={projected.contourCount}>
    <path d={projected.d} fillRule="evenodd" fill="#81898d" stroke="#606d72"
      strokeWidth=".0025" strokeLinejoin="round"/>
  </g>
}
