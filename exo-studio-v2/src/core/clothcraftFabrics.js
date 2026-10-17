// Specimen values from upstream ClothCraft src/fabrics.rs; mechanics and appearance are estimates.
// Keep native Fabric.name intact: it persists in projects and native undo/redo.
import { APPAREL_MATERIAL_EXPANSION } from '../data/apparelMaterialExpansion.js'
import { FABRIC_PRESETS } from '../data/defaultProject.js'
export const CLOTHCRAFT_FABRICS = [
  {
    "id": "cotton",
    "name": "Light woven cotton",
    "gsm": 99.648,
    "thicknessMm": 0.1905,
    "extension": [
      3.0,
      5.0
    ],
    "shear": 120.0,
    "bending": [
      3e-05,
      2e-05
    ],
    "evidence": "MIT #5: measured mass and thickness; elasticity/bending estimated.",
    "source": "https://people.csail.mit.edu/klbouman/pw/projects/materialproperties/dataset.html",
    "appearance": {
      "color": "#ddd8c9",
      "roughness": 0.85,
      "sheen": 0.25,
      "pitch": 0.0007,
      "weave": "plain"
    }
  },
  {
    "id": "jersey",
    "name": "Cotton-blend jersey",
    "gsm": 187.0,
    "thicknessMm": 0.6,
    "extension": [
      15.0,
      35.0
    ],
    "shear": 25.0,
    "bending": [
      1.5e-05,
      1e-05
    ],
    "evidence": "Wang 2011, Gray Interlock (60% cotton, 40% polyester): measured mass; other values estimated.",
    "source": "https://wanghmin.github.io/publication/wang-2011-dde/",
    "appearance": {
      "color": "#919c9e",
      "roughness": 0.94,
      "sheen": 0.5,
      "pitch": 0.0012,
      "weave": "knit"
    }
  },
  {
    "id": "wool",
    "name": "Thick woven wool",
    "gsm": 384.58,
    "thicknessMm": 1.1201,
    "extension": [
      6.0,
      9.0
    ],
    "shear": 100.0,
    "bending": [
      0.00018,
      0.00012
    ],
    "evidence": "MIT #6: measured mass and thickness; elasticity/bending estimated.",
    "source": "https://people.csail.mit.edu/klbouman/pw/projects/materialproperties/dataset.html",
    "appearance": {
      "color": "#766c65",
      "roughness": 0.98,
      "sheen": 0.8,
      "pitch": 0.0015,
      "weave": "plain"
    }
  },
  {
    "id": "denim",
    "name": "Denim",
    "gsm": 296.675,
    "thicknessMm": 0.6096,
    "extension": [
      1.5,
      3.0
    ],
    "shear": 300.0,
    "bending": [
      0.0004,
      0.00025
    ],
    "evidence": "MIT #13 (one specimen): measured mass and thickness; elasticity/bending estimated.",
    "source": "https://people.csail.mit.edu/klbouman/pw/projects/materialproperties/dataset.html",
    "appearance": {
      "color": "#304a70",
      "roughness": 0.88,
      "sheen": 0.3,
      "pitch": 0.0008,
      "weave": "twill"
    }
  },
  {
    "id": "leather",
    "name": "Thick nappa leather",
    "gsm": 750.0,
    "thicknessMm": 1.0,
    "extension": [
      4.0,
      6.0
    ],
    "shear": 500.0,
    "bending": [
      0.001,
      0.0008
    ],
    "evidence": "PURLEDER Auto Nappa: stated mass, median thickness 0.9\u20131.1 mm; mechanics estimated. Leather-goods/furniture reference.",
    "source": "https://purleder.com/en/our-leathers/autonappa",
    "appearance": {
      "color": "#382e29",
      "roughness": 0.48,
      "sheen": 0.05,
      "pitch": 0.002,
      "weave": "leather"
    }
  },
  {
    "id": "silk",
    "name": "Light silk",
    "gsm": 66.968,
    "thicknessMm": 0.127,
    "extension": [
      3.0,
      5.0
    ],
    "shear": 50.0,
    "bending": [
      8e-06,
      5e-06
    ],
    "evidence": "MIT #3: measured mass and thickness; elasticity/bending estimated.",
    "source": "https://people.csail.mit.edu/klbouman/pw/projects/materialproperties/dataset.html",
    "appearance": {
      "color": "#d8b9a0",
      "roughness": 0.32,
      "sheen": 0.65,
      "pitch": 0.0004,
      "weave": "plain"
    }
  },
  {
    "id": "linen",
    "name": "Linen",
    "gsm": 151.787,
    "thicknessMm": 0.2286,
    "extension": [
      2.0,
      3.0
    ],
    "shear": 170.0,
    "bending": [
      8e-05,
      5e-05
    ],
    "evidence": "MIT #8: measured mass and thickness; elasticity/bending estimated.",
    "source": "https://people.csail.mit.edu/klbouman/pw/projects/materialproperties/dataset.html",
    "appearance": {
      "color": "#c5b493",
      "roughness": 0.92,
      "sheen": 0.4,
      "pitch": 0.001,
      "weave": "plain"
    }
  },
  {
    "id": "nylon",
    "name": "Nylon ripstop",
    "gsm": 58.516,
    "thicknessMm": 0.0762,
    "extension": [
      4.0,
      6.0
    ],
    "shear": 80.0,
    "bending": [
      1.2e-05,
      1e-05
    ],
    "evidence": "MIT #25: measured mass and thickness; elasticity/bending estimated.",
    "source": "https://people.csail.mit.edu/klbouman/pw/projects/materialproperties/dataset.html",
    "appearance": {
      "color": "#697c65",
      "roughness": 0.65,
      "sheen": 0.1,
      "pitch": 0.001,
      "weave": "ripstop"
    }
  },
  {
    "id": "stretch",
    "name": "Stretch knit / Lycra",
    "gsm": 239.405,
    "thicknessMm": 0.381,
    "extension": [
      40.0,
      60.0
    ],
    "shear": 15.0,
    "bending": [
      2e-05,
      1.5e-05
    ],
    "evidence": "MIT #1: measured mass and thickness; elasticity/bending estimated. Knit loops are not simulated.",
    "source": "https://people.csail.mit.edu/klbouman/pw/projects/materialproperties/dataset.html",
    "appearance": {
      "color": "#454957",
      "roughness": 0.8,
      "sheen": 0.25,
      "pitch": 0.0007,
      "weave": "knit"
    }
  }
]
// The extended apparel catalog is shared with the browser editor, while each
// solver retains its own numeric conventions. We estimate the Rust quantities
// separately: percent extension at *an unspecified reference force* cannot
// define measured N/m tensile stiffness. These guesses are visibly labeled.
const visualPitch = {
  'jersey-knit': .0008, 'rib-knit': .0014, 'waffle-knit': .003,
  'terry-knit': .0015, 'fleece-pile': .002, 'plain-weave': .0008,
  'basket-weave': .001, twill: .00075, boucle: .002,
  'sheer-weave': .0005, crepe: .0007, silk: .0005,
  synthetic: .0007, ripstop: .001, mesh: .0025,
  leather: .0014, suede: .00035, velvet: .0006,
}
for (const entry of Object.values(FABRIC_PRESETS)) {
  if (CLOTHCRAFT_FABRICS.some(p=>p.id===entry.id)) continue
  const bend = Math.max(.1, Math.min(.99,entry.bend))
  const isSkin = ['suede','leather'].includes(entry.surfaceFamily)
  const woven = !/knit|terry|pile|mesh/.test(entry.surfaceFamily)
  CLOTHCRAFT_FABRICS.push({
    id: entry.id, name: entry.name,
    family: entry.surfaceFamily, construction: entry.construction,
    calibration:entry.calibration||{status:'estimated'},
    gsm: entry.gsm, thicknessMm: entry.thickness*1000,
    extension: [entry.stretchWarp*100,entry.stretchWeft*100],
    // Representative guesses in N/m, constrained to a sane finite interval.
    shear: Math.round((isSkin ? 550 : woven ? 210 : 45)*(bend/.7)*(entry.shearRelative||1)),
    // N.m, with a smooth bounded range. THESE ARE NOT measured fabric values.
    bending: [
      0.000012 * Math.pow(75,bend) * (isSkin?1.5:1),
      0.000009 * Math.pow(75,bend) * (isSkin?1.5:1),
    ],
    evidence: 'Unmeasured apparel design specification. Laboratory warp/weft/bias force-extension, bending, shear and friction calibration required.',
    source: 'https://support.clo3d.com/hc/en-us/articles/360041074334-Fabric-Kit-Manual',
    wash:entry.wash||null,
    appearance: {
      color:entry.color, roughness:entry.roughness, sheen:entry.sheen,
      pitch:visualPitch[entry.surfaceFamily] ?? .001,
      weave:entry.surfaceFamily,
    },
  })
}
// Preserve 5 additional original Rust specimens even if the React catalog has
// no same-ID counterpart. They may be referenced by existing saved projects.
if (CLOTHCRAFT_FABRICS.length<400) throw new Error(`Native fabric library below requested minimum: ${CLOTHCRAFT_FABRICS.length}`)
// Match native swatches to the same licensed photographic references used by
// React where an EXO catalog ID is shared. Source optical maps never confer
// laboratory-calibrated mechanics on Rust preset coefficients.
for(const preset of CLOTHCRAFT_FABRICS){
 const visual=FABRIC_PRESETS[preset.id]
 if(visual?.texture?.scanAssetId){
   preset.photoScan={
     ...visual.texture,
     color:visual.color,
     wash:visual.wash||null,
     opticalProvenance:visual.photoReference,
   }
 }
}

