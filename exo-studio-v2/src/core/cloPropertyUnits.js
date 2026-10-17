// Inspector display-only units. Every native/material length remains stored
// in its original SI metre coordinate; only UI text and input are converted.
const toCentimetres={cm:1,mm:0.1,in:2.54}
export const CLO_LENGTH_UNITS=Object.freeze(['cm','mm','in'])
export function fromCentimetres(cm,unit='cm'){
  return Number.isFinite(cm)&&Object.hasOwn(toCentimetres,unit)?cm/toCentimetres[unit]:null
}
export function toCentimetresValue(value,unit='cm'){
  return Number.isFinite(value)&&Object.hasOwn(toCentimetres,unit)?value*toCentimetres[unit]:null
}
export function formatPropertyLength(cm,unit='cm'){
  const converted=fromCentimetres(cm,unit)
  return converted==null?'—':`${converted.toFixed(unit==='mm'?1:unit==='in'?3:2)} ${unit}`
}
