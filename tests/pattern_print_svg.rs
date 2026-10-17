use glam::DVec2;
use marvelous_cloth::garment::{
    GarmentTemplate,
    domain::{Hole, InternalLine},
    export,
    meshing::MeshingSettings,
    shapes::{self, Primitive},
};

#[test]
fn root_units_match_material_metres_and_include_100mm_ruler() {
    let template = GarmentTemplate::two_panel_demo();
    let svg = export::print_pattern_svg(&template).expect("physical SVG");
    assert!(svg.contains("width=\"440.000mm\""));
    assert!(svg.contains("height=\"1347.000mm\""));
    assert!(svg.contains("viewBox=\"0 0 440.000 1347.000\""));
    assert_eq!(svg.matches("data-role=\"sewing-outline\"").count(), 2);
    // Rectangle coordinates in SVG user units are millimetres, not pixels.
    assert!(svg.contains("M 0.000 0.000 L 400.000 0.000 L 400.000 600.000 L 0.000 600.000 Z"));
    assert!(svg.contains("data-role=\"calibration-ruler\""));
    assert!(svg.contains("h 100.000"));
    assert!(svg.contains("100 mm calibration ruler"));
    assert!(svg.contains("No seam allowances, page tiling"));
    // The legacy annotated preview remains independent and visibly unscaled.
    assert!(export::pattern_svg(&template).contains("not a print-to-scale sewing pattern"));
}

#[test]
fn polygon_curves_holes_and_internal_lines_are_exported_in_material_mm() {
    let mut template = GarmentTemplate::two_panel_demo();
    template.version = 2;
    template.panels.truncate(1);
    template.seams.clear();
    template.panels[0].name = "Cut <&>".into();
    template.panels[0].pattern.width = 0.4;
    template.panels[0].pattern.height = 0.4;
    template.panels[0].pins.clear();
    let mut polygon = shapes::primitive(
        Primitive::Rectangle,
        DVec2::splat(0.4),
        360.0,
        MeshingSettings::default(),
    )
    .unwrap();
    polygon.holes.push(Hole {
        points: vec![
            DVec2::new(0.1, 0.1),
            DVec2::new(0.1, 0.15),
            DVec2::new(0.15, 0.15),
            DVec2::new(0.15, 0.1),
        ],
        edges: (0..4).map(|i| format!("hole_{i}")).collect(),
    });
    polygon.lines.push(InternalLine {
        id: "detail".into(),
        points: vec![DVec2::new(0.2, 0.05), DVec2::new(0.2, 0.35)],
        tangents: vec![DVec2::ZERO; 2],
    });
    template.panels[0].polygon = Some(polygon);
    let svg = export::print_pattern_svg(&template).expect("polygon physical SVG");
    assert!(svg.contains("Cut &lt;&amp;&gt;"));
    assert!(svg.contains("M 0.000 0.000 L 400.000 0.000"));
    assert!(svg.contains("M 100.000 100.000 L 100.000 150.000"));
    assert!(svg.contains("fill-rule=\"evenodd\""));
    assert!(svg.contains("data-role=\"internal-line\""));
    assert!(svg.contains("200.000,50.000"));

    let mut curved = GarmentTemplate::two_panel_demo();
    curved.version = 2;
    curved.panels.truncate(1);
    curved.seams.clear();
    curved.panels[0].pins.clear();
    curved.panels[0].pattern.width = 0.3;
    curved.panels[0].pattern.height = 0.2;
    curved.panels[0].polygon = Some(
        shapes::primitive(
            Primitive::Ellipse,
            DVec2::new(0.3, 0.2),
            360.0,
            MeshingSettings::default(),
        )
        .unwrap(),
    );
    let svg = export::print_pattern_svg(&curved).expect("curved physical SVG");
    assert!(svg.contains("M 300.000 100.000 L"));
    assert!(
        svg.matches(" L ").count() > 8,
        "curve must be sampled rather than a 4-edge box"
    );
}

#[test]
fn invalid_geometry_must_not_generate_apparently_scaled_artwork() {
    let mut template = GarmentTemplate::two_panel_demo();
    template.panels[0].pattern.width = f64::NAN;
    assert!(export::print_pattern_svg(&template).is_err());
    template.panels[0].pattern.width = 0.4;
    template.panels[0].pattern.height = -0.2;
    assert!(export::print_pattern_svg(&template).is_err());
}
