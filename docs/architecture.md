# Architecture et invariants

Le dépôt reste un package Rust et trois exécutables. Les modules numériques CPU n'importent ni eframe ni wgpu. La feature `desktop` ajoute le renderer, le backend compute `gpu_vbd` et les interfaces ; elle peut être désactivée pour compiler uniquement le noyau CPU.

## Chemin des données

```text
GarmentTemplate JSON
  fabric properties + panels (rest geometry / grain / placement) + seam graph
       | compile(): validation, triangulation, material binding, seam quadrature
       v
CompiledGarment = Mesh + materials + vertex material IDs + seams + panel ranges
       | initial_state.clone()
       v
ReferenceSolver::step_garment() -> State + Metrics
       |                          |
       +-- OBJ / fiber frames ----+-- material-space attachments

Project JSON v1 -> Pattern::build() -> ReferenceSolver::step()
                                      |
                          same private Newton/PCG implementation
```

L'éditeur historique utilise `Project`, un panneau. `cloth-fit` utilise `FittingProject` : template multi-panneaux, avatar, réglages et cache de positions signé. La CLI et l'interface consomment le même `FittingScene`, sans dupliquer le solveur.

Le chemin courant de `cloth-fit` passe par `VbdSolver` + `OgcWorld`, ou `GpuVbd::step` avec la même topologie OGC et les mêmes énergies. Le diagramme Newton ci-dessus reste celui du backend `--reference`. Le worker d’atelier reçoit un numéro de génération : un résultat calculé sur un ancien maillage ne remplace jamais la scène courante. Il possède l’état physique et son horloge à pas fixe, indépendamment du rafraîchissement egui. Un seul snapshot de sortie est conservé ; les mises à jour de contrôle ne réinjectent jamais l’ancien état affiché. Les ressources GPU et termes matériels sont réutilisés, et le cache des candidats OGC ne remplace jamais le recalcul des distances et bornes. Voir [Turbo](turbo-perf.md).

## Responsabilités

| Module | Rôle | Entrées / sorties |
|---|---|---|
| `authoring.rs` | Commandes transactionnelles, historique et placements rigides | template + commande → template validé + modèle compilé |
| `authoring/clipboard.rs`, `atelier/selection.rs`, `atelier/radial.rs` | Presse-papiers sémantique, sélection transitoire et menu d'outils | panneaux/bords stables → commandes ; aucun indice de maillage persistant |
| `fabrics.rs`, `atelier/fabrics_ui.rs` | Presets documentés, conversion stretch sous charge et contrôles | propriétés SI → compilation par `Command::Fabric`, sans modifier le repos |
| `atelier/authoring_ui.rs`, `atelier/gizmo.rs` | Dessin, choix des coutures, sélection et gizmos | interactions → commandes ; aperçu sans remeshing par frame |
| `model.rs` | Géométrie de repos rectangulaire et maillage FEM | `Pattern` → `Mesh`, masse, charnières |
| `garment/template.rs` | Modèle d'édition, validation, compilation | `GarmentTemplate` → `CompiledGarment` |
| `garment/polygon.rs`, `garment/meshing.rs` | Contours validés, Delaunay contrainte et métrique | points/bords → UV et triangles, contrôle qualité |
| `garment/markings.rs` | Marge de couture et crans, ligne de coupe jointe | brouillon (mètres) → contour de coupe, jamais le maillage |
| `garment/seam.rs` | Correspondance de bords et énergie de raccord | longueurs au repos → quadrature, éléments |
| `garment/embedding.rs` | Attachements géométriques en coordonnées du patron | `MaterialPath` → barycentriques temporaires |
| `garment/export.rs` | Artefacts CPU sans état d'interface | OBJ par panneau, SVG, feuille à l'échelle, directions de fibres |
| `math.rs`, `energy.rs` | AD d'ordre 2, membrane et flexion | géométrie actuelle + repos → énergie/dérivées |
| `contact.rs` | Pénalité sommets/sphère | contact discret, épaisseur par sommet |
| `avatar.rs` | OBJ, BVH statique et distance locale signée | mannequin → implémentation du trait Collider |
| `fitting.rs` | Arrangement, cache et pas transactionnels | FittingProject → FittingScene |
| `solver.rs` | Euler implicite, Newton/PCG, Armijo | modèle compilé + état → état/métriques |
| `project.rs` | Ancien format de scène à un panneau | `Project` JSON v1 |
| `bin/cloth-template.rs` | CLI sans fenêtre | example / validate / bake / simulate |
| `editor.rs`, `render.rs` | Interface et affichage | restent consommateurs du modèle CPU |
| `ogc/` | Régions admissibles, VF/EE, barrières et bornes | topologie + positions → contacts + rayons conservatifs |
| `vbd.rs` | Euler implicite par blocs de sommets, coloration avec contacts | mêmes énergies FEM/coutures, référence f64 |
| `vbd/prediction.rs` | Initialisation adaptative CPU/GPU, historique de pas acceptés | vitesses/accélération précédente → estimation initiale, cible inertielle inchangée |
| `vbd/coloring.rs` | Coloration gloutonne déterministe depuis les incidences existantes | graphe matériel + contacts, même ordre de couleurs/sommets, pas de second graphe dynamique |
| `garment/diagnostics.rs` | Mesure d'allongement indépendante du rendu | repos matériel + état → percentile par aire et maximum |
| `gpu_vbd.rs`, `vbd.wgsl` | Solve local f32, gradients exacts, Hessiennes positives approchées | candidats/bornes CPU → compute GPU → état validé |
| `picking.rs` | Rayons et attachement barycentrique | souris → force de saisie, sans téléportation |
| `bin/cloth-fit.rs`, `atelier.rs`, `gpu_bench.rs` | CLI, atelier et mesure du rendu | projets / rapports / captures opt-in |

