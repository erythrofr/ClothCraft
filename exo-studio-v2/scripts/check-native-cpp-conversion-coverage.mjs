#!/usr/bin/env node
// Reproducible source inventory. An implementation is never counted as parity
// unless its JS export, native symbol and executable parity check all exist.
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, resolve, relative } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = resolve(import.meta.dirname, '..')
const file = name => join(root, name)
const load = name => readFileSync(file(name), 'utf8')
const args = new Set(process.argv.slice(2))
const groups = [
  ['grading', 'src/core/grading.js', 'gradeProject', 'native_cpp/core/grading.hpp', 'gradeProject', 'scripts/check-native-cpp-grading.mjs'],
  ['size run', 'src/core/grading.js', 'buildSizeRun', 'native_cpp/core/grading.hpp', 'gradeSizeRun', 'scripts/check-native-cpp-grading.mjs'],
  ['fabric markers', 'src/core/marker.js', 'buildFabricMarkers', 'native_cpp/core/marker_layout.hpp', 'buildFabricMarkers', 'scripts/check-native-cpp-marker.mjs'],
  ['production preflight', 'src/core/productionPreflight.js', 'inspectProduction', 'native_cpp/core/production_preflight.hpp', 'inspectProduction', 'scripts/check-native-cpp-preflight.mjs'],
  ['fabric cost', 'src/core/productionCost.js', 'buildFabricCostRun', 'native_cpp/core/fabric_cost.hpp', 'buildFabricCostRun', 'scripts/check-native-cpp-fabric-cost.mjs'],
  ['fabric cost CSV', 'src/core/productionCost.js', 'fabricCostRunToCsv', 'native_cpp/core/fabric_cost.hpp', 'fabricCostRunToCsv', 'scripts/check-native-cpp-fabric-cost.mjs'],
  ['BOM XML', 'src/core/bomXml.js', 'projectToBomXml', 'native_cpp/core/bom_export.hpp', 'exportBomXml', 'scripts/check-native-cpp-bom.mjs'],
  ['DXF export', 'src/core/dxf.js', 'projectToDxf', 'native_cpp/core/dxf_export.hpp', 'exportCuttingDxf', 'scripts/check-native-cpp-cad.mjs'],
  ['DXF import', 'src/core/dxf.js', 'parseDxfPatterns', 'native_cpp/core/dxf_import.hpp', 'importDxfPatterns', 'scripts/check-native-cpp-dxf-import.mjs'],
  ['marker SVG', 'src/core/markerArtifacts.js', 'markerToSvg', 'native_cpp/core/marker_svg.hpp', 'markerToSvg', 'scripts/check-native-cpp-marker-svg.mjs'],
  ['marker PDF', 'src/core/markerArtifacts.js', 'markerToPdf', 'native_cpp/core/marker_pdf.hpp', 'markerToPdf', 'scripts/check-native-cpp-marker-pdf.mjs'],
  ['factory package', 'src/core/factoryPackage.js', 'buildFactoryPackageZip', 'native_cpp/core/factory_zip.hpp', 'buildNativeFactoryZip', 'scripts/check-native-cpp-factory-zip.mjs'],
  ['drafting precision assertDraftCoordinate', 'src/core/draftingPrecision.js', 'assertDraftCoordinate', 'native_cpp/core/drafting_precision.hpp', 'assertDraftCoordinate', 'scripts/check-native-cpp-drafting-precision.mjs'],
  ['drafting precision pointFromPolar', 'src/core/draftingPrecision.js', 'pointFromPolar', 'native_cpp/core/drafting_precision.hpp', 'pointFromPolar', 'scripts/check-native-cpp-drafting-precision.mjs'],
  ['drafting precision polarFromPoints', 'src/core/draftingPrecision.js', 'polarFromPoints', 'native_cpp/core/drafting_precision.hpp', 'polarFromPoints', 'scripts/check-native-cpp-drafting-precision.mjs'],
  ['drafting precision precisePointEdit', 'src/core/draftingPrecision.js', 'precisePointEdit', 'native_cpp/core/drafting_precision.hpp', 'precisePointEdit', 'scripts/check-native-cpp-drafting-precision.mjs'],
  ['drafting precision curveChordCoordinates', 'src/core/draftingPrecision.js', 'curveChordCoordinates', 'native_cpp/core/drafting_precision.hpp', 'curveChordCoordinates', 'scripts/check-native-cpp-drafting-precision.mjs'],
  ['drafting precision preciseCurveEdit', 'src/core/draftingPrecision.js', 'preciseCurveEdit', 'native_cpp/core/drafting_precision.hpp', 'preciseCurveEdit', 'scripts/check-native-cpp-drafting-precision.mjs'],
  ['drafting precision quadraticAt', 'src/core/draftingPrecision.js', 'quadraticAt', 'native_cpp/core/drafting_precision.hpp', 'quadraticAt', 'scripts/check-native-cpp-drafting-precision.mjs'],
  ['drafting precision quadraticDerivative', 'src/core/draftingPrecision.js', 'quadraticDerivative', 'native_cpp/core/drafting_precision.hpp', 'quadraticDerivative', 'scripts/check-native-cpp-drafting-precision.mjs'],
  ['drafting precision quadraticArcLength', 'src/core/draftingPrecision.js', 'quadraticArcLength', 'native_cpp/core/drafting_precision.hpp', 'quadraticArcLength', 'scripts/check-native-cpp-drafting-precision.mjs'],
  ['drafting precision quadraticAtLengthFraction', 'src/core/draftingPrecision.js', 'quadraticAtLengthFraction', 'native_cpp/core/drafting_precision.hpp', 'quadraticAtLengthFraction', 'scripts/check-native-cpp-drafting-precision.mjs'],
  ['draftingSnapping snapDraftGrid', 'src/core/draftingSnapping.js', 'snapDraftGrid', 'native_cpp/core/drafting_snapping.hpp', 'snapDraftGrid', 'scripts/check-native-cpp-drafting-snapping.mjs'],
  ['draftingSnapping nearestOnDraftSegment', 'src/core/draftingSnapping.js', 'nearestOnDraftSegment', 'native_cpp/core/drafting_snapping.hpp', 'nearestOnDraftSegment', 'scripts/check-native-cpp-drafting-snapping.mjs'],
  ['draftingSnapping snapDraftPattern', 'src/core/draftingSnapping.js', 'snapDraftPattern', 'native_cpp/core/drafting_snapping.hpp', 'snapDraftPattern', 'scripts/check-native-cpp-drafting-snapping.mjs'],
  ['draftingSnapping constrainDraftAxis', 'src/core/draftingSnapping.js', 'constrainDraftAxis', 'native_cpp/core/drafting_snapping.hpp', 'constrainDraftAxis', 'scripts/check-native-cpp-drafting-snapping.mjs'],
  ['autoFitPlacement constrainAutoFitPlacement', 'src/core/autoFitPlacement.js', 'constrainAutoFitPlacement', 'native_cpp/core/auto_fit_placement.hpp', 'constrainAutoFitPlacement', 'scripts/check-native-cpp-auto-fit-placement.mjs'],
  ['autoFitPlacement applyAutoFitPlacement', 'src/core/autoFitPlacement.js', 'applyAutoFitPlacement', 'native_cpp/core/auto_fit_placement.hpp', 'applyAutoFitPlacement', 'scripts/check-native-cpp-auto-fit-placement.mjs'],
  ['draftingConstructions constructionReferencePoint', 'src/core/draftingConstructions.js', 'constructionReferencePoint', 'native_cpp/core/drafting_constructions.hpp', 'constructionReferencePoint', 'scripts/check-native-cpp-drafting-constructions.mjs'],
  ['draftingConstructions lineIntersection', 'src/core/draftingConstructions.js', 'lineIntersection', 'native_cpp/core/drafting_constructions.hpp', 'lineIntersection', 'scripts/check-native-cpp-drafting-constructions.mjs'],
  ['draftingConstructions projectOntoLine', 'src/core/draftingConstructions.js', 'projectOntoLine', 'native_cpp/core/drafting_constructions.hpp', 'projectOntoLine', 'scripts/check-native-cpp-drafting-constructions.mjs'],
  ['draftingConstructions pointAlongLine', 'src/core/draftingConstructions.js', 'pointAlongLine', 'native_cpp/core/drafting_constructions.hpp', 'pointAlongLine', 'scripts/check-native-cpp-drafting-constructions.mjs'],
  ['draftingConstructions mirrorPointAcrossLine', 'src/core/draftingConstructions.js', 'mirrorPointAcrossLine', 'native_cpp/core/drafting_constructions.hpp', 'mirrorPointAcrossLine', 'scripts/check-native-cpp-drafting-constructions.mjs'],
  ['draftingConstructions preciseConstructionEdit', 'src/core/draftingConstructions.js', 'preciseConstructionEdit', 'native_cpp/core/drafting_constructions.hpp', 'preciseConstructionEdit', 'scripts/check-native-cpp-drafting-constructions.mjs'],
  ['draftingConstructions DRAFT_CONSTRUCTION_MODES', 'src/core/draftingConstructions.js', 'DRAFT_CONSTRUCTION_MODES', 'native_cpp/core/drafting_constructions.hpp', 'draftConstructionModes', 'scripts/check-native-cpp-drafting-constructions.mjs'],
  ['draftingSplit SPLIT_MODES', 'src/core/draftingSplit.js', 'SPLIT_MODES', 'native_cpp/core/drafting_split.hpp', 'draftingSplitModes', 'scripts/check-native-cpp-drafting-split.mjs'],
  ['draftingSplit draftingSplitFractions', 'src/core/draftingSplit.js', 'draftingSplitFractions', 'native_cpp/core/drafting_split.hpp', 'draftingSplitFractions', 'scripts/check-native-cpp-drafting-split.mjs'],
  ['draftingSplit splitParameterAtArcFraction', 'src/core/draftingSplit.js', 'splitParameterAtArcFraction', 'native_cpp/core/drafting_split.hpp', 'splitParameterAtArcFraction', 'scripts/check-native-cpp-drafting-split.mjs'],
  ['meshSelection mergeMeshFaceSelection', 'src/core/meshSelection.js', 'mergeMeshFaceSelection', 'native_cpp/core/mesh_selection.hpp', 'mergeMeshFaceSelection', 'scripts/check-native-cpp-mesh-selection.mjs'],
  ['draftingTopology inspectDraftTopology', 'src/core/draftingTopology.js', 'inspectDraftTopology', 'native_cpp/core/drafting_topology.hpp', 'inspectDraftTopology', 'scripts/check-native-cpp-topology-cli.mjs'],
  ['draftingTopology isDraftEditValid', 'src/core/draftingTopology.js', 'isDraftEditValid', 'native_cpp/core/drafting_topology.hpp', 'isDraftEditValid', 'scripts/check-native-cpp-topology-cli.mjs'],
  ['draftingUnfold unfoldDraftPiece', 'src/core/draftingUnfold.js', 'unfoldDraftPiece', 'native_cpp/core/drafting_unfold.hpp', 'unfoldDraftPiece', 'scripts/check-native-cpp-topology-cli.mjs'],
  ['clothMeshing simplifiedClothBoundary', 'src/core/clothMeshing.js', 'simplifiedClothBoundary', 'native_cpp/core/cloth_meshing.hpp', 'simplifiedClothBoundary', 'scripts/check-native-cpp-cloth-meshing.mjs'],
  ['clothMeshing measureClothBoundaryDeviation', 'src/core/clothMeshing.js', 'measureClothBoundaryDeviation', 'native_cpp/core/cloth_meshing.hpp', 'measureClothBoundaryDeviation', 'scripts/check-native-cpp-cloth-meshing.mjs'],
  ['trims offsetEdgePath', 'src/core/trims.js', 'offsetEdgePath', 'native_cpp/core/trims.hpp', 'offsetEdgePath', 'scripts/check-native-cpp-trims.mjs'],
  ['trims topstitchPaths', 'src/core/trims.js', 'topstitchPaths', 'native_cpp/core/trims.hpp', 'topstitchPaths', 'scripts/check-native-cpp-trims.mjs'],
  ['trims zipperPaths', 'src/core/trims.js', 'zipperPaths', 'native_cpp/core/trims.hpp', 'zipperPaths', 'scripts/check-native-cpp-trims.mjs'],
  ['trims pieceCenter', 'src/core/trims.js', 'pieceCenter', 'native_cpp/core/trims.hpp', 'pieceCenter', 'scripts/check-native-cpp-trims.mjs'],
  ['trims trimSummary', 'src/core/trims.js', 'trimSummary', 'native_cpp/core/trims.hpp', 'trimSummary', 'scripts/check-native-cpp-trims.mjs'],
  ['sewingConstruction seamEndpointInterval', 'src/core/sewingConstruction.js', 'seamEndpointInterval', 'native_cpp/core/sewing_construction.hpp', 'seamEndpointInterval', 'scripts/check-native-cpp-sewing-construction.mjs'],
  ['sewingConstruction seamEndpointOverlap', 'src/core/sewingConstruction.js', 'seamEndpointOverlap', 'native_cpp/core/sewing_construction.hpp', 'seamEndpointOverlap', 'scripts/check-native-cpp-sewing-construction.mjs'],
  ['sewingConstruction validateNewSeam', 'src/core/sewingConstruction.js', 'validateNewSeam', 'native_cpp/core/sewing_construction.hpp', 'validateNewSeam', 'scripts/check-native-cpp-sewing-construction.mjs'],
  ['sewingConstruction auditSewingConstruction', 'src/core/sewingConstruction.js', 'auditSewingConstruction', 'native_cpp/core/sewing_construction.hpp', 'auditSewingConstruction', 'scripts/check-native-cpp-sewing-construction.mjs'],
  ['physics assessSimulationFit', 'src/core/physics/qualityGate.js', 'assessSimulationFit', 'native_cpp/core/simulation_quality.hpp', 'assessSimulationFit', 'scripts/check-native-cpp-simulation-quality.mjs'],
  ['physics inspectClothMesh', 'src/core/physics/meshQuality.js', 'inspectClothMesh', 'native_cpp/core/simulation_quality.hpp', 'inspectClothMesh', 'scripts/check-native-cpp-simulation-quality.mjs'],
  ['physics resolveSolverTimestep', 'src/core/physics/timestep.js', 'resolveSolverTimestep', 'native_cpp/core/simulation_quality.hpp', 'resolveSolverTimestep', 'scripts/check-native-cpp-simulation-quality.mjs'],
  ['simulation protocol buildSimulationRequest', 'src/core/backends/protocol.js', 'buildSimulationRequest', 'native_cpp/core/simulation_protocol.hpp', 'buildSimulationRequest', 'scripts/check-native-cpp-simulation-protocol.mjs'],
  ['simulation protocol validateSimulationRequest', 'src/core/backends/protocol.js', 'validateSimulationRequest', 'native_cpp/core/simulation_protocol.hpp', 'validateSimulationRequest', 'scripts/check-native-cpp-simulation-protocol.mjs'],
  ['simulation protocol serializeSimulationRequest', 'src/core/backends/protocol.js', 'serializeSimulationRequest', 'native_cpp/core/simulation_protocol.hpp', 'serializeSimulationRequest', 'scripts/check-native-cpp-simulation-protocol.mjs'],
  ['simulation protocol backendResultSummary', 'src/core/backends/protocol.js', 'backendResultSummary', 'native_cpp/core/simulation_protocol.hpp', 'backendResultSummary', 'scripts/check-native-cpp-simulation-protocol.mjs'],
  ['fabric optics normalizeFabricOptics', 'src/core/fabricSurfaceModel.js', 'normalizeFabricOptics', 'native_cpp/core/fabric_surface.hpp', 'normalizeFabricOptics', 'scripts/check-native-cpp-fabric-surface.mjs'],
  ['fabric optics textileAlbedoMultiplier', 'src/core/fabricSurfaceModel.js', 'textileAlbedoMultiplier', 'native_cpp/core/fabric_surface.hpp', 'textileAlbedoMultiplier', 'scripts/check-native-cpp-fabric-surface.mjs'],
  ['fabric PBR filename classifyFabricPbrFilename', 'src/core/fabricPbrFileNaming.js', 'classifyFabricPbrFilename', 'native_cpp/core/fabric_surface.hpp', 'classifyFabricPbrFilename', 'scripts/check-native-cpp-fabric-surface.mjs'],
  ['measurements measureProject', 'src/core/measurements.js', 'measureProject', 'native_cpp/core/measurement_export.hpp', 'measureProject', 'scripts/check-native-cpp-measurements.mjs'],
  ['measurements buildMeasurementSizeRun', 'src/core/measurements.js', 'buildMeasurementSizeRun', 'native_cpp/core/measurement_export.hpp', 'buildMeasurementSizeRun', 'scripts/check-native-cpp-measurements.mjs'],
  ['measurements measurementRunToCSV', 'src/core/measurements.js', 'measurementRunToCSV', 'native_cpp/core/measurement_export.hpp', 'measurementRunToCsv', 'scripts/check-native-cpp-measurements.mjs'],
  ['measurements buildTechPack', 'src/core/measurements.js', 'buildTechPack', 'native_cpp/core/tech_pack_export.hpp', 'buildTechPack', 'scripts/check-native-cpp-tech-pack.mjs'],
  ['project geometry polygonArea', 'src/core/project.js', 'polygonArea', 'native_cpp/core/project_geometry.hpp', 'polygonArea', 'scripts/check-native-cpp-project-geometry.mjs'],
  ['project geometry sampleEdge', 'src/core/project.js', 'sampleEdge', 'native_cpp/core/project_geometry.hpp', 'sampleEdge', 'scripts/check-native-cpp-project-geometry.mjs'],
  ['project geometry samplePieceBoundary', 'src/core/project.js', 'samplePieceBoundary', 'native_cpp/core/project_geometry.hpp', 'samplePieceBoundary', 'scripts/check-native-cpp-project-geometry.mjs'],
  ['project geometry getEdgeSeamAllowance', 'src/core/project.js', 'getEdgeSeamAllowance', 'native_cpp/core/project_geometry.hpp', 'getEdgeSeamAllowance', 'scripts/check-native-cpp-project-geometry.mjs'],
  ['project geometry seamAllowanceBoundary', 'src/core/project.js', 'seamAllowanceBoundary', 'native_cpp/core/project_geometry.hpp', 'seamAllowanceBoundary', 'scripts/check-native-cpp-project-geometry.mjs'],
  ['project geometry pieceArea', 'src/core/project.js', 'pieceArea', 'native_cpp/core/project_geometry.hpp', 'pieceArea', 'scripts/check-native-cpp-project-geometry.mjs'],
  ['project geometry projectArea', 'src/core/project.js', 'projectArea', 'native_cpp/core/project_geometry.hpp', 'projectArea', 'scripts/check-native-cpp-project-geometry.mjs'],
  ['project geometry edgeLength', 'src/core/project.js', 'edgeLength', 'native_cpp/core/project_geometry.hpp', 'edgeLength', 'scripts/check-native-cpp-project-geometry.mjs'],
  ['project geometry edgeRangeLength', 'src/core/project.js', 'edgeRangeLength', 'native_cpp/core/project_geometry.hpp', 'edgeRangeLength', 'scripts/check-native-cpp-project-geometry.mjs'],
  ['project geometry edgePointAt', 'src/core/project.js', 'edgePointAt', 'native_cpp/core/project_geometry.hpp', 'edgePointAt', 'scripts/check-native-cpp-project-geometry.mjs'],
  ['project geometry facingGeometryForEdge', 'src/core/project.js', 'facingGeometryForEdge', 'native_cpp/core/project_geometry.hpp', 'facingGeometryForEdge', 'scripts/check-native-cpp-project-geometry.mjs'],
  ['project geometry closestEdgeFraction', 'src/core/project.js', 'closestEdgeFraction', 'native_cpp/core/project_geometry.hpp', 'closestEdgeFraction', 'scripts/check-native-cpp-project-geometry.mjs'],
  ['project geometry seamLengthReport', 'src/core/project.js', 'seamLengthReport', 'native_cpp/core/project_geometry.hpp', 'seamLengthReport', 'scripts/check-native-cpp-project-geometry.mjs'],
  ['project geometry seamWalkReport', 'src/core/project.js', 'seamWalkReport', 'native_cpp/core/project_geometry.hpp', 'seamWalkReport', 'scripts/check-native-cpp-project-geometry.mjs'],
  ['live drape captureDrape', 'src/core/liveDrapeTransfer.js', 'captureDrape', 'native_cpp/core/live_drape_transfer.hpp', 'captureDrape', 'scripts/check-native-cpp-live-drape-transfer.mjs'],
  ['live drape transferDrape', 'src/core/liveDrapeTransfer.js', 'transferDrape', 'native_cpp/core/live_drape_transfer.hpp', 'transferDrape', 'scripts/check-native-cpp-live-drape-transfer.mjs'],
  ['live drape measureSeamGap', 'src/core/liveDrapeTransfer.js', 'measureSeamGap', 'native_cpp/core/live_drape_transfer.hpp', 'measureSeamGap', 'scripts/check-native-cpp-live-drape-transfer.mjs'],
  ['live drape captureParticlePositions', 'src/core/liveDrapeTransfer.js', 'captureParticlePositions', 'native_cpp/core/live_drape_transfer.hpp', 'captureParticlePositions', 'scripts/check-native-cpp-live-drape-transfer.mjs'],
  ['live drape restoreParticlePositions', 'src/core/liveDrapeTransfer.js', 'restoreParticlePositions', 'native_cpp/core/live_drape_transfer.hpp', 'restoreParticlePositions', 'scripts/check-native-cpp-live-drape-transfer.mjs'],
  ['physics optimizeTriangleQuality', 'src/core/physics/qualityTriangulation.js', 'optimizeTriangleQuality', 'native_cpp/core/quality_triangulation.hpp', 'optimizeTriangleQuality', 'scripts/check-native-cpp-quality-triangulation.mjs'],
  ['physics resolveSelfCollisions', 'src/core/physics/selfCollision.js', 'resolveSelfCollisions', 'native_cpp/core/self_collision.hpp', 'resolveSelfCollisions', 'scripts/check-native-cpp-self-collision.mjs'],
  ['physics avatarContactParameters', 'src/core/physics/avatarContactPass.js', 'avatarContactParameters', 'native_cpp/core/avatar_contact_pass.hpp', 'avatarContactParameters', 'scripts/check-native-cpp-avatar-contact-pass.mjs'],
  ['physics projectAvatarContacts', 'src/core/physics/avatarContactPass.js', 'projectAvatarContacts', 'native_cpp/core/avatar_contact_pass.hpp', 'projectAvatarContacts', 'scripts/check-native-cpp-avatar-contact-pass.mjs'],
  ['staging stagedPanelPositions', 'src/core/staging.js', 'stagedPanelPositions', 'native_cpp/core/staging_geometry.hpp', 'stagedPanelPositions', 'scripts/check-native-cpp-staging-geometry.mjs'],
  ['staging setStagedGeometry', 'src/core/staging.js', 'setStagedGeometry', 'native_cpp/core/staging_geometry.hpp', 'setStagedGeometry', 'scripts/check-native-cpp-staging-geometry.mjs'],
  ['native quality resolveNativeQuality', 'src/core/backends/nativePayload.js', 'resolveNativeQuality', 'native_cpp/core/native_payload.hpp', 'resolveNativeQuality', 'scripts/check-native-cpp-native-payload.mjs'],
  ['native payload nativePayloadSummary', 'src/core/backends/nativePayload.js', 'nativePayloadSummary', 'native_cpp/core/native_payload.hpp', 'nativePayloadSummary', 'scripts/check-native-cpp-native-payload.mjs'],
  ['Seamly parseSeamlyMeasurements', 'src/core/seamlyMeasurements.js', 'parseSeamlyMeasurements', 'native_cpp/core/seamly_import.hpp', 'parseSeamlyMeasurements', 'scripts/check-native-cpp-seamly-import.mjs'],
  ['Seamly applySeamlyMeasurements', 'src/core/seamlyMeasurements.js', 'applySeamlyMeasurements', 'native_cpp/core/seamly_import.hpp', 'applySeamlyMeasurements', 'scripts/check-native-cpp-seamly-import.mjs'],
  ['Seamly parseSeamlyConstructionReference', 'src/core/seamlyConstructionReference.js', 'parseSeamlyConstructionReference', 'native_cpp/core/seamly_import.hpp', 'parseSeamlyConstructionReference', 'scripts/check-native-cpp-seamly-import.mjs'],
  ['GarmentCode projectToGarmentCode', 'src/core/garmentCode.js', 'projectToGarmentCode', 'native_cpp/core/garment_code.hpp', 'projectToGarmentCode', 'scripts/check-native-cpp-garment-code.mjs'],
  ['GarmentCode garmentCodeToProject', 'src/core/garmentCode.js', 'garmentCodeToProject', 'native_cpp/core/garment_code.hpp', 'garmentCodeToProject', 'scripts/check-native-cpp-garment-code.mjs'],
  ['GarmentCode garmentCodeRoundTripSummary', 'src/core/garmentCode.js', 'garmentCodeRoundTripSummary', 'native_cpp/core/garment_code.hpp', 'garmentCodeRoundTripSummary', 'scripts/check-native-cpp-garment-code.mjs'],
  ['mesh avatar selectAvatarBodyMeshes', 'src/core/meshAvatarContact.js', 'selectAvatarBodyMeshes', 'native_cpp/core/mesh_avatar_contact.hpp', 'selectAvatarBodyMeshes', 'scripts/check-native-cpp-mesh-avatar-contact.mjs'],
  ['mesh avatar createAvatarMeshCollider', 'src/core/meshAvatarContact.js', 'createAvatarMeshCollider', 'native_cpp/core/mesh_avatar_contact.hpp', 'createAvatarMeshCollider', 'scripts/check-native-cpp-mesh-avatar-contact.mjs'],
  ['mesh avatar sampleMeshContact', 'src/core/meshAvatarContact.js', 'sampleMeshContact', 'native_cpp/core/mesh_avatar_contact.hpp', 'sampleMeshContact', 'scripts/check-native-cpp-mesh-avatar-contact.mjs'],
  ['mesh avatar correctMeshAvatarContacts', 'src/core/meshAvatarContact.js', 'correctMeshAvatarContacts', 'native_cpp/core/mesh_avatar_contact.hpp', 'correctMeshAvatarContacts', 'scripts/check-native-cpp-mesh-avatar-contact.mjs'],
  ['backend registry registerSimulationBackend', 'src/core/backends/registry.js', 'registerSimulationBackend', 'native_cpp/core/backend_registry.hpp', 'registerSimulationBackend', 'scripts/check-native-cpp-backend-registry.mjs'],
  ['backend registry replaceSimulationBackend', 'src/core/backends/registry.js', 'replaceSimulationBackend', 'native_cpp/core/backend_registry.hpp', 'replaceSimulationBackend', 'scripts/check-native-cpp-backend-registry.mjs'],
  ['backend registry getSimulationBackend', 'src/core/backends/registry.js', 'getSimulationBackend', 'native_cpp/core/backend_registry.hpp', 'getSimulationBackend', 'scripts/check-native-cpp-backend-registry.mjs'],
  ['backend registry listSimulationBackends', 'src/core/backends/registry.js', 'listSimulationBackends', 'native_cpp/core/backend_registry.hpp', 'listSimulationBackends', 'scripts/check-native-cpp-backend-registry.mjs'],
  ['backend registry createSimulationSession', 'src/core/backends/registry.js', 'createSimulationSession', 'native_cpp/core/backend_registry.hpp', 'createSimulationSession', 'scripts/check-native-cpp-backend-registry.mjs'],
  ['fabric estimateFabricPbrPixels', 'src/core/fabricPbrGenerator.js', 'estimateFabricPbrPixels', 'native_cpp/core/fabric_pbr_pixels.hpp', 'estimateFabricPbrPixels', 'scripts/check-native-cpp-fabric-pbr-pixels.mjs'],
  ['PPF ppfSolverFabricPreset', 'src/core/backends/ppfPayload.js', 'ppfSolverFabricPreset', 'native_cpp/core/ppf_payload.hpp', 'ppfSolverFabricPreset', 'scripts/check-native-cpp-ppf-payload.mjs'],
  ['PPF ppfTemporaryShoulderSupports', 'src/core/backends/ppfPayload.js', 'ppfTemporaryShoulderSupports', 'native_cpp/core/ppf_payload.hpp', 'ppfTemporaryShoulderSupports', 'scripts/check-native-cpp-ppf-payload.mjs'],
  ['PPF buildPpfPayload', 'src/core/backends/ppfPayload.js', 'buildPpfPayload', 'native_cpp/core/ppf_payload.hpp', 'buildPpfPayload', 'scripts/check-native-cpp-ppf-direct-cli.mjs'],
  ['PPF buildExplodedPpfPayload', 'src/core/backends/ppfPayload.js', 'buildExplodedPpfPayload', 'native_cpp/core/ppf_payload.hpp', 'buildExplodedPpfPayload', 'scripts/check-native-cpp-ppf-direct-cli.mjs'],
  ['PPF buildDressedPpfPayload', 'src/core/backends/ppfPayload.js', 'buildDressedPpfPayload', 'native_cpp/core/ppf_payload.hpp', 'buildDressedPpfPayload', 'scripts/check-native-cpp-ppf-payload.mjs'],
  ['PPF validatePpfPayload', 'src/core/backends/ppfPayload.js', 'validatePpfPayload', 'native_cpp/core/ppf_payload.hpp', 'validatePpfPayload', 'scripts/check-native-cpp-ppf-payload.mjs'],
  ['PPF ppfPayloadSummary', 'src/core/backends/ppfPayload.js', 'ppfPayloadSummary', 'native_cpp/core/ppf_payload.hpp', 'ppfPayloadSummary', 'scripts/check-native-cpp-ppf-payload.mjs'],
  ['native quality NATIVE_QUALITY_PROFILES', 'src/core/backends/nativePayload.js', 'NATIVE_QUALITY_PROFILES', 'native_cpp/core/native_payload.hpp', 'NATIVE_QUALITY_PROFILES', 'scripts/check-native-cpp-native-payload.mjs'],
  ['Seamly SEAMLY_AVATAR_FIELDS', 'src/core/seamlyMeasurements.js', 'SEAMLY_AVATAR_FIELDS', 'native_cpp/core/seamly_import.hpp', 'SEAMLY_AVATAR_FIELDS', 'scripts/check-native-cpp-seamly-import.mjs'],
  ['grading DEFAULT_SIZES', 'src/core/grading.js', 'DEFAULT_SIZES', 'native_cpp/core/grading_helpers.hpp', 'DEFAULT_SIZES', 'scripts/check-native-cpp-grading-helpers.mjs'],
  ['grading sizeOffset', 'src/core/grading.js', 'sizeOffset', 'native_cpp/core/grading_helpers.hpp', 'sizeOffset', 'scripts/check-native-cpp-grading-helpers.mjs'],
  ['grading gradePointForPiece', 'src/core/grading.js', 'gradePointForPiece', 'native_cpp/core/grading_helpers.hpp', 'gradePointForPiece', 'scripts/check-native-cpp-grading-helpers.mjs'],
  ['grading gradePiece', 'src/core/grading.js', 'gradePiece', 'native_cpp/core/grading_helpers.hpp', 'gradePiece', 'scripts/check-native-cpp-grading-helpers.mjs'],
  ['native assembly inspectNativeAssemblyPose', 'src/core/backends/nativeAssemblyPreflight.js', 'inspectNativeAssemblyPose', 'native_cpp/core/native_assembly_preflight.hpp', 'inspectNativeAssemblyPose', 'scripts/check-native-cpp-native-assembly-preflight.mjs'],
  ['native solver assessNativeSolverResult', 'src/core/backends/nativeServiceBackend.js', 'assessNativeSolverResult', 'native_cpp/core/native_solver_acceptance.hpp', 'assessNativeSolverResult', 'scripts/check-native-cpp-native-solver-acceptance.mjs'],
  ['workspace profile WORKSPACE_PROFILE_KEY', 'src/core/workspaceProfiles.js', 'WORKSPACE_PROFILE_KEY', 'native_cpp/core/workspace_profiles.hpp', 'WORKSPACE_PROFILE_KEY', 'scripts/check-native-cpp-workspace-profiles.mjs'],
  ['workspace profile WORKSPACE_VIEW_KEY', 'src/core/workspaceProfiles.js', 'WORKSPACE_VIEW_KEY', 'native_cpp/core/workspace_profiles.hpp', 'WORKSPACE_VIEW_KEY', 'scripts/check-native-cpp-workspace-profiles.mjs'],
  ['workspace profile VIEWPORT_LAYOUTS', 'src/core/workspaceProfiles.js', 'VIEWPORT_LAYOUTS', 'native_cpp/core/workspace_profiles.hpp', 'VIEWPORT_LAYOUTS', 'scripts/check-native-cpp-workspace-profiles.mjs'],
  ['workspace profile WORKSPACE_PROFILES', 'src/core/workspaceProfiles.js', 'WORKSPACE_PROFILES', 'native_cpp/core/workspace_profiles.hpp', 'WORKSPACE_PROFILES', 'scripts/check-native-cpp-workspace-profiles.mjs'],
  ['workspace profile normalizeWorkspaceProfile', 'src/core/workspaceProfiles.js', 'normalizeWorkspaceProfile', 'native_cpp/core/workspace_profiles.hpp', 'normalizeWorkspaceProfile', 'scripts/check-native-cpp-workspace-profiles.mjs'],
  ['workspace command EXTRA_WORKSPACE_COMMANDS', 'src/core/workspaceCommandIndex.js', 'EXTRA_WORKSPACE_COMMANDS', 'native_cpp/core/workspace_command_index.hpp', 'EXTRA_WORKSPACE_COMMANDS', 'scripts/check-native-cpp-workspace-command-index.mjs'],
  ['workspace command indexWorkspaceCommands', 'src/core/workspaceCommandIndex.js', 'indexWorkspaceCommands', 'native_cpp/core/workspace_command_index.hpp', 'indexWorkspaceCommands', 'scripts/check-native-cpp-workspace-command-index.mjs'],
  ['workspace command searchWorkspaceCommands', 'src/core/workspaceCommandIndex.js', 'searchWorkspaceCommands', 'native_cpp/core/workspace_command_index.hpp', 'searchWorkspaceCommands', 'scripts/check-native-cpp-workspace-command-index.mjs'],
  ['cloth snapshot refreshSimulationAnalysis', 'src/core/physics.js', 'refreshSimulationAnalysis', 'native_cpp/core/cloth_analysis.hpp', 'refreshSimulationAnalysis', 'scripts/check-native-cpp-cloth-analysis.mjs'],
  ['textile describeTextileSurface', 'src/core/textileProcedurals.js', 'describeTextileSurface', 'native_cpp/core/textile_procedurals.hpp', 'describeTextileSurface', 'scripts/check-native-cpp-textile-procedurals.mjs'],
  ['textile textileRelief', 'src/core/textileProcedurals.js', 'textileRelief', 'native_cpp/core/textile_procedurals.hpp', 'textileRelief', 'scripts/check-native-cpp-textile-procedurals.mjs'],
  ['textile makeProceduralTextileMaps', 'src/core/textileProcedurals.js', 'makeProceduralTextileMaps', 'native_cpp/core/textile_procedurals.hpp', 'makeProceduralTextileMaps', 'scripts/check-native-cpp-textile-procedurals.mjs'],
  ['geometry createGeometry', 'src/core/physics.js', 'createGeometry', 'native_cpp/core/geometry_buffer_adapter.hpp', 'createGeometry', 'scripts/check-native-cpp-geometry-buffer-adapter.mjs'],
  ['geometry syncGeometry', 'src/core/physics.js', 'syncGeometry', 'native_cpp/core/geometry_buffer_adapter.hpp', 'syncGeometry', 'scripts/check-native-cpp-geometry-buffer-adapter.mjs'],
  ['geometry updateGeometryFabricUV', 'src/core/physics.js', 'updateGeometryFabricUV', 'native_cpp/core/geometry_buffer_adapter.hpp', 'updateGeometryFabricUV', 'scripts/check-native-cpp-geometry-buffer-adapter.mjs'],
  ['geometry syncAnalysisColors', 'src/core/physics.js', 'syncAnalysisColors', 'native_cpp/core/geometry_buffer_adapter.hpp', 'syncAnalysisColors', 'scripts/check-native-cpp-geometry-buffer-adapter.mjs'],
  ['visual-only physicsInputFingerprint', 'src/core/visualOnlyChanges.js', 'physicsInputFingerprint', 'native_cpp/core/visual_only_fingerprints.hpp', 'physicsInputFingerprint', 'scripts/check-native-cpp-visual-only-fingerprints.mjs'],
  ['visual-only opticalFabricFingerprint', 'src/core/visualOnlyChanges.js', 'opticalFabricFingerprint', 'native_cpp/core/visual_only_fingerprints.hpp', 'opticalFabricFingerprint', 'scripts/check-native-cpp-visual-only-fingerprints.mjs'],
  ['project cloneProject', 'src/core/project.js', 'cloneProject', 'native_cpp/core/project_utilities.hpp', 'cloneProject', 'scripts/check-native-cpp-project-utilities.mjs'],
  ['project touchProject', 'src/core/project.js', 'touchProject', 'native_cpp/core/project_utilities.hpp', 'touchProject', 'scripts/check-native-cpp-project-utilities.mjs'],
  ['project getPiece', 'src/core/project.js', 'getPiece', 'native_cpp/core/project_utilities.hpp', 'getPiece', 'scripts/check-native-cpp-project-utilities.mjs'],
  ['project uniqueId', 'src/core/project.js', 'uniqueId', 'native_cpp/core/project_utilities.hpp', 'uniqueId', 'scripts/check-native-cpp-project-utilities.mjs'],
  ['project makeRectanglePiece', 'src/core/project.js', 'makeRectanglePiece', 'native_cpp/core/project_utilities.hpp', 'makeRectanglePiece', 'scripts/check-native-cpp-project-utilities.mjs'],
  ['marker buildMarker', 'src/core/marker.js', 'buildMarker', 'native_cpp/core/marker_exact.hpp', 'buildMarker', 'scripts/check-native-cpp-marker-exact.mjs'],
  ['CLO CLO_MENUS', 'src/core/cloMenus.js', 'CLO_MENUS', 'native_cpp/core/clo_menus.hpp', 'CLO_MENUS', 'scripts/check-native-cpp-clo-menus.mjs'],
  ['native service DEFAULT_NATIVE_SERVICE_URL', 'src/core/backends/nativeServiceClient.js', 'DEFAULT_NATIVE_SERVICE_URL', 'native_cpp/core/native_service_client.hpp', 'DEFAULT_NATIVE_SERVICE_URL', 'scripts/check-native-cpp-native-service-client.mjs'],
  ['native service getNativeBackendHealth', 'src/core/backends/nativeServiceClient.js', 'getNativeBackendHealth', 'native_cpp/core/native_service_client.hpp', 'getNativeBackendHealth', 'scripts/check-native-cpp-native-service-client.mjs'],
  ['native service getNativeServiceHealth', 'src/core/backends/nativeServiceClient.js', 'getNativeServiceHealth', 'native_cpp/core/native_service_client.hpp', 'getNativeServiceHealth', 'scripts/check-native-cpp-native-service-client.mjs'],
  ['native service runNativeBackend', 'src/core/backends/nativeServiceClient.js', 'runNativeBackend', 'native_cpp/core/native_service_client.hpp', 'runNativeBackend', 'scripts/check-native-cpp-native-service-client.mjs'],
  ['native service solveWithNativeService', 'src/core/backends/nativeServiceClient.js', 'solveWithNativeService', 'native_cpp/core/native_service_client.hpp', 'solveWithNativeService', 'scripts/check-native-cpp-native-service-client.mjs'],
  ['native service stepNativePayload', 'src/core/backends/nativeServiceClient.js', 'stepNativePayload', 'native_cpp/core/native_service_client.hpp', 'stepNativePayload', 'scripts/check-native-cpp-native-service-client.mjs'],
  ['PPF service DEFAULT_PPF_SERVICE_URL', 'src/core/backends/ppfServiceClient.js', 'DEFAULT_PPF_SERVICE_URL', 'native_cpp/core/ppf_service_client.hpp', 'DEFAULT_PPF_SERVICE_URL', 'scripts/check-native-cpp-ppf-service-client.mjs'],
  ['PPF service getPpfServiceHealth', 'src/core/backends/ppfServiceClient.js', 'getPpfServiceHealth', 'native_cpp/core/ppf_service_client.hpp', 'getPpfServiceHealth', 'scripts/check-native-cpp-ppf-service-client.mjs'],
  ['PPF service submitPpfFinalSolve', 'src/core/backends/ppfServiceClient.js', 'submitPpfFinalSolve', 'native_cpp/core/ppf_service_client.hpp', 'submitPpfFinalSolve', 'scripts/check-native-cpp-ppf-service-client.mjs'],
  ['PPF service getPpfJob', 'src/core/backends/ppfServiceClient.js', 'getPpfJob', 'native_cpp/core/ppf_service_client.hpp', 'getPpfJob', 'scripts/check-native-cpp-ppf-service-client.mjs'],
  ['PPF service getPpfJobPreview', 'src/core/backends/ppfServiceClient.js', 'getPpfJobPreview', 'native_cpp/core/ppf_service_client.hpp', 'getPpfJobPreview', 'scripts/check-native-cpp-ppf-service-client.mjs'],
  ['PPF service waitForPpfJob', 'src/core/backends/ppfServiceClient.js', 'waitForPpfJob', 'native_cpp/core/ppf_service_client.hpp', 'waitForPpfJob', 'scripts/check-native-cpp-ppf-service-client.mjs'],
  ['seam assembly inspectStagedAvatarContact', 'src/core/backends/seamAssembly.js', 'inspectStagedAvatarContact', 'native_cpp/core/seam_assembly_parity_bridge.hpp', 'inspectStagedAvatarContact', 'scripts/check-native-cpp-seam-inspect-direct-cli.mjs'],
  ['seam assembly assembleNativeSeams', 'src/core/backends/seamAssembly.js', 'assembleNativeSeams', 'native_cpp/core/seam_assembly_parity_bridge.hpp', 'assembleNativeSeams', 'scripts/check-native-cpp-seam-advanced-parity.mjs'],
  ['ZOZO loadZozoDressReference', 'src/core/zozoReferenceDress.js', 'loadZozoDressReference', 'native_cpp/core/zozo_reference_dress.hpp', 'loadZozoDressReference', 'scripts/check-native-cpp-zozo-reference-dress.mjs'],
  ['simulation protocol SIMULATION_PROTOCOL', 'src/core/backends/protocol.js', 'SIMULATION_PROTOCOL', 'native_cpp/core/simulation_protocol.hpp', 'SIMULATION_PROTOCOL', 'scripts/check-native-cpp-simulation-protocol.mjs'],
  ['simulation protocol SIMULATION_PROTOCOL_VERSION', 'src/core/backends/protocol.js', 'SIMULATION_PROTOCOL_VERSION', 'native_cpp/core/simulation_protocol.hpp', 'SIMULATION_PROTOCOL_VERSION', 'scripts/check-native-cpp-simulation-protocol.mjs'],
  ['avatar physics getAvatarHeightScale', 'src/core/physics.js', 'getAvatarHeightScale', 'native_cpp/core/avatar_physics.hpp', 'getAvatarHeightScale', 'scripts/check-native-cpp-avatar-physics.mjs'],
  ['avatar physics getAvatarUpperBodyDimensions', 'src/core/physics.js', 'getAvatarUpperBodyDimensions', 'native_cpp/core/avatar_physics.hpp', 'getAvatarUpperBodyDimensions', 'scripts/check-native-cpp-avatar-physics.mjs'],
  ['avatar physics getAvatarArmPose', 'src/core/physics.js', 'getAvatarArmPose', 'native_cpp/core/avatar_physics.hpp', 'getAvatarArmPose', 'scripts/check-native-cpp-avatar-physics.mjs'],
  ['avatar physics getAvatarTorsoRadii', 'src/core/physics.js', 'getAvatarTorsoRadii', 'native_cpp/core/avatar_physics.hpp', 'getAvatarTorsoRadii', 'scripts/check-native-cpp-avatar-physics.mjs'],
  ['avatar physics boundaryIndicesForEdge', 'src/core/physics.js', 'boundaryIndicesForEdge', 'native_cpp/core/avatar_physics.hpp', 'boundaryIndicesForEdge', 'scripts/check-native-cpp-avatar-physics.mjs'],
  ['avatar physics avatarClearance', 'src/core/physics.js', 'avatarClearance', 'native_cpp/core/avatar_physics.hpp', 'avatarClearance', 'scripts/check-native-cpp-avatar-physics.mjs'],
  ['avatar physics measureAvatarSurfaceIntrusion', 'src/core/physics.js', 'measureAvatarSurfaceIntrusion', 'native_cpp/core/avatar_physics.hpp', 'measureAvatarSurfaceIntrusion', 'scripts/check-native-cpp-avatar-physics.mjs'],
  ['avatar physics correctAvatarSurfaceIntrusion', 'src/core/physics.js', 'correctAvatarSurfaceIntrusion', 'native_cpp/core/avatar_surface_correction.hpp', 'correctAvatarSurfaceIntrusion', 'scripts/check-native-cpp-avatar-surface-real-fixtures.mjs'],
]

