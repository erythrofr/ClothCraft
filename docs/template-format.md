# Templates de couture v1 et v2

Les règles rectangulaires v1 ci-dessous restent compatibles. Le v2 ajoute les contours polygonaux, noms de segments et paramètres de Delaunay : voir [meshing.md](meshing.md) et [first-fit.md](first-fit.md). Les coutures utilisent la même formulation intégrée dans les deux versions.

Exemples exécutables : [two-panel.json](../examples/templates/two-panel.json) et [local-ease.json](../examples/templates/local-ease.json). Les types Rust avec `deny_unknown_fields` sont la définition normative actuelle ; le compilateur complète la désérialisation par la validation géométrique et des références.

```powershell
cargo run --locked --no-default-features -j 2 --bin cloth-template -- validate examples/templates/two-panel.json
cargo run --locked --no-default-features -j 2 --bin cloth-template -- bake examples/templates/two-panel.json --output output/template-bake
cargo run --locked --release --no-default-features -j 2 --bin cloth-template -- simulate examples/templates/two-panel.json --steps 30 --threads 2 --output output/template-simulation
```

`example chemin.json` crée un exemple en refusant d'écraser un fichier. `bake` et `simulate` remplacent leurs artefacts à noms fixes dans le dossier de sortie. `simulate` renvoie un code d'échec si un pas n'a pas convergé ; les métriques et l'état final restent enregistrés pour diagnostic. Aucun de ces modes ne crée de fenêtre.

## Panneaux et matières

La racine contient `format: "marvelous-cloth-template"`, `version: 1`, `name`, `fabrics`, `panels`, `seams`. Les IDs sont uniques dans chaque famille, ASCII alphanumériques ou `_`/`-`, de 1 à 80 caractères. Limites actuelles : 1..128 panneaux, au plus 512 coutures. Un tissu doit exister pour chaque référence `fabric`.

Chaque panneau fournit un rectangle `pattern` (`width`, `height` en mètres, `nx`, `ny` en cellules), un tissu `fabric`, `grain_degrees`, un `placement` et éventuellement des `pins` (`top_left`, `top_right`, `bottom_right`, `bottom_left`). Dimensions : 0,01..100 m ; résolution : 1..128 cellules par axe. Modifier la résolution ne change pas la définition des coutures.

Dans le patron, u va à droite et v vers le bas. Le grain à 0° correspond à +u, à 90° à +v ; la trame est perpendiculaire. Le placement transforme `(u,-v,0)` par `R = Rx Ry Rz`, puis ajoute `translation`. Les angles sont en degrés, avec vecteurs colonnes. Les pins se placent aux coins transformés.

`FabricProperties` contient `warp`, `weft`, `shear` (N/m), `bend_warp`, `bend_weft` (N·m), `density` (kg/m²), `thickness` (m), `compression_ratio` (0..1) et `compression_transition` (déformation de Green). Les valeurs de l'exemple sont non calibrées. Le droit-fil ne fait pas partie des propriétés partagées du tissu.

## Bords et coutures

Les bords suivent le contour dans cet ordre : `top` gauche → droite ; `right` haut → bas ; `bottom` droite → gauche ; `left` bas → haut. `range: [a,b]` est un intervalle de longueur au repos normalisée, avec `0 <= a < b <= 1`. Son extension doit être d'au moins 1e-9. Il ne s'agit pas d'indices de sommets.

```json
{
  "id": "centre-seam",
  "a": {"panel": "left", "side": "right", "range": [0.0, 1.0]},
  "b": {"panel": "right", "side": "left", "range": [0.0, 1.0]},
  "reverse_b": true,
  "notches": [[0.5, 0.5]],
  "stiffness": 5000.0,
  "allow_ease": false
}
```

Après restriction aux intervalles, `reverse_b` inverse la direction de B. Chaque paire de crans `notches: [[s,t],...]` décrit la correspondance entre A et B dans ces coordonnées locales, **après** inversion de B. Les extrémités `(0,0)` et `(1,1)` sont implicites ; les crans intérieurs doivent croître strictement dans les deux composantes. La correspondance `t = phi(s)` est linéaire par morceaux.