## Contrats à préserver

**Repos.** `Mesh.uv` est local au panneau et exprimé en mètres, sans atlas ni normalisation [0,1]. `Triangle.rest`, `inv_dm` et `area` dérivent uniquement du patron. Les placements rigides n'affectent ni ces données ni les masses.

**Matières.** Le template sépare `FabricProperties` et `Panel.grain_degrees`. La compilation crée un `Material` orienté par panneau. Triangles et charnières référencent ce matériau ; `vertex_material` fournit l'épaisseur aux contacts. La densité est déjà intégrée dans la masse : reconstruire le modèle quand elle change, ne pas modifier seulement le tableau de matériaux compilés.

**Topologie.** Les panneaux conservent des sommets distincts aux coutures. Les plages de sommets/triangles identifient chaque panneau. Le compilateur refuse les coutures qui possèdent des intervalles chevauchants du même bord ; un coin commun reste possible. Le support de coutures multicouches exigera un modèle de relation plus riche.

**Référence Newton.** Ses deux API entrent dans le même `Problem` privé. Matériaux, inertie, gravité, damping, contacts et coutures sont assemblés ensemble. Les contraintes fixées éliminent les DOF correspondants. Les erreurs conservent l'état précédent ; atteindre le budget d'itérations produit un état avec `converged=false`. Les métriques de couture sont ajoutées, pas substituées aux résidus.

**VBD/OGC.** Les mêmes énergies sont minimisées par blocs de sommets. La coloration inclut toutes les dépendances des éléments, contacts et saisies. Les centres des bornes ne changent qu'à une nouvelle détection ; les propositions locales sont tronquées puis contrôlées énergétiquement. Le backend GPU f32 vérifie les résultats et les bornes avant de modifier `State`. Le budget fixe ne signifie pas convergence. Les réglages VBD de la CLI sont enregistrés dans `run.json` ; `FittingProject.solver` conserve les réglages du Newton historique.

L'initialisation adaptative conserve un historique de l'état accepté dans `VbdSolver`, partagé par les chemins CPU/GPU. Il n'appartient pas aux fichiers d'édition ; une reconstruction ou un état extérieur différent l'invalide. L'accélération corrigée de l'amortissement choisit seulement le point de départ du solveur ; la gravité reste entière dans l'objectif. Voir [le diagnostic de fausse élasticité](adaptive-initialization.md). Le budget par défaut est 16 itérations depuis cette correction.

**Attachements.** `MaterialPath` garde un ID de panneau et des points 2D. `embed_path` scinde les segments aux traversées de triangles avant interpolation barycentrique : un guide suit donc un pli au lieu de traverser l'espace entre ses extrémités. Les `EmbeddedPoint` sont des caches à reconstruire après remeshing ; ils ne détectent pas automatiquement un autre maillage de même taille. La recherche actuelle parcourt les triangles, adaptée aux petits patrons ; un index spatial pourra la remplacer.

**Unités.** Longueurs m, masse kg, temps s, force N, énergie J, densité kg/m², membrane N/m, flexion N·m, coefficient de couture N/m². Les guides chaîne/trame ne sont pas un modèle de fils explicites.

## Évolutions localisées

Depuis la [correction du jitter](jitter.md), `ContactSet.contacts` contient aussi les interactions admissibles proches dont l'énergie est encore nulle : la distance d'activation reste `r`, la sélection va jusqu'à `rq`. Coloration et incidence incluent ces termes dormants. `active_contacts` / `VbdMetrics.contacts` indiquent ceux d'énergie positive à la détection ; `contact_terms` donne le coût en termes retenus. Les identifiants canoniques sont triés/dédupliqués avant la coloration. Le GPU travaille dans un repère translaté, rétabli à la lecture ; l'état et les contacts CPU restent mondiaux en f64. Ne pas oublier ce changement de repère pour une nouvelle cible ou un diagnostic GPU.