export function presetForFabric(fabric) { return CLOTHCRAFT_FABRICS.find(p=>p.name===fabric?.name) }
export function stiffnessForExtension(percent,p) {
 // Existing Rust nonlinear stretch-law inversion. 100 is the solver's
 // historical reference-force scale, not a standardized lab force.
 const lambda=1+Math.max(.1,Number(percent)||.1)/100,e=(lambda*lambda-1)/2;
 const transition=Math.max(1e-6,Number(p?.compression_transition)||.05)
 const suppliedRatio = Number(p?.compression_ratio)
 const ratio=Math.max(0,Math.min(1,Number.isFinite(suppliedRatio)?suppliedRatio:.5))
 const root=Math.hypot(e,transition);
 return 100/(lambda*Math.max(1e-6,ratio*e+(1-ratio)*(e+root-transition)/2*(1+e/root)/2));
}
export function presetProperties(preset,current) {
 const p={...current,density:preset.gsm/1000,thickness:preset.thicknessMm/1000,shear:preset.shear,bend_warp:preset.bending[0],bend_weft:preset.bending[1]};
 p.warp=stiffnessForExtension(preset.extension[0],p);p.weft=stiffnessForExtension(preset.extension[1],p);return p;
}
export const FABRIC_FIELDS=[['density','Surface mass','g/m²',1000],['thickness','Thickness','mm',1000],['warp','Warp stiffness','N/m',1],['weft','Weft stiffness','N/m',1],['shear','Shear stiffness','N/m',1],['bend_warp','Warp bending','µN·m',1e6],['bend_weft','Weft bending','µN·m',1e6]];
export function validFabric(p) {return FABRIC_FIELDS.every(([key])=>Number.isFinite(p[key])&&p[key]>0)}
