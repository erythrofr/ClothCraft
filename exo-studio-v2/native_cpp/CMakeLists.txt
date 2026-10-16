cmake_minimum_required(VERSION 3.20)
project(GarmentStudioNative LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

add_library(garment_cad_core STATIC core/garment_document.cpp core/dxf_export.cpp core/dxf_import.cpp core/construction_dxf.cpp core/cutting_geometry.cpp core/grading.cpp core/marker_layout.cpp core/marker_svg.cpp core/marker_pdf.cpp core/factory_zip.cpp core/production_preflight.cpp core/fabric_cost.cpp core/bom_export.cpp core/measurement_export.cpp core/tech_pack_export.cpp core/clothcraft_export.cpp core/pattern_mesh.cpp core/obj_export.cpp core/gltf_export.cpp solver/ppf_bridge.cpp)
target_include_directories(garment_cad_core PUBLIC "${CMAKE_CURRENT_SOURCE_DIR}/core"
                                                "${CMAKE_CURRENT_SOURCE_DIR}/solver"
                                                "${CMAKE_CURRENT_SOURCE_DIR}/vendor")
target_sources(garment_cad_core PRIVATE core/drafting_snapping.cpp)
target_sources(garment_cad_core PRIVATE core/auto_fit_placement.cpp)
target_sources(garment_cad_core PRIVATE core/drafting_precision.cpp core/drafting_constructions.cpp)
target_sources(garment_cad_core PRIVATE core/drafting_split.cpp)
target_sources(garment_cad_core PRIVATE core/mesh_selection.cpp)
target_sources(garment_cad_core PRIVATE core/drafting_topology.cpp core/drafting_unfold.cpp)
target_sources(garment_cad_core PRIVATE core/cloth_meshing.cpp)
target_sources(garment_cad_core PRIVATE core/trims.cpp)
target_sources(garment_cad_core PRIVATE core/sewing_construction.cpp)
target_sources(garment_cad_core PRIVATE core/simulation_quality.cpp)
target_sources(garment_cad_core PRIVATE core/simulation_protocol.cpp)
target_sources(garment_cad_core PRIVATE core/fabric_surface.cpp)
target_sources(garment_cad_core PRIVATE core/project_geometry.cpp core/quality_triangulation.cpp)
target_sources(garment_cad_core PRIVATE core/live_drape_transfer.cpp)
target_sources(garment_cad_core PRIVATE core/self_collision.cpp)
target_sources(garment_cad_core PRIVATE core/avatar_contact_pass.cpp)
target_sources(garment_cad_core PRIVATE core/staging_geometry.cpp)
target_sources(garment_cad_core PRIVATE core/native_payload.cpp)
find_package(LibXml2 REQUIRED)
target_sources(garment_cad_core PRIVATE core/seamly_import.cpp)
target_sources(garment_cad_core PRIVATE core/garment_code.cpp)
target_sources(garment_cad_core PRIVATE core/mesh_avatar_contact.cpp core/native_seam_assembly.cpp)
target_sources(garment_cad_core PRIVATE core/backend_registry.cpp)
target_sources(garment_cad_core PRIVATE core/native_backend_session.cpp)
target_sources(garment_cad_core PRIVATE core/ppf_payload.cpp)
target_sources(garment_cad_core PRIVATE core/fabric_pbr_pixels.cpp)
target_sources(garment_cad_core PRIVATE core/fabric_pbr_image_generator.cpp)
target_sources(garment_cad_core PRIVATE core/fabric_pbr_source_image.cpp)
if(APPLE)
  find_library(GARMENT_COREFOUNDATION_FRAMEWORK CoreFoundation REQUIRED)
  find_library(GARMENT_COREGRAPHICS_FRAMEWORK CoreGraphics REQUIRED)
  find_library(GARMENT_IMAGEIO_FRAMEWORK ImageIO REQUIRED)
  target_link_libraries(garment_cad_core PUBLIC
    ${GARMENT_COREFOUNDATION_FRAMEWORK}
    ${GARMENT_COREGRAPHICS_FRAMEWORK}
    ${GARMENT_IMAGEIO_FRAMEWORK})
endif()
target_sources(garment_cad_core PRIVATE core/avatar_physics.cpp)
target_sources(garment_cad_core PRIVATE core/avatar_contact_kernel.cpp)
target_sources(garment_cad_core PRIVATE core/cloth_simulation.cpp)
target_sources(garment_cad_core PRIVATE core/cloth_solver_step_extended.cpp)
target_sources(garment_cad_core PRIVATE core/cloth_solver_step_contacts.cpp)
target_sources(garment_cad_core PRIVATE core/grading_helpers.cpp)
target_sources(garment_cad_core PRIVATE core/avatar_surface_correction.cpp)
target_sources(garment_cad_core PRIVATE core/cloth_meshing_pipeline.cpp)
target_sources(garment_cad_core PRIVATE core/native_assembly_preflight.cpp)
target_sources(garment_cad_core PRIVATE core/native_solver_acceptance.cpp)
target_sources(garment_cad_core PRIVATE core/cloth_seam_constraints.cpp)
target_sources(garment_cad_core PRIVATE core/workspace_profiles.cpp)
target_sources(garment_cad_core PRIVATE core/workspace_command_index.cpp)
target_sources(garment_cad_core PRIVATE core/cloth_analysis.cpp)
target_sources(garment_cad_core PRIVATE core/textile_procedurals.cpp)
target_sources(garment_cad_core PRIVATE core/assembled_cloth_snapshot.cpp)
target_sources(garment_cad_core PRIVATE core/authored_simulation_builder.cpp)
target_sources(garment_cad_core PRIVATE core/optimized_authored_snapshot.cpp)
target_sources(garment_cad_core PRIVATE core/geometry_buffer_adapter.cpp)
target_sources(garment_cad_core PRIVATE core/visual_only_fingerprints.cpp)
target_sources(garment_cad_core PRIVATE core/project_utilities.cpp)
target_sources(garment_cad_core PRIVATE core/native_simulation_payload_builder.cpp)
target_sources(garment_cad_core PRIVATE core/marker_exact.cpp)
target_sources(garment_cad_core PRIVATE core/clo_menus.cpp)
target_sources(garment_cad_core PRIVATE core/native_service_client.cpp)
target_sources(garment_cad_core PRIVATE core/ppf_service_client.cpp)
target_sources(garment_cad_core PRIVATE core/zozo_reference_dress.cpp)
target_sources(garment_cad_core PRIVATE core/seam_assembly_parity_bridge.cpp)
target_sources(garment_cad_core PRIVATE core/seam_assembly_advanced.cpp)
target_sources(garment_cad_core PRIVATE core/factory_package_files.cpp)
target_sources(garment_cad_core PRIVATE core/graded_geometry_parity_bridge.cpp)
target_link_libraries(garment_cad_core PUBLIC LibXml2::LibXml2)
target_compile_options(garment_cad_core PRIVATE -Wall -Wextra -Wpedantic)

add_executable(garment_cad_cli cli/main.cpp)
find_package(CURL REQUIRED)
target_link_libraries(garment_cad_core PUBLIC CURL::libcurl)
add_library(garment_ppf_service STATIC solver/ppf_service.cpp)
target_link_libraries(garment_ppf_service PUBLIC garment_cad_core CURL::libcurl)
target_compile_options(garment_ppf_service PRIVATE -Wall -Wextra -Wpedantic)
target_link_libraries(garment_cad_cli PRIVATE garment_cad_core garment_ppf_service)

enable_testing()
add_executable(native_document_tests tests/test_document.cpp)
target_link_libraries(native_document_tests PRIVATE garment_cad_core)
add_test(NAME native_document_transactions COMMAND native_document_tests)

add_executable(native_pattern_mesh_tests tests/test_pattern_mesh.cpp)
target_link_libraries(native_pattern_mesh_tests PRIVATE garment_cad_core)
add_test(NAME native_pattern_mesh COMMAND native_pattern_mesh_tests)

add_executable(native_drafting_snapping_tests tests/test_drafting_snapping.cpp)
target_link_libraries(native_drafting_snapping_tests PRIVATE garment_cad_core)
add_test(NAME native_drafting_snapping COMMAND native_drafting_snapping_tests)

add_executable(native_auto_fit_placement_tests tests/test_auto_fit_placement.cpp)
target_link_libraries(native_auto_fit_placement_tests PRIVATE garment_cad_core)
add_test(NAME native_auto_fit_placement COMMAND native_auto_fit_placement_tests)

add_executable(native_drafting_precision_tests tests/test_drafting_precision.cpp)
target_link_libraries(native_drafting_precision_tests PRIVATE garment_cad_core)
add_test(NAME native_drafting_precision COMMAND native_drafting_precision_tests)

add_executable(native_drafting_constructions_tests tests/test_drafting_constructions.cpp)
target_link_libraries(native_drafting_constructions_tests PRIVATE garment_cad_core)
add_test(NAME native_drafting_constructions COMMAND native_drafting_constructions_tests)

add_executable(native_drafting_split_tests tests/test_drafting_split.cpp)
target_link_libraries(native_drafting_split_tests PRIVATE garment_cad_core)
add_test(NAME native_drafting_split COMMAND native_drafting_split_tests)

add_executable(native_mesh_selection_tests tests/test_mesh_selection.cpp)
target_link_libraries(native_mesh_selection_tests PRIVATE garment_cad_core)
add_test(NAME native_mesh_selection COMMAND native_mesh_selection_tests)

add_executable(native_drafting_topology_unfold_tests tests/test_drafting_topology_unfold.cpp)
target_link_libraries(native_drafting_topology_unfold_tests PRIVATE garment_cad_core)
add_test(NAME native_drafting_topology_unfold COMMAND native_drafting_topology_unfold_tests)

add_executable(native_cloth_meshing_tests tests/test_cloth_meshing.cpp)
target_link_libraries(native_cloth_meshing_tests PRIVATE garment_cad_core)
add_test(NAME native_cloth_meshing COMMAND native_cloth_meshing_tests)

add_executable(native_trims_tests tests/test_trims.cpp)
target_link_libraries(native_trims_tests PRIVATE garment_cad_core)
add_test(NAME native_trims COMMAND native_trims_tests)

add_executable(native_simulation_quality_tests tests/test_simulation_quality.cpp)
target_link_libraries(native_simulation_quality_tests PRIVATE garment_cad_core)
add_test(NAME native_simulation_quality COMMAND native_simulation_quality_tests)

add_executable(native_fabric_surface_tests tests/test_fabric_surface.cpp)
target_link_libraries(native_fabric_surface_tests PRIVATE garment_cad_core)
add_test(NAME native_fabric_surface COMMAND native_fabric_surface_tests)

add_executable(native_live_drape_transfer_tests tests/test_live_drape_transfer.cpp)
target_link_libraries(native_live_drape_transfer_tests PRIVATE garment_cad_core)
add_test(NAME native_live_drape_transfer COMMAND native_live_drape_transfer_tests)

add_executable(native_quality_triangulation_tests tests/test_quality_triangulation.cpp)
target_link_libraries(native_quality_triangulation_tests PRIVATE garment_cad_core)
add_test(NAME native_quality_triangulation COMMAND native_quality_triangulation_tests)

add_executable(native_self_collision_tests tests/test_self_collision.cpp)
target_link_libraries(native_self_collision_tests PRIVATE garment_cad_core)
add_test(NAME native_self_collision COMMAND native_self_collision_tests)

add_executable(native_payload_tests tests/test_native_payload.cpp)
target_link_libraries(native_payload_tests PRIVATE garment_cad_core)
add_test(NAME native_payload COMMAND native_payload_tests)

add_executable(native_seamly_import_tests tests/test_seamly_import.cpp)
target_link_libraries(native_seamly_import_tests PRIVATE garment_cad_core)
add_test(NAME native_seamly_import COMMAND native_seamly_import_tests)

add_executable(native_garment_code_tests tests/test_garment_code.cpp)
target_link_libraries(native_garment_code_tests PRIVATE garment_cad_core)
add_test(NAME native_garment_code COMMAND native_garment_code_tests)

add_executable(native_mesh_avatar_contact_tests tests/test_mesh_avatar_contact.cpp)
target_link_libraries(native_mesh_avatar_contact_tests PRIVATE garment_cad_core)
add_test(NAME native_mesh_avatar_contact COMMAND native_mesh_avatar_contact_tests)

add_executable(native_seam_assembly_tests tests/test_native_seam_assembly.cpp)
target_link_libraries(native_seam_assembly_tests PRIVATE garment_cad_core)
add_test(NAME native_seam_assembly COMMAND native_seam_assembly_tests)

add_executable(native_backend_registry_tests tests/test_backend_registry.cpp)
target_link_libraries(native_backend_registry_tests PRIVATE garment_cad_core)
add_test(NAME native_backend_registry COMMAND native_backend_registry_tests)

add_executable(native_ppf_payload_tests tests/test_ppf_payload.cpp)
target_link_libraries(native_ppf_payload_tests PRIVATE garment_cad_core)
add_test(NAME native_ppf_payload COMMAND native_ppf_payload_tests)

add_executable(native_fabric_pbr_pixels_tests tests/test_fabric_pbr_pixels.cpp)
target_link_libraries(native_fabric_pbr_pixels_tests PRIVATE garment_cad_core)
add_test(NAME native_fabric_pbr_pixels COMMAND native_fabric_pbr_pixels_tests)

add_executable(native_fabric_pbr_image_generator_tests tests/test_fabric_pbr_image_generator.cpp)
target_link_libraries(native_fabric_pbr_image_generator_tests PRIVATE garment_cad_core)
add_test(NAME native_fabric_pbr_image_generator COMMAND native_fabric_pbr_image_generator_tests)

add_executable(native_fabric_pbr_source_image_tests tests/test_fabric_pbr_source_image.cpp)
target_link_libraries(native_fabric_pbr_source_image_tests PRIVATE garment_cad_core)
add_test(NAME native_fabric_pbr_source_image COMMAND native_fabric_pbr_source_image_tests)

add_executable(native_cloth_solver_step_extended_tests tests/test_cloth_solver_step_extended.cpp)
target_link_libraries(native_cloth_solver_step_extended_tests PRIVATE garment_cad_core)
add_test(NAME native_cloth_solver_step_extended COMMAND native_cloth_solver_step_extended_tests)

add_executable(native_avatar_contact_kernel_tests tests/test_avatar_contact_kernel.cpp)
target_link_libraries(native_avatar_contact_kernel_tests PRIVATE garment_cad_core)
add_test(NAME native_avatar_contact_kernel COMMAND native_avatar_contact_kernel_tests)

add_executable(native_authored_simulation_builder_tests tests/test_authored_simulation_builder.cpp)
target_link_libraries(native_authored_simulation_builder_tests PRIVATE garment_cad_core)

add_executable(native_backend_session_tests tests/test_native_backend_session.cpp)
target_link_libraries(native_backend_session_tests PRIVATE garment_cad_core)
add_test(NAME native_backend_session COMMAND native_backend_session_tests)

add_executable(native_avatar_physics_tests tests/test_avatar_physics.cpp)
target_link_libraries(native_avatar_physics_tests PRIVATE garment_cad_core)
add_test(NAME native_avatar_physics COMMAND native_avatar_physics_tests)

add_executable(native_cloth_simulation_tests tests/test_cloth_simulation.cpp)
target_link_libraries(native_cloth_simulation_tests PRIVATE garment_cad_core)
add_test(NAME native_cloth_simulation COMMAND native_cloth_simulation_tests)

add_executable(native_grading_helpers_tests tests/test_grading_helpers.cpp)
target_link_libraries(native_grading_helpers_tests PRIVATE garment_cad_core)
add_test(NAME native_grading_helpers COMMAND native_grading_helpers_tests)

add_executable(native_avatar_surface_correction_tests tests/test_avatar_surface_correction.cpp)
target_link_libraries(native_avatar_surface_correction_tests PRIVATE garment_cad_core)
add_test(NAME native_avatar_surface_correction COMMAND native_avatar_surface_correction_tests)

add_executable(native_cloth_meshing_pipeline_tests tests/test_cloth_meshing_pipeline.cpp)
target_link_libraries(native_cloth_meshing_pipeline_tests PRIVATE garment_cad_core)
add_test(NAME native_cloth_meshing_pipeline COMMAND native_cloth_meshing_pipeline_tests)

add_executable(native_assembly_preflight_tests tests/test_native_assembly_preflight.cpp)
target_link_libraries(native_assembly_preflight_tests PRIVATE garment_cad_core)
add_test(NAME native_assembly_preflight COMMAND native_assembly_preflight_tests)

add_executable(native_solver_acceptance_tests tests/test_native_solver_acceptance.cpp)
target_link_libraries(native_solver_acceptance_tests PRIVATE garment_cad_core)
add_test(NAME native_solver_acceptance COMMAND native_solver_acceptance_tests)

add_executable(native_cloth_seam_constraints_tests tests/test_cloth_seam_constraints.cpp)
target_link_libraries(native_cloth_seam_constraints_tests PRIVATE garment_cad_core)
add_test(NAME native_cloth_seam_constraints COMMAND native_cloth_seam_constraints_tests)

add_executable(native_workspace_profiles_tests tests/test_workspace_profiles.cpp)
target_link_libraries(native_workspace_profiles_tests PRIVATE garment_cad_core)
add_test(NAME native_workspace_profiles COMMAND native_workspace_profiles_tests)

add_executable(native_workspace_command_index_tests tests/test_workspace_command_index.cpp)
target_link_libraries(native_workspace_command_index_tests PRIVATE garment_cad_core)
add_test(NAME native_workspace_command_index COMMAND native_workspace_command_index_tests)

add_executable(native_cloth_analysis_tests tests/test_cloth_analysis.cpp)
target_link_libraries(native_cloth_analysis_tests PRIVATE garment_cad_core)
add_test(NAME native_cloth_analysis COMMAND native_cloth_analysis_tests)

add_executable(native_textile_procedurals_tests tests/test_textile_procedurals_smoke.cpp)
target_link_libraries(native_textile_procedurals_tests PRIVATE garment_cad_core)
add_test(NAME native_textile_procedurals COMMAND native_textile_procedurals_tests)

add_executable(native_assembled_cloth_snapshot_tests tests/test_assembled_cloth_snapshot.cpp)
target_link_libraries(native_assembled_cloth_snapshot_tests PRIVATE garment_cad_core)
add_test(NAME native_assembled_cloth_snapshot COMMAND native_assembled_cloth_snapshot_tests)

add_executable(native_geometry_buffer_adapter_tests tests/test_geometry_buffer_adapter_smoke.cpp)
target_link_libraries(native_geometry_buffer_adapter_tests PRIVATE garment_cad_core)
add_test(NAME native_geometry_buffer_adapter COMMAND native_geometry_buffer_adapter_tests)

add_executable(native_visual_only_fingerprints_tests tests/test_visual_only_fingerprints_smoke.cpp)
target_link_libraries(native_visual_only_fingerprints_tests PRIVATE garment_cad_core)
add_test(NAME native_visual_only_fingerprints COMMAND native_visual_only_fingerprints_tests)

add_executable(native_project_utilities_tests tests/test_project_utilities_smoke.cpp)
target_link_libraries(native_project_utilities_tests PRIVATE garment_cad_core)
add_test(NAME native_project_utilities COMMAND native_project_utilities_tests)

add_executable(native_simulation_payload_builder_tests tests/test_native_simulation_payload_builder_smoke.cpp)
target_link_libraries(native_simulation_payload_builder_tests PRIVATE garment_cad_core)
add_test(NAME native_simulation_payload_builder COMMAND native_simulation_payload_builder_tests)

add_executable(native_marker_exact_tests tests/test_marker_exact_smoke.cpp)
target_link_libraries(native_marker_exact_tests PRIVATE garment_cad_core)
add_test(NAME native_marker_exact COMMAND native_marker_exact_tests)

add_executable(native_clo_menus_tests tests/test_clo_menus.cpp)
target_link_libraries(native_clo_menus_tests PRIVATE garment_cad_core)
add_test(NAME native_clo_menus COMMAND native_clo_menus_tests)

add_executable(native_service_client_tests tests/test_native_service_client_smoke.cpp)
target_link_libraries(native_service_client_tests PRIVATE garment_cad_core)
add_test(NAME native_service_client COMMAND native_service_client_tests)

add_executable(native_ppf_service_client_tests tests/test_ppf_service_client_smoke.cpp)
target_link_libraries(native_ppf_service_client_tests PRIVATE garment_cad_core)
add_test(NAME native_ppf_service_client COMMAND native_ppf_service_client_tests)

add_executable(native_zozo_reference_dress_tests tests/test_zozo_reference_dress.cpp)
target_link_libraries(native_zozo_reference_dress_tests PRIVATE garment_cad_core)
add_test(NAME native_zozo_reference_dress COMMAND native_zozo_reference_dress_tests)
set_tests_properties(native_zozo_reference_dress PROPERTIES
  WORKING_DIRECTORY "${CMAKE_CURRENT_SOURCE_DIR}/..")

add_executable(native_seam_assembly_parity_bridge_tests tests/test_seam_assembly_parity_smoke.cpp)
target_link_libraries(native_seam_assembly_parity_bridge_tests PRIVATE garment_cad_core)
add_test(NAME native_seam_assembly_parity_bridge COMMAND native_seam_assembly_parity_bridge_tests)

add_executable(native_factory_package_files_tests tests/test_factory_package_files_smoke.cpp)
target_link_libraries(native_factory_package_files_tests PRIVATE garment_cad_core)
add_test(NAME native_factory_package_files COMMAND native_factory_package_files_tests)

add_executable(native_production_preflight_tests tests/test_production_preflight.cpp)
target_link_libraries(native_production_preflight_tests PRIVATE garment_cad_core)
add_test(NAME native_production_preflight COMMAND native_production_preflight_tests)

add_executable(native_marker_svg_tests tests/test_marker_svg.cpp)
target_link_libraries(native_marker_svg_tests PRIVATE garment_cad_core)
add_test(NAME native_marker_svg COMMAND native_marker_svg_tests)

add_executable(native_factory_zip_tests tests/test_factory_zip.cpp)
target_link_libraries(native_factory_zip_tests PRIVATE garment_cad_core)
add_test(NAME native_factory_zip COMMAND native_factory_zip_tests)

add_executable(native_marker_pdf_tests tests/test_marker_pdf.cpp)
target_link_libraries(native_marker_pdf_tests PRIVATE garment_cad_core)
add_test(NAME native_marker_pdf COMMAND native_marker_pdf_tests)

add_executable(native_ppf_tests tests/test_ppf_bridge.cpp)
target_link_libraries(native_ppf_tests PRIVATE garment_cad_core)
add_test(NAME native_ppf_contract COMMAND native_ppf_tests)

option(GARMENT_BUILD_QT "Build independent native Qt6 garment CAD desktop" ON)
option(GARMENT_REQUIRE_QT "Fail configuration if the native Qt6 desktop cannot be built" OFF)
if(GARMENT_REQUIRE_QT AND NOT GARMENT_BUILD_QT)
  message(FATAL_ERROR "GARMENT_REQUIRE_QT=ON also requires GARMENT_BUILD_QT=ON")
endif()
if(GARMENT_BUILD_QT)
  find_package(Qt6 6.4 COMPONENTS Widgets QUIET)
  if(Qt6_FOUND)
    # Qt 6.8's FindWrapOpenGL on macOS adds the removed legacy AGL framework,
    # even on modern Xcode SDKs which have no AGL.tbd for linking. Widgets and
    # this app only use the standard OpenGL framework, not old AGL APIs.
    # Adjust this project's imported interface target, never the installed Qt SDK.
    if(APPLE AND TARGET WrapOpenGL::WrapOpenGL)
      get_target_property(_qt_gl_link_libraries WrapOpenGL::WrapOpenGL INTERFACE_LINK_LIBRARIES)
      if(_qt_gl_link_libraries)
        list(FILTER _qt_gl_link_libraries EXCLUDE REGEX "(^|/)AGL(\\.framework)?$|^-framework AGL$")
        set_property(TARGET WrapOpenGL::WrapOpenGL PROPERTY INTERFACE_LINK_LIBRARIES "${_qt_gl_link_libraries}")
      endif()
    endif()
    add_executable(GarmentStudioQt MACOSX_BUNDLE
      desktop/main.cpp desktop/main_window.hpp desktop/main_window.cpp
      desktop/pattern_canvas.hpp desktop/pattern_canvas.cpp
  desktop/staging_view.hpp desktop/staging_view.cpp
      desktop/zozo_reference_viewer.hpp desktop/zozo_reference_viewer.cpp)
    target_link_libraries(GarmentStudioQt PRIVATE garment_cad_core Qt6::Widgets)
    set_target_properties(GarmentStudioQt PROPERTIES
      MACOSX_BUNDLE_GUI_IDENTIFIER "com.mikristian.garmentstudio.cpp"
      MACOSX_BUNDLE_BUNDLE_NAME "Garment Studio C++"
      MACOSX_BUNDLE_SHORT_VERSION_STRING "0.1.0"
      MACOSX_BUNDLE_BUNDLE_VERSION "1")
    if(EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/examples/sample-tee.json")
      set_source_files_properties(examples/sample-tee.json PROPERTIES MACOSX_PACKAGE_LOCATION "Resources")
      target_sources(GarmentStudioQt PRIVATE examples/sample-tee.json)
    endif()
  else()
    if(GARMENT_REQUIRE_QT)
      message(FATAL_ERROR "Native Qt desktop REQUIRED but Qt6 6.4+ Widgets C++ development SDK (Qt6Config.cmake) is unavailable. The C++ core alone is not a complete application.")
    else()
      message(STATUS "Qt6 Widgets SDK not available: C++ CAD engine/tests still build; GUI target not compiled")
    endif()
  endif()
endif()