1. Étendre les trous actuels à segments droits aux contours Bézier, puis ajouter une métrique de résolution spatiale.
2. Transférer l'état lors d'un remeshing dynamique ; aujourd'hui le remeshing explicite reconstruit l'arrangement initial.
3. Étendre l’édition actuelle (points/poignées Bézier, coutures 2D/3D, gizmos, historique) à l’édition dédiée des points de trous, aux déplacements numériques des points et aux coutures partielles.
4. Porter la détection OGC VF/EE sur GPU, ajouter friction et traitement dédié des coutures. Une couture n'autorise pas à exclure toutes les collisions entre panneaux cousus. Les bornes OGC préservent un état séparé ; elles ne sont pas une réparation d'intersections initiales.
5. Faire évoluer les lois constitutives à partir de mesures ou d'homogénéisation. Conserver les coordonnées matérielles et tests d'objectivité. Ne pas inventer une calibration.

L’objectif d’évolution des backends et leur protocole de comparaison sont décrits dans [solver-challenge.md](solver-challenge.md). Aucun trait commun ni ABI de plugin de solveur n’est encore implémenté.

## Unified authoring board

The CPU drafting extension is documented in [drafting-tools.md](drafting-tools.md). `garment/domain.rs` adds optional hole contours and internal material paths; `shapes.rs` supplies primitives/mirrors/booleans, while `authoring/geometry.rs` migrates semantic references transactionally. Internal paths are CDT constraints with material on both sides, exposed as named chains to the existing seam compiler. No solver-specific drawing or new GPU seam representation is required. `atelier/drafting_ui.rs` only adapts these operations to controls.

The board in `atelier/board.rs` shares selection (`panel` + named edge) with `atelier/edges_3d.rs`. It has one metric camera and persistent per-panel `layout_2d` / `layout_rotation_degrees` metadata. Board positions are `origin + rotation(local_uv)`. Layout does not modify material UV, placement, grain, masses or cache signatures. Shape edits inverse-rotate pointer coordinates into local anchors and controls; moving the local origin compensates both rotated 2D layout and 3D placement so untouched geometry stays fixed. `Command::BoardTransform` commits translation and angle atomically. The zero angle is omitted from serialization to preserve old physical hashes.

`atelier/workspace.rs` owns visual styling, the piece browser and format information. `atelier/seam_links.rs` draws sparse correspondence guides in either view. `CompiledSeam.guides` contains nine transient pairs of weighted boundary attachments derived during compilation from the same range/reversal/notch map as the physical seam. They do not enter energies, contacts or saved documents. Default overlays use three guides per seam, expanding the active pair to nine; dash counts are bounded for distant pieces.

The 2D board uses indexed vertices instead of duplicating every triangle corner. Boundary projection reuses one camera matrix per pass. Avatar visibility queries reuse `MeshCollider`'s static BVH and the existing two-sided triangle predicate; inclusive, padded slabs handle silhouettes and parallel rays. This is a picking optimization, not an OGC collision change. CPU equivalence tests and the standalone `picking_probe` benchmark cover it.

`garment/curves.rs` subdivides cubic controls with a fixed 0.25 mm geometric error bound, independent of triangulation density. `polygon.rs` validates that sampled contour and joins its temporary subsegments back into the original named boundary chain. Thus sewing quadrature still uses rest arclength on one semantic edge. `serde_json/float_roundtrip` preserves exact input floats on reload; small parsing changes can otherwise alter Delaunay decisions. The legacy template formats remain readable through optional serde fields.

## Point tools and view controls (Firefly integration)

See [integration provenance and fixes](firefly-integration.md). Polygon `target_lengths` is optional nonphysical metadata, omitted when empty and excluded from fitting cache signatures as well as `same_physics`. An explicit target command may change rest geometry; loading never enforces a stored target. Contour splits preserve cubics by de Casteljau subdivision and reject referenced seams/targets rather than migrating them implicitly. Existing holes and internal lines continue through the same domain mesher.

Board view rotation is radians; panel layout rotation remains degrees. Pointer and nudge adapters convert explicitly. Multi-point movement translates attached controls and invalidates transient selections when contour identity/order changes. Camera presets and orthographic projection share the same matrix with picking. Preferences separate immediately applied theme/snap from next-launch simulation/overlay defaults. The worker and physical solver paths are unchanged.

## Document and sewing extensions (16 October 2026)

`document.rs` owns portable avatar assets and atomic document replacement. `atelier/documents_ui.rs` handles dialogs, dirty state and recovery. `SeamSpec` keeps legacy A/B first segments plus optional ordered tails; `BoundaryRef.reversed` controls each trimmed segment. Cumulative arclength paths compile into the same quadrature/energy API, including both sides of discontinuous joints. Authoring, clipboard, mirrors, ownership checks and export traverse all references. See [contracts and limits](documents-and-sewing.md).