L'exemple `[0.4,0.6]` répartit des longueurs différentes de part et d'autre du cran. Les longueurs globales ou locales différentes sont refusées sans `allow_ease: true`. Ce drapeau autorise la correspondance et émet un avertissement ; il ne redimensionne pas le repos et ne génère pas de fronces physiques. Il ne représente pas non plus l'aisance vêtement-corps du travail EASE.

## Énergie de couture

Pour les longueurs restreintes LA et LB :

```text
g(s) = xA(s) - xB(phi(s))
dmu = (LA ds + LB dphi)/2
E = k/2 integral |g(s)|² dmu
```

`k = stiffness` est en N/m². La mesure moyenne traite les deux côtés symétriquement ; à longueurs identiques et correspondance uniforme, elle redevient la longueur du bord. La partition combine sommets des deux bords et crans. Deux points de Gauss par intervalle intègrent exactement l'énergie quadratique du raccord linéaire. La raideur totale ne croît donc pas artificiellement avec le nombre de sommets.

Un échantillon a `g = sum(c_i x_i)` ; les indices répétés sont fusionnés et `sum(c_i)=0`. Gradient : `k w c_i g`. Hessienne : `k w c_i c_j I`, positive semi-définie. L'énergie est objective, les forces et couples internes s'équilibrent. Il s'agit d'une pénalité de raccord, pas d'une contrainte dure, d'un multiplicateur de Lagrange ou de points de fil explicites.

Le maximum d'ouverture est évalué à toutes les extrémités de la partition : la norme d'un écart linéaire y atteint son maximum. Le RMS est intégré avec la même mesure que l'énergie. Les tolérances de comparaison des longueurs sont relatives à 1e-8 ; elles ne constituent pas une tolérance manufacturière.

## Artefacts et limites

- `patterns.svg` : vue du repos, grain, bords colorés, ligne de coupe (marge de couture) et crans ; pas un patron imprimable à l'échelle.
- `patterns-print.svg` : feuille **à l'échelle** en millimètres, une pièce par page, avec ligne de couture, ligne de coupe, trous, lignes intérieures, crans, grain et une règle de 100 mm. Sans imbrication ni découpe en tuiles (voir [markings.md](markings.md)).
- `cloth.obj` : positions simulées et groupes par panneau ; `vt` contient les coordonnées locales en mètres.
- `fibers.json` : une entrée par triangle, directions monde chaîne/trame, stretches, cosinus du cisaillement et validité. L'ordre correspond aux faces OBJ.
- `grain-guides.obj` : deux lignes centrales par panneau, interpolées sur les triangles de la surface déformée ; aucune mécanique de fil supplémentaire.
- `template.json` : copie de la définition éditable. `initial.obj`, `metrics.jsonl` et `run.json` s'ajoutent en simulation.

Panneaux rectangulaires uniquement. Pas de courbes, pinces géométriques, marges, patrons industriels, avatar, fermeture éclair, plis de couture, fil explicite ou contact entre panneaux. Un assemblage qui converge peut toujours s'auto-intersecter. Les placements sont explicites, sans arrangement automatique autour d'un corps. Le CLI multi-panneaux n'est pas encore branché sur l'éditeur desktop.

## Optional curve and board fields

A polygon may now include `"curves": {"edge_name": [[c1_u, c1_v], [c2_u, c2_v]]}`. Coordinates are local material meters; the edge's existing consecutive anchors remain its endpoints. Missing entries are straight. Unknown edge names and non-finite controls are rejected. Curves are flattened to 0.25 mm tolerance before meshing, then sampled segment chains are rejoined under the original edge ID. No holes or topology-changing anchor insert/delete editor yet.

A panel may include `"layout_2d": [x, y]`, the board location of its local material origin in meters, and `"layout_rotation_degrees": 30.0`, the board rotation (clockwise in its downward-positive screen coordinates). Display uses `origin + rotation(local_uv)`. Both fields are presentation metadata, excluded from physical signatures; neither changes material rest geometry or grain. Omitted layout is arranged deterministically beside preceding pieces. The angle defaults to zero, must be finite, and is omitted at zero to preserve historical state-cache signatures. Old files omit these fields and remain valid. New files with these extensions require this editor version; older strict readers may reject unknown fields.
