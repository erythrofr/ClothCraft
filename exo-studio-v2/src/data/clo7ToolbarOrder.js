/** CLO 7.0.242 actual toolbar inventory, Oct 16 2026.
 *
 * Evidence: live running CLO via the signed EXO CLO Inspector.app:
 * AXUIElement title + role + pixel position; ScreenCaptureKit screenshot at
 * ~/Library/Application Support/EXO-CLO-Inspector/clo-property-editor-reference.png
 *
 * The 3D strip (left) and the 2D strip (right) each have two independent
 * columns A and B, ordered TOP TO BOTTOM. Every item below has a verified
 * CLO accessibility title and is positioned in its observed physical column.
 * Generic unlabeled AXButtons attached to tool dropdowns are omitted.
 *
 * The displayed CAD artwork is EXO original, NOT CLO proprietary artwork.
 * Commands with no functionally equivalent EXO implementation have null
 * action and must remain disabled, not deceptively trigger adjacent features.
 * observedY is the position of the actual CLO control in a 1512 x 900 window;
 * it is evidence metadata, not a fixed EXO layout coordinate.
 */
const t=(id,label,icon,action=null,observedY=0,after=false)=>({id,label,icon,action,observedY,after})

export const CLO7_3D_A = [
 t('A01','Simulate','simulate','simulate',130,true),
 t('A02','Select/Move','select-3d','transform',174),
 t('A03','Select Mesh (Brush)','wireframe','mesh-select',208,true),
 t('A04','Edit Styleline','curve',null,252),
 t('A05','Edit Sewing','seam-links',null,296),
 t('A06','Segment Sewing','seam-links',null,330),
 t('A07','Free Sewing','sew',null,364),
 t('A08','Auto Sewing','sew',null,398,true),
 t('A09','Edit Tack','pin',null,442),
 t('A10','Tack','pin',null,476,true),
 t('A11','Fold Arrangement','avatar',null,520),
 t('A12','Fold 3D Garment','avatar',null,554),
 t('A13','Reset 2D Arrangement (All)','mirror',null,588),
 t('A14','Reset 3D Arrangement (All)','avatar',null,622),
 t('A15','Re-drape 3D Arrangement','simulate',null,656,true),
 t('A16','Hi-Res Garment','wireframe',null,700,true),
 t('A17','Edit Measure (Avatar)','measure',null,744),
 t('A18','Basic Tape Measure (Avatar)','measure',null,778,true),
 t('A19','Edit Measure (Garment)','measure',null,822),
 t('A20','Linear Measure (Garment)','measure',null,856),
]

export const CLO7_3D_B = [
 t('B01','Play Motion','avatar',null,130,true),
 t('B02','Edit Line (3D Pattern)','curve',null,174),
 t('B03','Line (3D Pattern)','internal',null,208),
 t('B04','3D Base Pen','points',null,242,true),
 t('B05','Edit 3D Pen (Avatar)','points',null,286),
 t('B06','3D Pen (Avatar)','points',null,320,true),
 t('B07','Edit Texture (3D)','material',null,364),
 t('B08','Transform Graphic','graphics',null,398),
 t('B09','Graphic (3D Pattern)','graphics',null,432,true),
 t('B10','Select/Move Button','buttons',null,476),
 t('B11','Button','buttons',null,510),
 t('B12','Fasten Button','fastener',null,544,true),
 t('B13','Zipper','trim',null,588,true),
 t('B14','Edit Piping','seam-weld',null,632),
 t('B15','Piping','seam-weld',null,666,true),
 t('B16','Select Binding','seam-weld',null,710),
 t('B17','Binding','seam-weld',null,744,true),
 t('B18','Press','fabric',null,788),
]

export const CLO7_2D_A = [
 t('A01','Transform Pattern','select-2d','select',130),
 t('A02','Edit Pattern','points','point',164),
 t('A03','Fullness (Point)','points',null,198),
 t('A04','Polygon','polygon-tool','create-polygon',232),
 t('A05','Internal Polygon/Line','internal','internal',266),
 t('A06','Base Polygon','polygon-tool',null,300),
 t('A07','Trace','select-2d',null,334),
 t('A08','Notch','notch','notch',368),
 t('A09','Seam Allowance','internal',null,402,true),
 t('A10','Walk Pattern','measure',null,446,true),
 t('A11','Edit Point of Measure','pom',null,490),
 t('A12','Point of Measure','pom',null,524,true),
 t('A13','Edit Annotation','pattern-properties',null,568),
 t('A14','Pattern Annotation','pattern-properties',null,602,true),
 t('A15','Pleats','grading',null,646,true),
 t('A16','Edit Grading','grading',null,690),
 t('A17','Auto Grading','grading',null,724),
]

export const CLO7_2D_B = [
 t('B01','Edit Sewing','seam-links',null,130),
 t('B02','Segment Sewing','sew',null,164),
 t('B03','Free Sewing','sew','sew',198),
 t('B04','Check Sewing Length','measure',null,232,true),
 t('B05','Steam','fabric',null,276,true),
 t('B06','Seam Taping','sew',null,320,true),
 t('B07','Edit Texture (2D)','material',null,364),
 t('B08','Transform Graphic','graphics',null,398),
 t('B09','Graphic (2D Pattern)','graphics',null,432,true),
 t('B10','Edit Topstitch','topstitch',null,476),
 t('B11','Segment Topstitch','topstitch',null,510,true),
 t('B12','Edit Puckering','fabric',null,554),
 t('B13','Segment Puckering','fabric',null,588,true),
 t('B14','Set Sublayer','grading',null,632,true),
 t('B15','Fill','fabric',null,676),
]

const assertUnique=(columns,domain)=>{
 for(const [side,entries] of Object.entries(columns)){
  entries.forEach((entry,index)=>{
   if(entry.id!==side+String(index+1).padStart(2,'0'))
    throw Error(`Invalid ${domain} CLO toolbar order: ${entry.id}`)
   if(!entry.label||!Number.isFinite(entry.observedY))throw Error(`Invalid observed CLO toolbar control ${entry.id}`)
   if(index && entry.observedY<=entries[index-1].observedY)throw Error(`Unsorted CLO toolbar position ${entry.id}`)
  })
 }
}
assertUnique({A:CLO7_3D_A,B:CLO7_3D_B},'3D')
assertUnique({A:CLO7_2D_A,B:CLO7_2D_B},'2D')
