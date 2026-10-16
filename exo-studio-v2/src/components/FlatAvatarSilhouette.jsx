import React from 'react'

// Orthographic front-view body silhouette proportioned from the SAME avatar
// measurements used to size the 3D fitting model. This is purposefully one
// flat color: no eyes, eyebrows, mouth, hair, face shading or fake portrait.
// The neck, sloping deltoids, elbows, wrists, fingers, pelvis and leg volumes
// replace the previous generic geometric stick-figure outline.
export default function FlatAvatarSilhouette({ avatar={} }) {
  const shoulder = Math.max(19,Math.min(27,Number(avatar.shoulderWidthCm || 46)/2))
  const chest = Math.max(15,Math.min(23,Number(avatar.chestCm || 96)/Math.PI*.65))
  const waist = Math.max(11,Math.min(21,Number(avatar.waistCm || 78)/Math.PI*.64))
  const hip = Math.max(13,Math.min(22,Number(avatar.hipCm || 94)/Math.PI*.64))
  const armAngle = Math.max(-6,Math.min(30,Number(avatar.armAngleDeg||6)))
  const reach = armAngle*.18
  const d = [
    'M 0 -87',
    'C 6 -87 10.1 -83.2 10.1 -77',
    'C 10.2 -70.7 8.9 -67.7 6.8 -64.3',
    'C 6.0 -61.9 6.2 -59.5 7.0 -57.9',
    `C 11.8 -56.7 ${shoulder-7} -55.1 ${shoulder-2} -53.8`,
    `C ${shoulder+2} -51.6 ${shoulder+5} -48.7 ${shoulder+6} -43.3`,
    `C ${shoulder+7} -37.1 ${shoulder+reach+11} -29.7 ${shoulder+reach+12} -21.5`,
    `C ${shoulder+reach+14} -10.5 ${shoulder+reach+15} 1.0 ${shoulder+reach+16} 9.7`,
    `C ${shoulder+reach+18} 13.8 ${shoulder+reach+18} 17.7 ${shoulder+reach+16.7} 20.2`,
    `L ${shoulder+reach+15.4} 22.7 L ${shoulder+reach+14.0} 26.8`,
    `C ${shoulder+reach+13} 28.9 ${shoulder+reach+12.1} 28.9 ${shoulder+reach+11.9} 26.9`,
    `L ${shoulder+reach+13} 20.6 L ${shoulder+reach+10.2} 28.3`,
    `C ${shoulder+reach+9.4} 30.2 ${shoulder+reach+8.2} 29.4 ${shoulder+reach+8.8} 27.1`,
    `L ${shoulder+reach+9.5} 19.7 L ${shoulder+reach+6.1} 27.0`,
    `C ${shoulder+reach+5.2} 28.7 ${shoulder+reach+4.0} 27.5 ${shoulder+reach+5} 25.0`,
    `L ${shoulder+reach+7} 15.8`,
    `C ${shoulder+reach+5} 10.7 ${shoulder+reach+4} 3.9 ${shoulder+reach+3.0} -3.6`,
    `C ${shoulder+reach+2.2} -14.0 ${shoulder+3} -29.0 ${shoulder+1.5} -34`,
    `C ${shoulder+1} -40.0 ${chest+4} -44.5 ${chest+2} -42.0`,
    `C ${chest+1.4} -30 ${waist+3.0} -22.0 ${waist} -10.0`,
    `C ${waist-1} -4 ${hip} -0.0 ${hip} 7.0`,
    `C ${hip+1} 15.0 ${hip+1.5} 20.0 ${hip+1} 29.0`,
    `C ${hip} 40.0 ${hip-2.2} 48.0 ${hip-4} 55.0`,
    `C ${hip-5} 62.0 ${hip-4} 71.0 ${hip-6.5} 81.2`,
    `L ${hip-7} 88.0 C ${hip-6} 90.6 ${hip-3} 91.6 ${hip-1} 92.3`,
    `C ${hip+1} 93.6 ${hip+4} 94.5 ${hip+3} 96.0`,
    `C ${hip+2.2} 98 ${hip-3.2} 98.7 ${hip-8} 97.2`,
    `C ${hip-11.0} 96.0 ${hip-12.8} 93.0 ${hip-12.7} 89.0`,
    `L ${hip-12.7} 76.0 C ${hip-13.2} 69 ${hip-11.8} 63 ${hip-10.4} 56.0`,
    `C ${hip-9.7} 48 ${hip-9.7} 40 ${hip-10.4} 31.5`,
    `C ${hip-10.5} 26 ${hip-12} 22 0 22`,
    `C ${-hip+12} 22 ${-hip+10.5} 26 ${-hip+10.4} 31.5`,
    `C ${-hip+9.7} 40 ${-hip+9.7} 48 ${-hip+10.4} 56.0`,
    `C ${-hip+11.8} 63 ${-hip+13.2} 69 ${-hip+12.7} 76.0`,
    `L ${-hip+12.7} 89.0 C ${-hip+12.8} 93.0 ${-hip+11} 96.0 ${-hip+8} 97.2`,
    `C ${-hip+3.2} 98.7 ${-hip-2.2} 98 ${-hip-3} 96`,
    `C ${-hip-4} 94.5 ${-hip-1} 93.6 ${-hip+1} 92.3`,
    `C ${-hip+3} 91.6 ${-hip+6} 90.6 ${-hip+7} 88`,
    `L ${-hip+6.5} 81.2 C ${-hip+4} 71 ${-hip+5} 62 ${-hip+4} 55`,
    `C ${-hip+2.2} 48 ${-hip} 40 ${-hip-1} 29`,
    `C ${-hip-1.5} 20 ${-hip-1} 15 ${-hip} 7`,
    `C ${-hip} 0 ${-waist+1} -4 ${-waist} -10`,
    `C ${-waist-3} -22 ${-chest-1.4} -30 ${-chest-2} -42`,
    `C ${-chest-4} -44.5 ${-shoulder-1} -40 ${-shoulder-1.5} -34`,
    `C ${-shoulder-3} -29 ${-shoulder-reach-2.2} -14 ${-shoulder-reach-3} -3.6`,
    `C ${-shoulder-reach-4} 3.9 ${-shoulder-reach-5} 10.7 ${-shoulder-reach-7} 15.8`,
    `L ${-shoulder-reach-5} 25 C ${-shoulder-reach-4} 27.5 ${-shoulder-reach-5.2} 28.7 ${-shoulder-reach-6.1} 27`,
    `L ${-shoulder-reach-9.5} 19.7 L ${-shoulder-reach-8.8} 27.1`,
    `C ${-shoulder-reach-8.2} 29.4 ${-shoulder-reach-9.4} 30.2 ${-shoulder-reach-10.2} 28.3`,
    `L ${-shoulder-reach-13} 20.6 L ${-shoulder-reach-11.9} 26.9`,
    `C ${-shoulder-reach-12.1} 28.9 ${-shoulder-reach-13} 28.9 ${-shoulder-reach-14} 26.8`,
    `L ${-shoulder-reach-15.4} 22.7 L ${-shoulder-reach-16.7} 20.2`,
    `C ${-shoulder-reach-18} 17.7 ${-shoulder-reach-18} 13.8 ${-shoulder-reach-16} 9.7`,
    `C ${-shoulder-reach-15} 1 ${-shoulder-reach-14} -10.5 ${-shoulder-reach-12} -21.5`,
    `C ${-shoulder-reach-11} -29.7 ${-shoulder-7} -37.1 ${-shoulder-6} -43.3`,
    `C ${-shoulder-5} -48.7 ${-shoulder-2} -51.6 ${-shoulder+2} -53.8`,
    `C ${-shoulder+7} -55.1 -11.8 -56.7 -7 -57.9`,
    'C -6.2 -59.5 -6 -61.9 -6.8 -64.3',
    'C -8.9 -67.7 -10.2 -70.7 -10.1 -77',
    'C -10.1 -83.2 -6 -87 0 -87 Z',
  ].join(' ')
  return <path className="draft-avatar-contour" d={d} data-avatar-proportioned="true" aria-hidden="true"/>
}
