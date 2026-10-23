//! Original bundled template catalog. No network access or third-party assets.
//! Catalog entries are engineering examples, not graded manufacturing patterns.
use crate::{
    authoring,
    fitting::{FittingProject, FittingScene},
    garment::GarmentTemplate,
};
use glam::DVec2;

#[derive(Clone, Copy, Debug)]
pub struct Entry {
    pub id: &'static str,
    pub title: &'static str,
    pub description: &'static str,
    pub source: &'static str,
    pub license: &'static str,
    json: &'static str,
}
macro_rules! entry {
    ($id:literal, $title:literal, $description:literal, $file:literal) => {
        Entry {
            id: $id,
            title: $title,
            description: $description,
            source: concat!("ClothCraft / examples/templates/", $file),
            license: "MIT",
            json: include_str!(concat!("../examples/templates/", $file)),
        }
    };
}
pub static ENTRIES: &[Entry] = &[
    entry!(
        "tshirt",
        "T-shirt",
        "Two-panel engineering fixture for the 1.75 m MakeHuman mannequin. Not a graded sewing pattern.",
        "tshirt.json"
    ),
    entry!(
        "dress",
        "Dress",
        "Two-panel dress fixture for the 1.75 m MakeHuman mannequin. Check placement on other avatars.",
        "dress.json"
    ),
    entry!(
        "curved",
        "Curved panels",
        "Cubic boundary example for editing and sewing experiments.",
        "curved-panels.json"
    ),
    entry!(
        "two-panel",
        "Two rectangles",
        "Simple nonmatching seam example. Panels may be pinned; inspect before simulating.",
        "two-panel.json"
    ),
    entry!(
        "partial-chain",
        "Partial and chained seams",
        "Small fixture illustrating partial boundaries and ordered seam chains.",
        "partial-chain.json"
    ),
    entry!(
        "local-ease",
        "Local easing",
        "Nonuniform seam correspondence example with explicit easing.",
        "local-ease.json"
    ),
];

/// A board-space polyline. It never uses draped positions or renderer coordinates.
#[derive(Clone, Debug)]
pub struct PreviewPath {
    pub panel: String,
    pub points_m: Vec<DVec2>,
    pub closed: bool,
    pub internal: bool,
}

pub struct Selection {
    template: GarmentTemplate,
    pub title: String,
    pub source: String,
    pub license: String,
    pub description: String,
    pub preview: Vec<PreviewPath>,
    pub panel_count: usize,
    pub seam_count: usize,
    pub warnings: Vec<String>,
}
impl Selection {
    pub fn bundled(id: &str) -> Result<Self, String> {
        let entry = ENTRIES
            .iter()
            .find(|e| e.id == id)
            .ok_or("Unknown bundled template")?;
        Self::parse(
            entry.json.as_bytes(),
            entry.title.into(),
            entry.source.into(),
            entry.license.into(),
            entry.description.into(),
        )
    }
    /// User-supplied native template JSON. No claim is made about its license.
    /// File picking and bounded file reading belong to the UI adapter.
    pub fn external(bytes: &[u8], source: String) -> Result<Self, String> {
        Self::parse(
            bytes,
            "Imported template".into(),
            source,
            "Unverified — supplied by user".into(),
            "Check this pattern's origin, scale, placement and redistribution rights before use."
                .into(),
        )
    }
    fn parse(
        bytes: &[u8],
        title: String,
        source: String,
        license: String,
        description: String,
    ) -> Result<Self, String> {
        if bytes.len() > 8 * 1024 * 1024 {
            return Err("Template exceeds the 8 MiB import limit".into());
        }
        let template: GarmentTemplate =
            serde_json::from_slice(bytes).map_err(|e| format!("Invalid template: {e}"))?;
        let compiled = template.compile()?;
        let mut preview = Vec::new();
        for (index, panel) in template.panels.iter().enumerate() {
            let map = |p: DVec2| {
                authoring::layout(&template, index)
                    + authoring::rotate_2d(p, panel.layout_rotation_degrees)
            };
            let mut add = |points: Vec<DVec2>, closed, internal| {
                preview.push(PreviewPath {
                    panel: panel.id.clone(),
                    points_m: points.into_iter().map(map).collect(),
                    closed,
                    internal,
                })
            };
            if let Some(poly) = &panel.polygon {
                let mut contour = Vec::new();
                for edge in 0..poly.points.len() {
                    let points = poly.edge_points(edge)?;
                    contour.extend_from_slice(&points[..points.len() - 1]);
                }
                add(contour, true, false);
                for hole in &poly.holes {
                    add(hole.points.clone(), true, false);
                }
                for line in &poly.lines {
                    add(line.samples()?, false, true);
                }
            } else {
                let (w, h) = (panel.pattern.width, panel.pattern.height);
                add(
                    vec![
                        DVec2::ZERO,
                        DVec2::new(w, 0.),
                        DVec2::new(w, h),
                        DVec2::new(0., h),
                    ],
                    true,
                    false,
                );
            }
        }
        Ok(Self {
            panel_count: template.panels.len(),
            seam_count: template.seams.len(),
            template,
            title,
            source,
            license,
            description,
            preview,
            warnings: compiled.warnings,
        })
    }
    /// Compile before committing. Failure leaves the current document untouched.
    /// The avatar and physical settings remain those of the current workspace.
    pub fn prepare(&self, current: &FittingProject) -> Result<Prepared, String> {
        self.prepare_with_simulation(current, current.simulation.clone())
    }
    /// Use live workspace settings when they have changed since the last save.
    pub fn prepare_with_simulation(
        &self,
        current: &FittingProject,
        simulation: Option<crate::vbd::VbdSettings>,
    ) -> Result<Prepared, String> {
        let project = FittingProject {
            version: current.version,
            template: self.template.clone(),
            avatar_path: current.avatar_path.clone(),
            contact_stiffness: current.contact_stiffness,
            contact_clearance: current.contact_clearance,
            prearrange: false,
            quasistatic: current.quasistatic,
            solver: current.solver.clone(),
            simulation,
            state: None,
            mesh_signature: None,
        };
        let scene = project.compile()?;
        Ok(Prepared { project, scene })
    }
}
/// Fully validated candidate. Installing it still requires explicit UI confirmation.
pub struct Prepared {
    pub project: FittingProject,
    pub scene: FittingScene,
}
