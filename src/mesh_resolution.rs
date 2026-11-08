//! Independent, opt-in static sizing research. No solver or document mutation.
pub mod artifacts;
pub mod mesh;
pub mod preparation;
pub mod sizing;

use glam::DVec2;
use mesh::{Domain, Options, Output, Ring};
use serde::{Deserialize, Serialize};
use sizing::{Calibration, Fabric, Feature, SizingMap, Source};
use std::{collections::BTreeMap, time::Instant};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum Preset {
    Shirring,
    Skirt,
    Sleeve,
}
impl Preset {
    pub const ALL: [Self; 3] = [Self::Shirring, Self::Skirt, Self::Sleeve];
    pub fn label(self) -> &'static str {
        match self {
            Self::Shirring => "Small shirring patch",
            Self::Skirt => "Gathered skirt panel",
            Self::Sleeve => "Anisotropic sleeve",
        }
    }
    pub fn description(self) -> &'static str {
        match self {
            Self::Shirring => {
                "A small patch with a constrained gather line. Compare local refinement against a uniform fine mesh."
            }
            Self::Skirt => {
                "A flared skirt panel with a 2:1 gathered waist. Refinement follows the waist and fades toward the hem."
            }
            Self::Sleeve => {
                "A tapered sleeve with different warp/weft estimates and a manually labelled elbow compression region."
            }
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Experiment {
    pub fabric: Fabric,
    #[serde(default)]
    pub calibration: Calibration,
    pub domain: Domain,
    #[serde(default)]
    pub sources: Vec<Source>,
    #[serde(default)]
    pub options: Options,
}
impl Experiment {
    pub fn preset(preset: Preset) -> Result<Self, String> {
        let calibration = Calibration::default();
        let fabric = Fabric {
            young_pa: [1.1e5; 2],
            bending_nm: [2e-6; 2],
            axis_degrees: 0.,
        };
        let (points, edges, gather, lines) = match preset {
            Preset::Shirring => {
                let gather = vec![DVec2::new(0.03, 0.07), DVec2::new(0.15, 0.07)];
                (
                    vec![
                        DVec2::ZERO,
                        DVec2::new(0.18, 0.),
                        DVec2::new(0.18, 0.24),
                        DVec2::new(0., 0.24),
                    ],
                    vec!["top", "right", "bottom", "left"],
                    gather.clone(),
                    BTreeMap::from([("gather".into(), gather)]),
                )
            }
            Preset::Skirt => (
                vec![
                    DVec2::new(0.10, 0.),
                    DVec2::new(0.36, 0.),
                    DVec2::new(0.46, 0.40),
                    DVec2::new(0., 0.40),
                ],
                vec!["waist", "right", "hem", "left"],
                vec![DVec2::new(0.10, 0.), DVec2::new(0.36, 0.)],
                BTreeMap::new(),
            ),
            Preset::Sleeve => (
                vec![
                    DVec2::ZERO,
                    DVec2::new(0.24, 0.),
                    DVec2::new(0.20, 0.44),
                    DVec2::new(0.04, 0.44),
                ],
                vec!["armhole", "right", "cuff", "left"],
                vec![],
                BTreeMap::new(),
            ),
        };
        let mut input = Self {
            fabric,
            calibration,
            domain: Domain {
                outer: Ring {
                    points,
                    edges: edges.into_iter().map(str::to_owned).collect(),
                },
                holes: vec![],
                lines,
            },
            sources: vec![],
            options: Options::default(),
        };
        if preset == Preset::Sleeve {
            input.fabric.young_pa = [1.1e5, 2e5];
            input.fabric.bending_nm = [2e-6, 0.8e-6];
            input.fabric.axis_degrees = 90.;
            let base = input.fabric.resolution(&input.calibration)?;
            input.sources.push(Source {
                feature: Feature::Region {
                    center: DVec2::new(0.12, 0.23),
                    radius_m: 0.025,
                },
                spacing_m: base.map(|r| r * 0.6),
                doubling_distance_m: 0.06,
                exponent: 2. / 3.,
            });
        } else {
            let spacing_m = input
                .fabric
                .shirring(&input.calibration, [0.; 2], 0.5, 1.)?;
            input.sources.push(Source {
                feature: Feature::Polyline { points: gather },
                spacing_m,
                doubling_distance_m: 0.04,
                exponent: 0.5,
            });
        }
        Ok(input)
    }
    pub fn map(&self) -> Result<SizingMap, String> {
        SizingMap::new(
            self.fabric.resolution(&self.calibration)?,
            self.fabric.axis_degrees,
            self.sources.clone(),
        )
    }
    /// Every run uses identical rest boundaries, constraints, seed and budgets.
    pub fn generate(&self, compare: bool) -> Result<Comparison, String> {
        self.generate_with_cancel(compare, &|| false)
    }
    pub fn generate_with_cancel(
        &self,
        compare: bool,
        cancelled: &dyn Fn() -> bool,
    ) -> Result<Comparison, String> {
        let map = self.map()?;
        let base = map.base();
        let mut maps = vec![("adaptive", map.clone())];
        if compare {
            maps.push((
                "uniform-base",
                SizingMap::new([base[0].min(base[1]); 2], self.fabric.axis_degrees, vec![])?,
            ));
            maps.push((
                "uniform-fine",
                SizingMap::new([map.finest(); 2], self.fabric.axis_degrees, vec![])?,
            ));
        }
        let mut runs = vec![];
        for (name, map) in maps {
            let start = Instant::now();
            let output = mesh::generate_with_cancel(&self.domain, &map, &self.options, cancelled)?;
            runs.push(Run {
                name: name.into(),
                output,
                mesh_generation_ms: start.elapsed().as_secs_f64() * 1000.,
            });
        }
        Ok(Comparison {
            runs,
            base_spacing_m: base,
        })
    }
}
#[derive(Clone, Debug, Serialize)]
pub struct Run {
    pub name: String,
    pub output: Output,
    pub mesh_generation_ms: f64,
}
#[derive(Clone, Debug, Serialize)]
pub struct Comparison {
    pub runs: Vec<Run>,
    pub base_spacing_m: [f64; 2],
}
impl Comparison {
    pub fn vertex_reduction_percent(&self) -> Option<f64> {
        let adaptive = self
            .runs
            .iter()
            .find(|r| r.name == "adaptive")?
            .output
            .quality
            .vertices;
        let fine = self
            .runs
            .iter()
            .find(|r| r.name == "uniform-fine")?
            .output
            .quality
            .vertices;
        Some(100. * (1. - adaptive as f64 / fine as f64))
    }
}