const walk = dir => readdirSync(file(dir), { withFileTypes: true }).flatMap(entry => {
  const path = join(dir, entry.name)
  return entry.isDirectory() ? walk(path) : entry.name.endsWith('.js') ? [path] : []
}).sort()
const jsFiles = walk('src/core')
const publicExports = jsFiles.flatMap(path => {
  const source = load(path)
  return [...source.matchAll(/\bexport\s+(?:(?:async\s+)?function|const|class)\s+([A-Za-z_$][\w$]*)/g)]
    .map(match => ({ file: path, name: match[1] }))
})
const implemented = groups.map(([area, jsFile, jsSymbol, cppFile, cppSymbol, check]) => {
  const js = existsSync(file(jsFile)) && new RegExp('\\bexport\\s+(?:(?:async\\s+)?function|const|class)\\s+' + jsSymbol + '\\b').test(load(jsFile))
  const native = existsSync(file(cppFile)) && new RegExp('\\b' + cppSymbol + '\\s*(?:\\(|;|=)').test(load(cppFile))
  const test = existsSync(file(check)) && (load(check).includes(cppSymbol === 'gradeSizeRun' ? 'grade-run' : cppSymbol === 'gradeProject' ? 'grade-size' : 'assert.') || (check.endsWith('drafting-constructions.mjs') && load(check).includes('Parity mismatch case') && load(check).includes('cases.length')))
  return { area, js: jsFile + '#' + jsSymbol, native: cppFile + '#' + cppSymbol, check, jsExportFound: js, nativeDeclarationFound: native, parityScriptPresent: test, status: js && native && test ? 'parity-check-available' : 'unverified' }
})

