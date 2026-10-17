#include "garment_document.hpp"
#include "dxf_export.hpp"
#include "dxf_import.hpp"
#include "construction_dxf.hpp"
#include "pattern_mesh.hpp"
#include "drafting_snapping.hpp"
#include "auto_fit_placement.hpp"
#include "drafting_precision.hpp"
#include "drafting_constructions.hpp"
#include "drafting_split.hpp"
#include "mesh_selection.hpp"
#include "drafting_topology.hpp"
#include "drafting_unfold.hpp"
#include "cloth_meshing.hpp"
#include "trims.hpp"
#include "sewing_construction.hpp"
#include "simulation_quality.hpp"
#include "simulation_protocol.hpp"
#include "fabric_surface.hpp"
#include "project_geometry.hpp"
#include "quality_triangulation.hpp"
#include "live_drape_transfer.hpp"
#include "self_collision.hpp"
#include "avatar_contact_pass.hpp"
#include "staging_geometry.hpp"
#include "native_payload.hpp"
#include "seamly_import.hpp"
#include "garment_code.hpp"
#include "mesh_avatar_contact.hpp"
#include "native_seam_assembly.hpp"
#include "ppf_payload.hpp"
#include "fabric_pbr_pixels.hpp"
#include "fabric_pbr_image_generator.hpp"
#include "fabric_pbr_source_image.hpp"
#include "avatar_physics.hpp"
#include "avatar_contact_kernel.hpp"
#include "cloth_simulation.hpp"
#include "cloth_solver_step_extended.hpp"
#include "cloth_solver_step_contacts.hpp"
#include "authored_simulation_builder.hpp"
#include "optimized_authored_snapshot.hpp"
#include "native_backend_session.hpp"
#include "grading_helpers.hpp"
#include "avatar_surface_correction.hpp"
#include "cloth_meshing_pipeline.hpp"
#include "native_assembly_preflight.hpp"
#include "native_solver_acceptance.hpp"
#include "cloth_seam_constraints.hpp"
#include "workspace_profiles.hpp"
#include "workspace_command_index.hpp"
#include "cloth_analysis.hpp"
#include "textile_procedurals.hpp"
#include "assembled_cloth_snapshot.hpp"
#include "geometry_buffer_adapter.hpp"
#include "visual_only_fingerprints.hpp"
#include "project_utilities.hpp"
#include "native_simulation_payload_builder.hpp"
#include "marker_exact.hpp"
#include "clo_menus.hpp"
#include "native_service_client.hpp"
#include "ppf_service_client.hpp"
#include "zozo_reference_dress.hpp"
#include "seam_assembly_parity_bridge.hpp"
#include "obj_export.hpp"
#include "gltf_export.hpp"
#include "production_preflight.hpp"
#include "grading.hpp"
#include "marker_layout.hpp"
#include "marker_svg.hpp"
#include "marker_pdf.hpp"
#include "factory_zip.hpp"
#include "factory_package_files.hpp"
#include "fabric_cost.hpp"
#include "bom_export.hpp"
#include "measurement_export.hpp"
#include "tech_pack_export.hpp"
#include "clothcraft_export.hpp"
#include "ppf_bridge.hpp"
#include "ppf_service.hpp"

#include <exception>
#include <iostream>
#include <string>

namespace {

// Binary archives cannot safely be embedded as raw UTF-8 in the NDJSON API.
// Use an RFC 4648 base64 envelope for native ZIP/PDF download clients.
std::string toBase64(const std::string& bytes) {
  static constexpr char alphabet[]="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  std::string output;
  output.reserve(((bytes.size()+2)/3)*4);
  for (std::size_t i=0;i<bytes.size();i+=3) {
    const auto a=static_cast<unsigned char>(bytes[i]);
    const auto b=i+1<bytes.size()?static_cast<unsigned char>(bytes[i+1]):0;
    const auto c=i+2<bytes.size()?static_cast<unsigned char>(bytes[i+2]):0;
    output.push_back(alphabet[a>>2]);
    output.push_back(alphabet[((a&3)<<4)|(b>>4)]);
    output.push_back(i+1<bytes.size()?alphabet[((b&15)<<2)|(c>>6)]:'=');
    output.push_back(i+2<bytes.size()?alphabet[c&63]:'=');
  }
  return output;
}

}

using garment::Document;
using garment::Json;

