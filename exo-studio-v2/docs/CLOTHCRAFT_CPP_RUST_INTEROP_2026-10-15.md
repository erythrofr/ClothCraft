# ClothCraft compatibility: C++ exporter milestone

An additive C++ conversion operation, `clothcraft-export`, translates the canonical Garment Studio document into a proposed ClothCraft v2 template. The original document remains unchanged. Initial native builds and conversion tests pass for the four-panel sample T-shirt, including 14 seam references and 18 quadratic-to-cubic curves.

This is **interchange-only**: it does not claim ClothCraft Rust loader acceptance, Mac/Vulkan/Metal compatibility, body fitting, matched physical fabrics, or a successful drape. It stages panels separately rather than transferring unreliable body-relative 3D positions. It warns that seam allowances, notches, manufacturing metadata and avatar fitting are not represented; ClothCraft physics uses uncalibrated reference stiffness coefficients.

Run `bash native_cpp/scripts/build_and_test.sh` followed by `node scripts/check-clothcraft-interchange.mjs`. `clothcraft-export` uses the existing native CAD NDJSON protocol with an explicit `document` and returns `interchange.template` plus warnings and fail-closed evidence flags.

Next gates: (1) validate emitted template against ClothCraft's compiled Rust `cloth-template validate` CLI; (2) compare sewing arclengths and ensure no overlapping seam ownership under the upstream compiler; (3) verify a single-cloth, collision-free starting assembly; (4) build/test the Rust engine on the target Apple Silicon platform; (5) introduce a versioned process bridge with lifecycle/status/cancellation; (6) map ClothCraft output geometry back into an independently validated Garment Studio viewport; (7) compare it against our existing XPBD/PPF reference scenes and only promote if full-frame fit acceptance passes.

No collaborator was contacted, and no project/repository was published or overwritten.