// Catch broken or misleading inventory mappings immediately; never silently
// report a removed function as covered.
for (const entry of implemented) {
  assert.ok(entry.jsExportFound, 'missing JS export: ' + entry.js)
  assert.ok(entry.nativeDeclarationFound, 'missing native declaration: ' + entry.native)
  assert.ok(entry.parityScriptPresent, 'missing parity script/assertions: ' + entry.check)
}
assert.equal(new Set(implemented.map(x => x.js)).size, implemented.length, 'duplicate inventory mapping')
const mapped = new Set(implemented.map(x => x.js))
const unmapped = publicExports.filter(e => !mapped.has(e.file + '#' + e.name))
const outcome = { generatedFrom: ['src/core/**/*.js', 'native_cpp/core/**/*.hpp', 'scripts/check-native-cpp-*.mjs'], counts: {
  jsFiles: jsFiles.length, jsNamedExports: publicExports.length, mappedOperations: implemented.length,
  parityScriptsAvailable: implemented.filter(e => e.status === 'parity-check-available').length,
  unmappedJsExports: unmapped.length,
}, definitions: implemented, unmappedJsExports: unmapped }

if (args.has('--run-parity')) {
  const checks = [...new Set(implemented.map(x => x.check))]
  outcome.executedChecks = checks.map(script => {
    const run = spawnSync(process.execPath, [file(script)], { cwd: root, encoding: 'utf8', timeout: 120000, maxBuffer: 1024 * 1024 })
    return { script, passed: run.status === 0 && !run.error, exitCode: run.status, error: run.error?.message || null,
      output: (run.stdout || '').trim().slice(-1200), stderr: (run.stderr || '').trim().slice(-1200) }
  })
  if (outcome.executedChecks.some(x => !x.passed)) process.exitCode = 1
}
if (args.has('--json')) console.log(JSON.stringify(outcome, null, 2))
else {
  console.log(`JS core: ${outcome.counts.jsFiles} files, ${outcome.counts.jsNamedExports} named exports`)
  console.log(`Explicitly mapped operations: ${outcome.counts.mappedOperations}; parity checks available: ${outcome.counts.parityScriptsAvailable}`)
  console.log(`Unmapped JS exports: ${outcome.counts.unmappedJsExports}; no total-conversion percentage inferred`)
  for (const row of implemented) console.log(`  ${row.status}: ${row.area} [${row.check}]`)
  if (outcome.executedChecks) for (const check of outcome.executedChecks)
    console.log(`  ${check.passed ? 'PASS' : 'FAIL'}: ${check.script} ${check.error || check.stderr || check.output}`)
  if (args.has('--show-gaps')) for (const item of unmapped) console.log(`  unmapped: ${item.file}#${item.name}`)
}
