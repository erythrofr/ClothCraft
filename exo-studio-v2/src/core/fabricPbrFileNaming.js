// Common fabric scan and Poly Haven / ambientCG naming conventions. Do not
// silently interpret DirectX normals as OpenGL or packed ARM/AO textures as
// uncompressed scalar maps; these require explicit channel conversion.
export function classifyFabricPbrFilename(filename) {
  const base=String(filename || '').toLowerCase().replace(/\.(png|jpe?g|webp)$/i,'')
  if (/([_-]nor[_-]?dx|[_-]normal[_-]?dx|[_-]directx|[_-]arm|[_-]rough[_-]?ao)/.test(base)) return null
  const tokens=base.replace(/[^a-z0-9]+/g,' ').trim().split(/\s+/)
  const has=(values)=>tokens.some(token=>values.includes(token))
  if (has(['normal','normalgl','nrm','nor']) || (tokens.includes('nor') && tokens.includes('gl'))) return 'normal'
  if (has(['rough','roughness','rgh'])) return 'roughness'
  if (has(['metal','metallic','metalness','mtl'])) return 'metalness'
  if (has(['alpha','opacity','transparency','translucency'])) return 'opacity'
  if (has(['height','displacement','disp','hgt'])) return 'displacement'
  if (has(['diff','diffuse','albedo','basecolor','basecolour','color','colour','col'])) return 'color'
  return null
}