namespace {

Json execute(const Json& request) {
  if (!request.is_object()) throw std::invalid_argument("request must be an object");
  if (request.value("protocol", "") != "garment-studio.native-cad.v1")
    throw std::invalid_argument("unsupported native CAD protocol");
  const auto op = request.value("op", "inspect");
  if (op == "import-dxf") {
    const Json args=request.value("args",Json::object());
    if (!args.is_object() || !args.contains("dxf") || !args.at("dxf").is_string())
      throw std::invalid_argument("import-dxf requires args.dxf text");
    const auto imported=garment::importDxfPatterns(args.at("dxf").get<std::string>(),
      args.value("scaleToCm",0.0));
    return {{"protocol","garment-studio.native-cad.v1"},{"ok",true},
      {"op",op},{"import",imported},{"factoryCertified",false}};
  }
  if (!request.contains("document") || !request.at("document").is_object())
    throw std::invalid_argument("request.document must be a garment project object");
  Document document(request.at("document"));
  const Json args = request.value("args", Json::object());
  Json result = {{"protocol", "garment-studio.native-cad.v1"}, {"ok", true}, {"op", op}};
  if (op == "inspect") {
    result["summary"] = document.summary();
    result["validation"] = document.validate().toJson();
  } else if (op == "edge-info") {
    result["edge"] = document.edgeInfo(args.at("pieceId").get<std::string>(), args.at("edgeIndex").get<std::size_t>());
  } else if (op == "seam-info") {
    result["seam"] = document.seamInfo(args.at("seamId").get<std::string>());
  } else if (op == "document") {
    result["document"] = document.data();
  } else if (op == "export-dxf") {
    const auto size = args.value("size",std::string());
    const bool withSeamAllowances=args.value("withSeamAllowances",false);
    if (size.empty()) {
      result["dxf"] = garment::exportCuttingDxf(document, args.value("samplesPerCurve", 24),withSeamAllowances);
    } else {
      Document sized(garment::gradeProject(document,size));
      result["dxf"] = garment::exportCuttingDxf(sized, args.value("samplesPerCurve", 24),withSeamAllowances);
      result["size"] = size;
    }
    result["units"] = "mm";
    result["includesSeamAllowances"] = withSeamAllowances;
    result["scope"] = withSeamAllowances
      ? "sampled cut outlines with edge seam allowances; no notches, darts, AAMA or factory certification"
      : "stitchline outlines only; no seam allowance, notches, grading or AAMA metadata";
  } else if (op == "export-dxf-run") {
    result["dxfBySize"] = Json::object();
    const auto run = garment::gradeSizeRun(document);
    const bool withSeamAllowances=args.value("withSeamAllowances",false);
    for (auto it=run.begin(); it!=run.end(); ++it) {
      Document sized(it.value());
      result["dxfBySize"][it.key()] = garment::exportCuttingDxf(sized,args.value("samplesPerCurve",24),withSeamAllowances);
    }
    result["units"] = "mm";
    result["includesSeamAllowances"] = withSeamAllowances;
    result["scope"] = withSeamAllowances
      ? "graded cutting outline previews with seam allowances; notches, darts, AAMA and factory approval not included"
      : "graded stitchline-only DXF previews; factory allowances, notches and AAMA not included";
  } else if (op == "export-construction-dxf") {
    const std::string size=args.value("size",
      document.data().value("previewSize",
        document.data().value("grading",Json::object()).value("baseSize",std::string("BASE"))));
    result["dxf"] = garment::exportConstructionDxf(document,size);
    result["size"] = size;
    result["units"] = "mm";
    result["factoryCertified"] = false;
    result["scope"] = "native open DXF with notch, allowance, grain, dart, pleat, buttonhole and construction entities; not certified AAMA/ASTM interchange";
  } else if (op == "mesh-project") {
    const int segments=args.value("segmentsPerCurve",8);
    const int resolution=args.value("resolution",1);
    if (segments<2 || segments>64 || resolution<0 || resolution>3)
      throw std::invalid_argument("mesh settings out of supported bounds");
    const auto meshes=garment::buildProjectPatternMeshes(document.data(),segments,resolution);
    result["meshes"]=Json::array();
    for(const auto& mesh:meshes) {
      Json vertices=Json::array(),edges=Json::array();
      for(const auto& vertex:mesh.vertices)
        vertices.push_back({{"xCm",vertex.positionCm.x},{"yCm",vertex.positionCm.y},
                            {"u",vertex.uv.x},{"v",vertex.uv.y}});
      for(const auto& edge:mesh.edges)
        edges.push_back({{"sourceEdge",edge.sourceEdge},{"seamId",edge.seamId},
                         {"boundaryIndices",edge.boundaryIndices}});
      result["meshes"].push_back({{"pieceId",mesh.pieceId},{"vertices",vertices},
        {"triangles",mesh.triangles},{"edges",edges},
        {"grainDirection",{{"x",mesh.grainDirection.x},{"y",mesh.grainDirection.y}}}});
    }
    result["units"]="cm";
    result["fitAccepted"]=false;
    result["scope"]="native flat pattern rest meshes with grainline UV and seam edge references, not avatar fit or cloth simulation";
  } else if (op == "auto-fit-placement") {
    result["placement"] = garment::constrainAutoFitPlacement(
      args.value("arrangement",Json::object()),args.value("options",Json::object()));
    result["units"] = "m";
    result["scope"] = "bounded rigid staging correction; not a drape simulation or collision-free fit";
  } else if (op == "apply-auto-fit-placement") {
    Json simPiece=args.at("simPiece");
    result["placement"] = garment::applyAutoFitPlacement(simPiece,
      args.value("arrangement",Json::object()),args.value("options",Json::object()));
    result["simPiece"] = std::move(simPiece);
    result["units"] = "m";
    result["scope"] = "rigid particle translation only; not a drape simulation or collision-free fit";
  } else if (op == "draft-precision") {
    result["value"] = garment::draftingPrecisionOperation(args.at("method").get<std::string>(),args);
    result["units"] = "cm";
  } else if (op == "draft-construction") {
    const auto method=args.at("method").get<std::string>();
    const auto makePoint=[](garment::Point2 p)->Json { return {{"x",p.x},{"y",p.y}}; };
    const auto inputPoint=[&](const char* name)->garment::Point2 {
      const auto& p=args.at(name);
      return {p.at("x").get<double>(),p.at("y").get<double>()};
    };
    if(method=="constructionReferencePoint")
      result["value"]=makePoint(garment::constructionReferencePoint(args.at("piece"),args.at("oneBasedIndex")));
    else if(method=="lineIntersection")
      result["value"]=makePoint(garment::lineIntersection(inputPoint("a"),inputPoint("b"),inputPoint("c"),inputPoint("d")));
    else if(method=="projectOntoLine")
      result["value"]=makePoint(garment::projectOntoLine(inputPoint("point"),inputPoint("a"),inputPoint("b")));
    else if(method=="pointAlongLine")
      result["value"]=makePoint(garment::pointAlongLine(inputPoint("a"),inputPoint("b"),args.at("distanceCm"),args.value("perpendicular",false)));
    else if(method=="mirrorPointAcrossLine")
      result["value"]=makePoint(garment::mirrorPointAcrossLine(inputPoint("point"),inputPoint("a"),inputPoint("b")));
    else if(method=="draftConstructionModes")
      result["value"]=garment::draftConstructionModes();
    else if(method=="preciseConstructionEdit")
      result["value"]=garment::preciseConstructionEdit(args.at("piece"),args.at("pointIndex"),args.value("options",Json::object()));
    else throw std::invalid_argument("unknown native drafting construction method");
    result["units"] = "cm";
  } else if (op == "seam-inspect-avatar-contact") {
    result["inspection"]=garment::seam_assembly_parity_bridge::inspectStagedAvatarContact(
      args.at("payload"));
    result["sweptCollisionCertified"]=false;
    result["readOnly"]=true;
  } else if (op == "seam-assemble-conventional" || op == "seam-assemble-native") {
    result["assembled"]=garment::seam_assembly_parity_bridge::assembleNativeSeams(
      args.at("payload"),args.value("options",Json::object()));
    result["fullExportParity"]=false;
    result["fitCertified"]=false;
    result["scope"]="research-only seam/rest/contact and joint constraints on JSON particle snapshots; matched sampled JS fixtures, no continuous triangle CCD or production fit";
  } else if (op == "fabric-pbr-from-decoded-image") {
    result["maps"]=garment::generateFabricPbrFromImagePixels(
      args.at("imageData"),args.value("options",Json::object()));
    result["browserImageDecodeSupported"]=false;
    result["scope"]="decoded post-canvas RGBA pixel adapter; source URL decode and browser canvas resampling must occur externally; PNG pixel outputs JS-parity tested";
  } else if (op == "fabric-pbr-from-source-image") {
    result["maps"]=garment::generateFabricPbrFromImageSource(
      args.at("source").get<std::string>(),args.value("options",Json::object()));
    result["browserParityCertified"]=false;
    result["scope"]="native PNG/JPEG ImageIO decode + CoreGraphics RGBA resize; browser HTMLCanvas interpolation and PNG encoding not byte-certified";
  } else if (op == "zozo-dress-reference-frame") {
    // Read-only source recording; caller names an existing on-disk reference
    // folder. No project or editable garment state is modified.
    auto reference=garment::loadZozoDressReference(args.at("referenceDirectory").get<std::string>());
    result["manifest"]=reference.manifest();
    result["panelCount"]=reference.meshes().at("clothPanels").size();
    result["frame"]=args.at("frame");
    if(args.contains("sampleCoordinates")) {
      std::vector<std::size_t> sampleCoordinates;
      for(const auto& value:args.at("sampleCoordinates")){
        if(!value.is_number_unsigned()&&!value.is_number_integer())
          throw std::invalid_argument("ZOZO frame coordinate must be an integer");
        auto i=value.get<std::int64_t>();
        if(i<0)throw std::out_of_range("ZOZO frame coordinate outside frame");
        sampleCoordinates.push_back(static_cast<std::size_t>(i));
      }
      result["sampleBits"]=reference.frameFloat32Bits(
        args.at("frame").get<int>(),sampleCoordinates);
    } else {
      result["coordinateCount"]=reference.frameVertices(args.at("frame").get<int>()).size();
    }
    result["readOnly"]=true;
    result["fitCertified"]=false;
    result["sweptCollisionCertified"]=false;
  } else if (op == "ppf-service-health") {
    result["health"]=garment::ppf_service_client::getPpfServiceHealth(
      args.value("options",Json::object()));
    result["transport"]="synchronous localhost HTTP, not a JS Promise/AbortSignal";
  } else if (op == "ppf-service-submit") {
    result["job"]=garment::ppf_service_client::submitPpfFinalSolve(
      document.data(),args.value("options",Json::object()));
    result["fitCertified"]=false;
  } else if (op == "ppf-service-job") {
    result["job"]=garment::ppf_service_client::getPpfJob(args.at("id").get<std::string>(),
      args.value("options",Json::object()));
  } else if (op == "ppf-service-preview") {
    result["preview"]=garment::ppf_service_client::getPpfJobPreview(
      args.at("id").get<std::string>(),args.value("options",Json::object()));
    result["readOnly"]=true;
    result["fitCertified"]=false;
  } else if (op == "ppf-service-wait") {
    Json options=args.value("options",Json::object());
    if(!options.contains("timeoutMs"))options["timeoutMs"]=30000;
    int progress=0;
    result["job"]=garment::ppf_service_client::waitForPpfJob(
      args.at("id").get<std::string>(),options,
      [&progress](const Json&){++progress;});
    result["progressChecks"]=progress;
    result["fitCertified"]=false;
  } else if (op == "native-service-health") {
    result["health"]=garment::native_service_client::getNativeBackendHealth(
      args.value("options",Json::object()));
    result["transport"]="synchronous localhost HTTP request, not JS Promise or AbortSignal";
  } else if (op == "native-service-run") {
    result["solverResult"]=garment::native_service_client::runNativeBackend(
      document.data(),args.value("options",Json::object()));
    result["fitCertified"]=false;
  } else if (op == "native-service-solve") {
    result["solverResult"]=garment::native_service_client::solveWithNativeService(
      document.data(),args.value("options",Json::object()));
    result["fitCertified"]=false;
  } else if (op == "native-service-step") {
    result["solverResult"]=garment::native_service_client::stepNativePayload(
      args.at("payload"),args.value("options",Json::object()));
    result["fitCertified"]=false;
  } else if (op == "workspace-clo-menus") {
    result["menus"]=garment::clo_menus::CLO_MENUS;
    result["scope"]="reference command catalog; null actions deliberately unsupported";
  } else if (op == "marker-build-exact") {
    result["marker"]=garment::marker_exact::buildMarker(
      document.data(),args.value("fabricWidth",150.),args.value("gap",1.5),
      args.value("options",Json::object()));
    result["scope"]="development marker nesting with JS numeric parity; industrial nesting and factory approvals not certified";
    result["factoryCertified"]=false;
  } else if (op == "native-build-solver-payload") {
    result["payload"]=garment::buildAuthoredNativeSimulationPayload(
      document.data(),args.value("options",Json::object()));
    result["scope"]="development native XPBD solver payload; not a fitted result or factory-approved simulation";
    result["fitCertified"]=false;
  } else if (op == "project-utility") {
    const auto method=args.at("method").get<std::string>();
    namespace pu=garment::project_utilities;
    if(method=="uniqueId") {
      result["value"]=pu::uniqueId(args.value("prefix",std::string("id")),
        args.at("epochMilliseconds").get<std::int64_t>(),args.at("randomUnit").get<double>());
    } else if(method=="makeRectanglePiece") {
      const auto value=pu::makeRectanglePiece(args.value("index",0.),
        args.at("epochMilliseconds").get<std::int64_t>(),args.at("randomUnit").get<double>());
      result["value"]=Json::parse(value.dump());
    } else {
      // Preserve original JS insertion order when crossing into ordered_json.
      const auto source=pu::Json::parse(args.at("projectJson").get<std::string>());
      if(method=="cloneProject")result["value"]=Json::parse(pu::cloneProject(source).dump());
      else if(method=="touchProject")result["value"]=Json::parse(
        pu::touchProject(source,args.at("timestamp").get<std::string>()).dump());
      else if(method=="getPiece")result["value"]=Json::parse(
        pu::getPiece(source,args.at("id").get<std::string>()).dump());
      else throw std::invalid_argument("unsupported project utility");
    }
    result["scope"]="ordered JSON document utility; IDs require caller-injected deterministic clock and randomness";
  } else if (op == "visual-only-fingerprints") {
    // The nlohmann::json garment document sorts object keys. Parse the caller's
    // original JSON text as ordered_json to preserve JS JSON.stringify order.
    const auto serialized=args.at("projectJson").get<std::string>();
    const auto ordered=garment::visual_only_fingerprints::Json::parse(serialized);
    result["physicsFingerprint"]=garment::visual_only_fingerprints::physicsInputFingerprint(ordered);
    result["opticalFingerprint"]=garment::visual_only_fingerprints::opticalFabricFingerprint(ordered);
    result["scope"]="ordered serialized project input; optical edits do not invalidate the physics-input fingerprint";
  } else if (op == "cloth-assembled-snapshot") {
    result["snapshot"]=garment::buildAssembledClothSnapshot(document.data());
    result["fullSolverParity"]=false;
    result["scope"]="initial authored cloth particles, triangles, physical sewing and anchors; no runtime solver, collision exclusion graph or live GUI geometry";
  } else if (op == "geometry-buffer-create") {
    result["geometry"]=garment::geometry_buffer_adapter::createGeometry(args.at("piece"));
    result["scope"]="CPU typed JSON vertex/index/UV buffers; not a live THREE.BufferGeometry object";
  } else if (op == "geometry-buffer-sync") {
    result["update"]=garment::geometry_buffer_adapter::syncGeometry(
      args.at("piece"),args.at("geometry"),document.data());
    result["scope"]="serialized vertex update, normals and bounding sphere; visualWrapAssist unsupported";
  } else if (op == "geometry-buffer-uv") {
    result["update"]=garment::geometry_buffer_adapter::updateGeometryFabricUV(
      args.at("piece"),args.at("geometry"),args.value("fabric",Json::object()));
  } else if (op == "geometry-buffer-analysis-colors") {
    result["update"]=garment::geometry_buffer_adapter::syncAnalysisColors(
      args.at("piece"),args.at("geometry"),args.value("mode",std::string("surface")));
  } else if (op == "textile-surface-describe") {
    result["surface"]=garment::textile_procedurals::describeTextileSurface(args.value("fabric",Json::object()));
  } else if (op == "textile-surface-relief") {
    result["height"]=garment::textile_procedurals::textileRelief(args.at("family").get<std::string>(),
      args.at("u").get<double>(),args.at("v").get<double>());
  } else if (op == "textile-map-pixels") {
    const int resolution=args.value("resolution",256);
    result["maps"]=garment::textile_procedurals::makeProceduralTextileMaps(
      args.value("fabric",Json::object()),resolution);
    result["scope"]="native texture pixel data and UV repeat metadata; not instantiated THREE.CanvasTexture objects";
    result["fabricCertified"]=false;
  } else if (op == "cloth-refresh-analysis") {
    result["analysis"]=garment::refreshSimulationAnalysis(args.at("simulation"),document.data());
    result["scope"]="serialized particle and constraint snapshot analytics; no live THREE updates, not collision-certified";
    result["fitCertified"]=false;
  } else if (op == "workspace-extra-commands") {
    result["commands"]=garment::workspace_command_index::EXTRA_WORKSPACE_COMMANDS;
  } else if (op == "workspace-index-commands") {
    result["commands"]=garment::workspace_command_index::indexWorkspaceCommands(
      args.at("menus"));
  } else if (op == "workspace-search-commands") {
    result["matches"]=garment::workspace_command_index::searchWorkspaceCommands(
      args.at("commands"),args.value("query",Json("")),args.value("maxResults",30.));
  } else if (op == "workspace-presets") {
    result["profiles"]=garment::workspace_profiles::WORKSPACE_PROFILES;
    result["layouts"]=garment::workspace_profiles::VIEWPORT_LAYOUTS;
    result["profileKey"]=garment::workspace_profiles::WORKSPACE_PROFILE_KEY;
    result["viewKey"]=garment::workspace_profiles::WORKSPACE_VIEW_KEY;
  } else if (op == "workspace-normalize") {
    result["profile"]=garment::workspace_profiles::normalizeWorkspaceProfile(args.at("profile"));
    result["scope"]="UI workspace geometry only; source garment pattern/physics unaffected";
  } else if (op == "cloth-seams-from-project") {
    const Json mesh=garment::buildClothMeshingPipeline(document.data());
    result["constraints"]=garment::buildClothSeamConstraints(document.data(),mesh);
    result["scope"]="authored tee/pants stitch and default fit-anchor equivalence on tested fixtures; not all custom pins, fittings, collision exclusions, internal construction or advanced layer treatments";
    result["fullSolverParity"]=false;
  } else if (op == "native-assess-solver-result") {
    result["assessment"]=garment::assessNativeSolverResult(args.value("result",Json()));
    result["fitCertified"]=false;
    result["scope"]="structural and sewing telemetry, with missing triangle CCD marked UNVERIFIED";
  } else if (op == "native-assembly-preflight") {
    result["report"]=garment::inspectNativeAssemblyPose(args.at("payload"),
      args.value("options",Json::object()));
    result["fitCertified"]=false;
    result["scope"]="geometric initial seam-gap and mesh strain preflight; no cloth fit or swept collision";
  } else if (op == "cloth-mesh-from-project") {
    result["mesh"]=garment::buildClothMeshingPipeline(document.data());
    result["scope"]="authored-pattern flat mesh and initial staging, with tested tee/pants Earcut triangulation and sampled seam boundaries; full sewing constraint assembly, extreme contours, and live simulation not included";
    result["fitCertified"]=false;
  } else if (op == "avatar-surface-correct-proxy") {
    Json simulation=args.at("simulation");
    result["stats"]=garment::avatar_surface_correction::correctAvatarSurfaceIntrusion(
      simulation,document.data(),args.value("options",Json::object()));
    result["simulation"]=std::move(simulation);
    result["scope"]="serialized THREE/Map particle snapshot; real tee/pants and perturbed corrections verified, not live GPU object interop or triangle CCD";
    result["fitCertified"]=false;
  } else if (op == "grade-helper") {
    const auto method=args.at("method").get<std::string>();
    namespace gh=garment::grading_helpers;
    const Json grading=args.value("grading",document.data().value("grading",Json::object()));
    const auto size=args.value("size",std::string("M"));
    if(method=="DEFAULT_SIZES")result["value"]=gh::DEFAULT_SIZES;
    else if(method=="sizeOffset")result["value"]=gh::sizeOffset(grading,size);
    else if(method=="gradePointForPiece")result["value"]=gh::gradePointForPiece(
      args.at("piece"),grading,size,args.at("point"));
    else if(method=="gradePiece")result["value"]=gh::gradePiece(args.at("piece"),grading,size);
    else throw std::invalid_argument("unsupported grading helper");
    result["units"]="cm";
  } else if (op == "cloth-build-from-snapshot") {
    result["simulation"]=garment::buildSimulation(document.data(),args.at("meshedSnapshot"));
    result["scope"]="prebuilt simulation snapshot; does not create triangle meshes or stitch constraints";
    result["fitCertified"]=false;
  } else if (op == "cloth-step-validated-snapshot") {
    result["simulation"]=garment::cloth_solver_step_extended::step(
      args.at("simulation"),document.data(),args.value("dt",1.0/60.0),
      args.value("frames",1));
    result["fullStepParity"]=false;
    result["fitCertified"]=false;
    result["scope"]="collision-disabled physical PBD JSON snapshot parity; self/avatar collisions, wind, live THREE map mutations and CCD unsupported";
  } else if (op == "cloth-step-contacts-experimental") {
    result["simulation"]=garment::cloth_solver_step_contacts::step(
      args.at("simulation"),document.data(),args.value("dt",1.0/60.0),
      args.value("frames",1));
    result["fullStepParity"]=false;
    result["fitCertified"]=false;
    result["researchOnly"]=true;
    result["scope"]="research approximation with post-core self/avatar contacts; NOT JS stepSimulation parity, NOT continuous triangle CCD, NOT production fit";
  } else if (op == "physics-avatar-discrete-particle-contact") {
    result["particle"]=garment::collideAvatarParticle(
      args.at("particle"),args.value("avatar",document.data().value("avatar",Json::object())),
      args.value("margin",0.012),args.value("friction",0.3));
    result["fullStepParity"]=false;
    result["fitCertified"]=false;
    result["scope"]="tested discrete avatar collision on individual JSON particles; not swept cloth triangle CCD or a fitted garment trajectory";
  } else if (op == "simulation-build-authored-snapshot") {
    result["simulation"]=garment::authored_simulation_builder::build(
      document.data(),args.value("options",Json::object()));
    result["fullNamedExportParity"]=false;
    result["fitCertified"]=false;
    result["scope"]="native authored geometry and initial particle/face/anchor/seam snapshot; no live THREE/Map identity, mesh optimize, cyclic constraints or full runtime analysis";
  } else if (op == "simulation-build-optimized-snapshot") {
    result["simulation"]=garment::buildOptimizedAuthoredSnapshot(document.data());
    result["fullNamedExportParity"]=false;
    result["fitCertified"]=false;
    result["scope"]="optimized authored faces, structural/bend constraints, seams, anchors and initial particles; not complete XPBD payload, live runtime solver, fit or CCD";
  } else if (op == "native-build-optimized-payload-experimental") {
    result["payload"]=garment::buildOptimizedNativeXpbdPayload(
      document.data(),args.value("options",Json::object()));
    result["fullPayloadParity"]=false;
    result["fitCertified"]=false;
    result["researchOnly"]=true;
    result["scope"]="optimized faces and springs, ordered sewn/fused constraints, exclusions, anchors and initial assembly; JS virtual seam anchors/mesh quality numerical ranking still differ";
  } else if (op == "native-backend-snapshot-create") {
    result["session"]=garment::createNativeBackendSession(
      document.data(),args.at("simulation"),args.at("payload"));
    result["liveJsBackendParity"]=false;
    result["fitCertified"]=false;
    result["scope"]="JSON snapshot session; browser THREE/Map identity, Promise and AbortSignal lifecycle remain at host boundary";
  } else if (op == "native-backend-snapshot-adopt") {
    result["session"]=garment::adoptNativeBackendResult(
      args.at("session"),args.at("solverResult"),args.value("elapsedMs",0.));
    result["fitCertified"]=false;
    result["sourceMutation"]=false;
  } else if (op == "native-backend-snapshot-stats") {
    result["stats"]=garment::nativeBackendStats(args.at("session"));
    result["liveJsBackendParity"]=false;
  } else if (op == "native-backend-snapshot-dispose") {
    result["session"]=garment::disposeNativeBackendSession(args.at("session"));
    result["abortSignalInterop"]=false;
  } else if (op == "browser-backend-snapshot-create") {
    result["session"]=garment::createBrowserBackendSession(
      document.data(),args.at("simulation"),
      args.value("request",Json::object()),args.value("protocolVersion",Json(1)));
    result["liveJsBackendParity"]=false;
    result["scope"]="serialized snapshot only; native solver not equivalent to browser THREE PBD engine";
  } else if (op == "browser-backend-snapshot-stats") {
    result["stats"]=garment::browserBackendStats(args.at("session"));
    result["liveJsBackendParity"]=false;
  } else if (op == "browser-backend-snapshot-piece") {
    result["piece"]=garment::browserBackendPieceState(
      args.at("session"),args.at("pieceId").get<std::string>());
    result["readOnly"]=true;
  } else if (op == "cloth-step-no-collisions") {
    result["simulation"]=garment::stepSimulation(args.at("simulation"),document.data(),
      args.value("dt",1./60.));
    result["scope"]="partial PBD with collisions/wind/virtual seams explicitly unsupported";
    result["fitCertified"]=false;
  } else if (op == "avatar-physics") {
    const std::string method=args.at("method").get<std::string>();
    namespace ap=garment::avatar_physics;
    const Json avatar=args.value("avatar",document.data().value("avatar",Json::object()));
    if(method=="getAvatarHeightScale")result["value"]=ap::getAvatarHeightScale(avatar);
    else if(method=="getAvatarUpperBodyDimensions")result["value"]=ap::getAvatarUpperBodyDimensions(avatar);
    else if(method=="getAvatarArmPose")result["value"]=ap::getAvatarArmPose(avatar,args.value("side",1.));
    else if(method=="getAvatarTorsoRadii")result["value"]=ap::getAvatarTorsoRadii(avatar,args.value("y",1.));
    else if(method=="boundaryIndicesForEdge")result["value"]=ap::boundaryIndicesForEdge(args.at("piece"),args.at("edgeIndex").get<int>());
    else if(method=="avatarClearance")result["value"]=ap::avatarClearance(args.at("position"),avatar,args.value("particle",Json()));
    else if(method=="measureAvatarSurfaceIntrusion")result["value"]=ap::measureAvatarSurfaceIntrusion(args.at("simulation"),avatar,args.value("options",Json::object()));
    else throw std::invalid_argument("Unsupported native avatar physics method");
    result["scope"]="JSON geometry/particle adapter; no live THREE references, no CCD or fit certification";
  } else if (op == "fabric-estimate-pbr-pixels") {
    result["maps"]=garment::estimateFabricPbrPixels(args.at("imageData"),
      args.value("options",Json::object()));
    result["scope"]="normal and roughness pixel arrays; image decode/PNG encoding require host I/O";
    result["fabricScannerCertified"]=false;
  } else if (op == "ppf-fabric-preset") {
    result["preset"]=garment::ppfSolverFabricPreset(args.value("fabric",Json::object()));
  } else if (op == "ppf-temporary-shoulder-supports") {
    result["supports"]=garment::ppfTemporaryShoulderSupports(args.value("pieces",Json::array()),
      args.value("enabled",true),args.value("frames",60.));
  } else if (op == "ppf-build-payload") {
    const Json options=args.value("options",Json::object());
    const Json native=args.contains("nativePayload")?args.at("nativePayload"):
      garment::buildAuthoredNativeSimulationPayload(document.data(),options);
    result["payload"]=garment::buildPpfPayload(document.data(),native,options);
    result["fitCertified"]=false;
    result["scope"]="compiles authored project to native XPBD input and PPF shell; no solved or collision-certified fit";
  } else if (op == "ppf-build-dressed-payload") {
    result["payload"]=garment::buildDressedPpfPayload(document.data(),args.at("nativePayload"),
      args.at("nativeResult"),args.value("options",Json::object()));
    result["fitCertified"]=false;
  } else if (op == "ppf-build-exploded-payload") {
    const Json options=args.value("options",Json::object());
    const Json native=args.contains("nativePayload")?args.at("nativePayload"):
      garment::buildAuthoredNativeSimulationPayload(document.data(),options);
    result["payload"]=garment::buildExplodedPpfPayload(document.data(),native,options);
    result["fitCertified"]=false;
  } else if (op == "ppf-validate-payload") {
    result["validation"]=garment::validatePpfPayload(args.at("payload"));
  } else if (op == "ppf-payload-summary") {
    result["summary"]=garment::ppfPayloadSummary(args.at("payload"));
  } else if (op == "avatar-mesh-select") {
    result["selection"]=garment::selectAvatarBodyMeshes(args.at("avatar"),
      args.value("model",std::string()));
    result["scope"]="world-space JSON triangle/avatar mesh adapter, not live THREE or skeletal mesh";
  } else if (op == "avatar-mesh-collider") {
    result["collider"]=garment::createAvatarMeshCollider(args.at("avatar"),
      args.value("options",Json::object()));
    result["scope"]="world-space triangle adapter without live skinning or BVH";
  } else if (op == "avatar-mesh-sample-contact") {
    result["contact"]=garment::sampleMeshContact(args.at("collider"),args.at("point"),
      args.value("options",Json::object()));
    result["collisionCertified"]=false;
  } else if (op == "avatar-mesh-correct-contacts") {
    Json simulation=args.at("simulation");
    result["stats"]=garment::correctMeshAvatarContacts(simulation,args.at("collider"),
      args.value("options",Json::object()));
    result["simulation"]=std::move(simulation);
    result["collisionCertified"]=false;
  } else if (op == "native-seam-staged-contact") {
    const auto clearance=[](const Json& position,const Json& avatar,const Json& particle)->double {
      if(!position.is_array()||position.size()!=3)
        throw std::invalid_argument("Seam contact position must be [x,y,z] in metres");
      const Json sample={{"x",position.at(0)},{"y",position.at(1)},{"z",position.at(2)}};
      return garment::avatar_physics::avatarClearance(sample,avatar,particle);
    };
    result["report"]=garment::native_seam_assembly::inspectStagedAvatarContact(
      args.at("payload"),clearance);
    result["scope"]="static numeric avatar-clearance proxy on staged points; no swept triangle CCD";
    result["collisionCertified"]=false;
  } else if (op == "native-seam-assemble") {
    const auto clearance=[](const Json& position,const Json& avatar,const Json& particle)->double {
      if(!position.is_array()||position.size()!=3)
        throw std::invalid_argument("Seam contact position must be [x,y,z] in metres");
      const Json sample={{"x",position.at(0)},{"y",position.at(1)},{"z",position.at(2)}};
      return garment::avatar_physics::avatarClearance(sample,avatar,particle);
    };
    result["assembly"]=garment::native_seam_assembly::assembleNativeSeams(args.at("payload"),
      args.value("options",Json::object()),clearance);
    result["scope"]="experimental unconstrained seam/rest assembly with numeric avatar-clearance reporting; no body constraint or swept collision certification";
    result["fitCertified"]=false;
  } else if (op == "garment-code-export") {
    result["garmentCode"]=garment::projectToGarmentCode(document.data());
    result["scope"]="open GarmentCode interchange and garment metadata";
  } else if (op == "garment-code-import") {
    result["document"]=garment::garmentCodeToProject(args.at("garmentCode"),document.data(),
      args.value("updatedAt",std::string()),args.value("idPrefix",std::string()));
    result["scope"]="open GarmentCode JSON import; confirm construction and sizes after conversion";
  } else if (op == "garment-code-roundtrip") {
    result["summary"]=garment::garmentCodeRoundTripSummary(document.data());
  } else if (op == "seamly-parse-measurements") {
    result["library"]=garment::parseSeamlyMeasurements(args.at("xml").get<std::string>(),
      args.value("filename",std::string()));
  } else if (op == "seamly-parse-construction") {
    result["reference"]=garment::parseSeamlyConstructionReference(args.at("xml").get<std::string>(),
      args.value("filename",std::string()));
  } else if (op == "seamly-avatar-fields") {
    result["fields"]=garment::SEAMLY_AVATAR_FIELDS;
  } else if (op == "seamly-apply-measurements") {
    result["document"]=garment::applySeamlyMeasurements(document.data(),args.at("library"),
      args.value("applyToAvatar",false));
  } else if (op == "native-quality-profiles") {
    result["profiles"]=garment::NATIVE_QUALITY_PROFILES;
  } else if (op == "native-quality-resolve") {
    result["quality"]=garment::resolveNativeQuality(args.value("options",Json::object()));
  } else if (op == "native-payload-summary") {
    result["summary"]=garment::nativePayloadSummary(args.at("payload"));
  } else if (op == "native-payload-from-mesh") {
    result["payload"]=garment::buildNativeSimulationPayload(document.data(),args.at("simulation"),
      args.value("options",Json::object()));
    result["scope"]="premeshed JSON snapshot only; full JS buildSimulation dependency not yet ported";
  } else if (op == "staging-panel-positions") {
    result["positions"]=garment::staging_geometry::stagedPanelPositions(args.at("simPiece"),
      args.value("avatar",Json::object()));
    result["units"]="m";
  } else if (op == "staging-set-geometry") {
    result["staged"]=garment::staging_geometry::setStagedGeometry(args.at("geometry"),
      args.at("positions"),args.value("fitted",Json()),args.value("fitBlend",0.));
    result["scope"]="JSON geometry adapter; normals and bounding sphere require renderer recomputation";
  } else if (op == "avatar-contact-parameters") {
    result["contact"]=garment::avatarContactParameters(document.data(),args.at("piece"));
  } else if (op == "avatar-contact-candidates") {
    result["candidates"]=garment::avatarContactCandidates(args.at("simulation"),
      document.data(),args.value("options",Json::object()));
    result["scope"]="ordered contact events for injected projector; not triangle collision certification";
  } else if (op == "simulation-self-collision") {
    Json simulation=args.at("simulation");
    garment::resolveSelfCollisions(simulation,args.value("minimumDistance",.02));
    result["simulation"]=std::move(simulation);
    result["scope"]="JSON spatial-hash self collision adapter; no triangle CCD or factory fit certification";
  } else if (op == "drape-capture") {
    result["snapshot"]=garment::captureDrape(args.at("simulation"));
  } else if (op == "drape-transfer") {
    Json simulation=args.at("simulation");
    result["stats"]=garment::transferDrape(args.value("snapshot",Json()),simulation,
      args.value("maxOffsetM",.035),args.value("validation",Json::object()));
    result["simulation"]=std::move(simulation);
    result["scope"]="JSON particle adapter; custom JS callbacks and live seam references require integration";
  } else if (op == "drape-seam-gap") {
    result["gap"]=garment::measureSeamGap(args.at("simulation"));
  } else if (op == "drape-capture-positions") {
    result["snapshot"]=garment::captureParticlePositions(args.at("simulation"));
  } else if (op == "drape-restore-positions") {
    Json simulation=args.at("simulation");
    garment::restoreParticlePositions(args.at("snapshot"),simulation);
    result["simulation"]=std::move(simulation);
  } else if (op == "mesh-optimize-quality") {
    result["mesh"]=garment::optimizeTriangleQuality(args.at("mesh"),
      args.value("options",Json::object()));
    result["scope"]="conservative interior triangle edge flips, authored pattern and boundary unchanged";
  } else if (op == "project-geometry") {
    const auto method=args.at("method").get<std::string>();
    const Json piece=args.value("piece",Json::object());
    const Json geometryProject=args.value("project",document.data());
    const int index=args.value("edgeIndex",0),segments=args.value("segments",8);
    namespace pg=garment::project_geometry;
    if(method=="polygonArea") result["value"]=pg::polygonArea(args.value("points",Json::array()));
    else if(method=="sampleEdge") result["value"]=pg::sampleEdge(piece,index,segments);
    else if(method=="samplePieceBoundary") result["value"]=pg::samplePieceBoundary(piece,segments);
    else if(method=="getEdgeSeamAllowance") result["value"]=pg::getEdgeSeamAllowance(piece,index);
    else if(method=="seamAllowanceBoundary") result["value"]=pg::seamAllowanceBoundary(piece,segments);
    else if(method=="pieceArea") result["value"]=pg::pieceArea(piece);
    else if(method=="projectArea") result["value"]=pg::projectArea(geometryProject);
    else if(method=="edgeLength") result["value"]=pg::edgeLength(piece,index);
    else if(method=="edgeRangeLength") result["value"]=pg::edgeRangeLength(piece,index,args.value("startT",0.),args.value("endT",1.));
    else if(method=="edgePointAt") result["value"]=pg::edgePointAt(piece,index,args.value("fraction",.5),segments);
    else if(method=="facingGeometryForEdge") result["value"]=pg::facingGeometryForEdge(piece,index,args.value("widthCm",5.));
    else if(method=="closestEdgeFraction") result["value"]=pg::closestEdgeFraction(piece,index,args.at("point"),segments);
    else if(method=="seamLengthReport") result["value"]=pg::seamLengthReport(geometryProject,args.at("seam"));
    else if(method=="seamWalkReport") result["value"]=pg::seamWalkReport(geometryProject,args.at("seam"),args.value("sampleCount",25));
    else throw std::invalid_argument("unknown project geometry operation");
    result["units"]="cm";
  } else if (op == "fabric-normalize-optics") {
    result["optics"]=garment::normalizeFabricOptics(args.value("fabric",Json::object()));
  } else if (op == "fabric-albedo-multiplier") {
    result["multiplier"]=garment::textileAlbedoMultiplier(args.value("family",std::string()),
      args.value("u",0.),args.value("v",0.),args.value("variation",.25));
  } else if (op == "fabric-pbr-classify-file") {
    result["mapType"]=garment::classifyFabricPbrFilename(args.at("filename").get<std::string>());
  } else if (op == "simulation-build-request") {
    result["request"]=garment::buildSimulationRequest(document.data(),args.value("options",Json::object()));
  } else if (op == "simulation-validate-request") {
    result["validation"]=garment::validateSimulationRequest(args.at("request"));
  } else if (op == "simulation-serialize-request") {
    result["serialized"]=garment::serializeSimulationRequest(args.at("request"));
  } else if (op == "simulation-backend-summary") {
    result["summary"]=garment::backendResultSummary(args.value("result",Json::object()));
  } else if (op == "simulation-fit-quality") {
    result["assessment"]=garment::assessSimulationFit(args.value("quality",Json::object()),
      args.value("options",Json::object()));
    result["factoryApproved"]=false;
  } else if (op == "simulation-mesh-quality") {
    result["report"]=garment::inspectClothMesh(args.value("vertices",Json::array()),
      args.value("faces",Json::array()),args.value("options",Json::object()));
  } else if (op == "simulation-timestep") {
    result["timestep"]=garment::resolveSolverTimestep(args.value("settings",Json::object()),
      args.value("dt",1./60.),args.value("maxThickness",.002));
  } else if (op == "sewing-endpoint-interval") {
    result["interval"]=garment::seamEndpointInterval(args.at("endpoint"));
  } else if (op == "sewing-endpoint-overlap") {
    result["overlap"]=garment::seamEndpointOverlap(args.at("a"),args.at("b"),
      args.value("epsilon",1e-5));
  } else if (op == "sewing-validate") {
    result["validation"]=garment::validateNewSeam(document.data(),args.at("seam"),
      args.value("options",Json::object()));
    result["scope"]="native sewing validation, not physical seam fit certification";
  } else if (op == "sewing-audit") {
    result["audit"]=garment::auditSewingConstruction(document.data(),
      args.value("options",Json::object()));
  } else if (op == "trim-offset-edge") {
    result["path"]=garment::offsetEdgePath(args.at("piece"),
      args.at("edgeIndex").get<int>(),args.value("offsetCm",0.),
      args.value("segments",28));
    result["units"]="cm";
  } else if (op == "trim-topstitch-paths") {
    result["paths"]=garment::topstitchPaths(args.at("piece"),args.at("topstitch"));
    result["units"]="cm";
  } else if (op == "trim-zipper-paths") {
    result["paths"]=garment::zipperPaths(args.at("piece"),args.at("zipper"));
    result["units"]="cm";
  } else if (op == "trim-piece-center") {
    result["center"]=garment::pieceCenter(args.at("piece"));
    result["units"]="cm";
  } else if (op == "trim-summary") {
    result["summary"]=garment::trimSummary(document.data());
  } else if (op == "cloth-simplify-boundary") {
    result["boundary"]=garment::simplifiedClothBoundary(args.at("source"),args.value("toleranceCm",.08));
    result["units"]="cm";
    result["scope"]="simulation contour copy only; original authored cutlines remain unchanged";
  } else if (op == "cloth-boundary-deviation") {
    result["deviationCm"]=garment::measureClothBoundaryDeviation(args.at("source"),args.at("simplified"));
    result["units"]="cm";
  } else if (op == "draft-inspect-topology") {
    result["topology"]=garment::inspectDraftTopology(args.at("piece"),
      args.value("options",Json::object()));
    result["units"]="cm";
  } else if (op == "draft-is-edit-valid") {
    result["valid"]=garment::isDraftEditValid(args.at("piece"),
      args.value("edit",Json::object()),args.value("options",Json::object()));
  } else if (op == "draft-unfold") {
    result["unfold"]=garment::unfoldDraftPiece(args.at("piece"),
      args.at("foldEdgeIndex").get<int>());
    result["units"]="cm";
  } else if (op == "merge-mesh-face-selection") {
    result["selection"] = garment::mergeMeshFaceSelection(args.value("previous",Json()),
      args.value("pieceId",Json()),args.value("faceIndex",Json()),args.value("face",Json()),
      args.value("additive",false));
  } else if (op == "draft-split-fractions") {
    result["fractions"]=garment::draftingSplitFractions(args.at("piece"),
      args.at("edgeIndex").get<int>(),args.value("options",Json::object()));
    result["units"]="cm";
  } else if (op == "draft-split-parameter") {
    result["parameter"]=garment::splitParameterAtArcFraction(args.at("piece"),
      args.at("edgeIndex").get<int>(),args.at("fraction").get<double>());
    result["units"]="cm";
  } else if (op == "draft-split-modes") {
    result["modes"]=garment::draftingSplitModes();
  } else if (op == "draft-snap-grid") {
    result["point"] = garment::snapDraftGrid(args.at("point"),args.value("spacingCm",1.0),
      args.value("origin",Json{{"x",0.0},{"y",0.0}}));
    result["units"] = "cm";
  } else if (op == "draft-nearest-segment") {
    result["point"] = garment::nearestOnDraftSegment(args.at("point"),args.at("a"),args.at("b"));
    result["units"] = "cm";
  } else if (op == "draft-snap-pattern") {
    result["snap"] = garment::snapDraftPattern(args.at("point"),document.data().at("pieces"),args);
    result["units"] = "cm";
  } else if (op == "draft-constrain-axis") {
    result["point"] = garment::constrainDraftAxis(args.at("start"),args.at("destination"),
      args.value("incrementDegrees",45.0));
    result["units"] = "cm";
  } else if (op == "export-flat-obj") {
    const int segments=args.value("segmentsPerCurve",8);
    const int resolution=args.value("resolution",1);
    result["obj"]=garment::exportFlatPatternObj(document,segments,resolution);
    result["units"]="cm";
    result["fitAccepted"]=false;
    result["scope"]="native Wavefront OBJ rest meshes: XY pattern plane, Z=0; not physically sewn, simulated or avatar fitted";
  } else if (op == "export-flat-gltf") {
    const int segments=args.value("segmentsPerCurve",8);
    const int resolution=args.value("resolution",0);
    result["gltf"]=garment::exportFlatPatternGltf(document,segments,resolution);
    result["mimeType"]="model/gltf+json";
    result["units"]="m";
    result["fitAccepted"]=false;
    result["scope"]="native glTF2 rest panel meshes with basic PBR factors, UV, materials and seam identifiers; not draped or simulated";
  } else if (op == "grade-size") {
    result["document"] = garment::gradeProject(document,args.at("size").get<std::string>());
    result["scope"] = "development grading: review sewing, shrinkage and factory size specifications before production";
  } else if (op == "grade-run") {
    result["sizes"] = garment::gradeSizeRun(document);
    result["scope"] = "development size run: not certified factory grading";
  } else if (op == "marker-size") {
    const auto size = args.value("size",std::string());
    if (size.empty()) result["markers"] = garment::buildFabricMarkers(document);
    else {
      Document sized(garment::gradeProject(document,size));
      result["markers"] = garment::buildFabricMarkers(sized);
      result["size"] = size;
    }
    result["factoryCertified"] = false;
    result["scope"] = "rectangle-packing development marker; not a certified factory nest";
  } else if (op == "marker-run") {
    result["markersBySize"] = garment::buildMarkerSizeRun(document);
    result["factoryCertified"] = false;
    result["scope"] = "all-size development markers; not a certified factory nest";
  } else if (op == "export-marker-svg") {
    const std::string size=args.value("size",std::string());
    Document graded(size.empty()?document.data():garment::gradeProject(document,size));
    const auto markers=garment::buildFabricMarkers(graded);
    if (markers.empty()) throw std::invalid_argument("no marker fabrics found");
    const std::string fabricId=args.value("fabricId",markers.begin().key());
    if (!markers.contains(fabricId)) throw std::invalid_argument("unknown marker fabric: "+fabricId);
    result["svg"] = garment::markerToSvg(markers.at(fabricId),
      size.empty()?document.data().value("previewSize",std::string("BASE")):size,
      args.value("fabricName",fabricId),graded.data());
    result["fabricId"]=fabricId;
    result["factoryCertified"]=false;
    result["scope"]="centimeter true-size development SVG with cut lines and annotations; not factory cutter approval";
  } else if (op == "factory-full-development-summary" ||
             op == "export-factory-full-development-zip") {
    const std::string raw=args.value("projectJson",document.data().dump());
    const auto ordered=garment::factory_package_files::Json::parse(raw);
    if(garment::Json::parse(ordered.dump())!=document.data())
      throw std::invalid_argument("factory source must match the active garment document");
    const auto package=garment::factory_package_files::buildFactoryPackageFiles(ordered);
    result["fileCount"]=package.files.size();
    result["files"]=Json::array();
    std::vector<garment::FactoryZipEntry> entries;
    entries.reserve(package.files.size());
    for(const auto& entry:package.files){
      result["files"].push_back({{"path",entry.first},{"bytes",entry.second.size()}});
      entries.push_back({entry.first,entry.second});
    }
    result["missing"]=garment::Json::parse(package.missing.dump());
    result["factoryCertified"]=false;
    result["exactContentParity"]=false;
    result["scope"]="complete standalone experimental native package files; JS byte equality remains incomplete for graded DXF, some PDF and numerical production metadata";
    if(op=="export-factory-full-development-zip") {
      if(!package.missing.empty()&&!args.value("allowIncomplete",false))
        throw std::invalid_argument("factory package has missing required entries; set allowIncomplete=true for a labeled development archive");
      const auto zip=garment::buildStoredZip(entries);
      result["zipBase64"]=toBase64(zip);
      result["byteCount"]=zip.size();
    }
  } else if (op == "export-factory-zip") {
    const std::string archive=garment::buildNativeFactoryZip(document);
    result["zipBase64"]=toBase64(archive);
    result["byteCount"]=archive.size();
    result["factoryCertified"]=false;
    result["scope"]="ZIP32 stored native development DXF, SVG, PDF, BOM, measurements, tech pack, fabric cost and preflight; not factory acceptance";
  } else if (op == "export-marker-pdf") {
    const std::string size=args.value("size",std::string());
    Document graded(size.empty()?document.data():garment::gradeProject(document,size));
    const auto markers=garment::buildFabricMarkers(graded);
    if (markers.empty()) throw std::invalid_argument("no marker fabrics found");
    const std::string fabricId=args.value("fabricId",markers.begin().key());
    if (!markers.contains(fabricId)) throw std::invalid_argument("unknown marker fabric: "+fabricId);
    const auto pdf=garment::markerToPdf(markers.at(fabricId),
      size.empty()?document.data().value("previewSize",std::string("BASE")):size,
      args.value("pageLengthCm",400.),graded.data());
    result["pdfBase64"]=toBase64(pdf);
    result["byteCount"]=pdf.size();
    result["fabricId"]=fabricId;
    result["mimeType"]="application/pdf";
    result["factoryCertified"]=false;
    result["scope"]="native true-size marker PDF plot, not factory cutter acceptance";
  } else if (op == "production-preflight") {
    result["preflight"] = garment::inspectProduction(document.data(),args.value("allSizes",true));
    result["scope"] = "structural manufacturing checks, not independent factory acceptance";
  } else if (op == "fabric-cost-run") {
    result["report"] = garment::buildFabricCostRun(document);
    result["scope"] = "native marker-based fabric cost estimate; excludes labor and trim";
  } else if (op == "fabric-cost-csv") {
    result["csv"] = garment::fabricCostRunToCsv(garment::buildFabricCostRun(document));
    result["scope"] = "native fabric consumption estimate CSV; not purchase order or factory certification";
  } else if (op == "export-bom") {
    result["xml"] = garment::exportBomXml(document);
    result["schemaVersion"] = "1.0";
    result["factoryCertified"] = false;
    result["scope"] = "open Garment Studio BOM XML; not a proprietary CLO format or supplier purchase order";
  } else if (op == "measure-project") {
    result["measurements"] = garment::measureProject(document);
    result["units"] = "cm";
    result["scope"] = "2D pattern points of measure; not a physical body-fit certification";
  } else if (op == "measure-run") {
    result["sizes"] = garment::buildMeasurementSizeRun(document);
    result["units"] = "cm";
    result["scope"] = "graded 2D POM measurements; not a certified factory specification";
  } else if (op == "export-pom-csv") {
    result["csv"] = garment::measurementRunToCsv(document);
    result["units"] = "cm";
    result["scope"] = "graded POM development CSV; not a certified factory specification";
  } else if (op == "export-tech-pack") {
    result["techPack"] = garment::buildTechPack(document);
    result["factoryCertified"] = false;
    result["fitAccepted"] = false;
    result["scope"] = "native structured garment tech pack; independent factory acceptance and fit validation required";
  } else if (op == "clothcraft-export") {
    const auto size = args.value("size",std::string());
    if (size.empty()) {
      result["interchange"] = garment::exportClothCraftTemplate(document);
    } else {
      Document sized(garment::gradeProject(document,size));
      result["interchange"] = garment::exportClothCraftTemplate(sized);
      result["size"] = size;
    }
  } else if (op == "ppf-preflight") {
    if (!args.contains("payload")) throw std::invalid_argument("ppf-preflight needs args.payload");
    result["preflight"] = garment::PpfBridge::validateInitialShell(
      args.at("payload"), args.value("deformation", Json::object()));
  } else if (op == "ppf-health") {
    result["service"] = garment::PpfService::health();
  } else if (op == "ppf-submit") {
    result["job"] = garment::PpfService::submit(document.data(), args.value("frames",10));
    result["fitAccepted"] = false;
  } else if (op == "ppf-jobs") {
    result["jobs"] = garment::PpfService::jobs();
  } else if (op == "ppf-preview") {
    result["preview"] = garment::PpfService::validatedPreview(args.at("id").get<std::string>());
  } else if (op == "ppf-job") {
    result["job"] = garment::PpfService::job(args.at("id").get<std::string>());
  } else if (op == "ppf-fit-evidence") {
    result["fitAcceptance"] = garment::PpfBridge::evaluateFitEvidence(args);
  } else if (op == "ppf-job-envelope") {
    result["endpoint"] = std::string(garment::PpfBridge::kServiceUrl) + "/jobs";
    result["envelope"] = garment::PpfBridge::makeJobEnvelope(document.data(),args.value("frames",10));
    result["warning"] = "Envelope creation does not initiate Rust PPF or establish a successful fit";
  } else if (op == "edit") {
    auto expected = request.contains("expectedRevision") ? request.at("expectedRevision").get<int>() : -1;
    auto tx = document.apply(request.at("command").get<std::string>(), args, expected);
    result["changed"] = tx.changed;
    result["beforeRevision"] = tx.beforeRevision;
    result["afterRevision"] = tx.afterRevision;
    result["document"] = document.data();
    if (request.value("includeUndo", false)) result["undoSnapshot"] = tx.inverseSnapshot;
  } else {
    throw std::invalid_argument("unknown native CAD API method: " + op);
  }
  return result;
}

}  // namespace

int main(int argc, char** argv) {
  if (argc > 1 && std::string(argv[1]) == "--version") {
    std::cout << "garment-studio.native-cad.v1 C++17\n";
    return 0;
  }
  // NDJSON request/response: deterministic, process-isolated bridge for the
  // legacy workspace, Qt editor, Python test harness and future automation.
  std::string line;
  while (std::getline(std::cin, line)) {
    if (line.empty()) continue;
    try {
      auto response = execute(Json::parse(line));
      std::cout << response.dump(-1, ' ', false, Json::error_handler_t::replace) << '\n';
    } catch (const std::exception& ex) {
      std::cout << Json({{"protocol", "garment-studio.native-cad.v1"},
                         {"ok", false}, {"error", ex.what()}}).dump() << '\n';
    }
  }
  return 0;
}
