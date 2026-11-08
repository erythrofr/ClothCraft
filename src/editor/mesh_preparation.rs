//! One-time rest meshing for the default sphere/hanging reference editor.
use eframe::egui;
use marvelous_cloth::{mesh_resolution::preparation::PhysicsSizing, project::Project};

pub(super) struct Draft {
    young_pa: [String; 2],
    ratio: String,
    transition_mm: String,
}
pub(super) enum Action {
    Physics(PhysicsSizing),
    Uniform,
}
impl Draft {
    pub(super) fn from_project(project: &Project) -> Self {
        let plan = project.physics_sizing.as_ref();
        Self {
            young_pa: plan.map_or(["110000".into(), "110000".into()], |p| {
                p.young_pa.map(|v| v.to_string())
            }),
            ratio: plan.map_or("0.5".into(), |p| p.boundary_ratio.to_string()),
            transition_mm: plan.map_or("40".into(), |p| (p.transition_m * 1000.).to_string()),
        }
    }
    fn plan(&self, project: &Project) -> Result<PhysicsSizing, String> {
        let number = |s: &str| {
            s.trim()
                .parse::<f64>()
                .map_err(|_| "Enter numeric sizing values".to_owned())
        };
        let plan = PhysicsSizing {
            young_pa: [number(&self.young_pa[0])?, number(&self.young_pa[1])?],
            bending_nm: [project.material.bend_warp, project.material.bend_weft],
            axis_degrees: project.material.grain_degrees,
            boundary_ratio: number(&self.ratio)?,
            transition_m: number(&self.transition_mm)? * 0.001,
            seed: 42,
        };
        plan.validate()?;
        Ok(plan)
    }
}
fn named(ui: &egui::Ui, response: &egui::Response, name: &str) {
    #[cfg(test)]
    super::widget_harness::named(ui, response, name);
    let _ = (ui, response, name);
}
pub(super) fn controls(
    ui: &mut egui::Ui,
    draft: &mut Draft,
    project: &Project,
    enabled: bool,
) -> Option<Action> {
    ui.strong("Physics-inspired mesh preparation");
    ui.small("Build before simulating. Bending and grain come from Fabric settings; E is an explicit sizing estimate, not simulation stiffness.");
    let [warp, weft] = &mut draft.young_pa;
    for (label, value, key) in [
        ("Warp E (Pa)", warp, "sphere_mesh.young.0"),
        ("Weft E (Pa)", weft, "sphere_mesh.young.1"),
        (
            "Boundary/base spacing",
            &mut draft.ratio,
            "sphere_mesh.ratio",
        ),
        (
            "Transition distance (mm)",
            &mut draft.transition_mm,
            "sphere_mesh.transition",
        ),
    ] {
        ui.horizontal_wrapped(|ui| {
            ui.label(label);
            let response = ui.add(
                egui::TextEdit::singleline(value)
                    .id_salt(key)
                    .desired_width(80.),
            );
            named(ui, &response, key);
        });
    }
    let plan = draft.plan(project);
    match &plan {
        Ok(plan) => {
            let spacing = plan.base().expect("validated sizing plan");
            ui.small(format!(
                "Estimated base spacing: {:.2} × {:.2} mm",
                spacing[0] * 1000.,
                spacing[1] * 1000.
            ));
        }
        Err(error) => {
            ui.colored_label(egui::Color32::DARK_RED, error);
        }
    }
    ui.small("Remesh applies the pattern and fabric settings and resets cloth to its flat starting pose. Topology stays fixed during the run.");
    if !enabled {
        ui.small("Pause and wait for the current step before remeshing.");
    }
    let response = ui.add_enabled(
        enabled && plan.is_ok(),
        egui::Button::new("Remesh and reset"),
    );
    named(ui, &response, "sphere_mesh.apply");
    let mut action = response.clicked().then(|| Action::Physics(plan.unwrap()));
    let response = ui.add_enabled(enabled, egui::Button::new("Use uniform grid and reset"));
    named(ui, &response, "sphere_mesh.uniform");
    ui.small("Research estimate; optimal resolution and wrinkle accuracy are not validated.");
    if response.clicked() {
        action = Some(Action::Uniform);
    }
    action
}

#[cfg(test)]
mod tests {
    use super::super::widget_harness::Harness;
    use super::*;
    use eframe::egui::Vec2;

    #[test]
    fn preparation_is_explicit_validated_and_paused_only() {
        let project = Project::default();
        let before = serde_json::to_value(&project).unwrap();
        let mut state = (Draft::from_project(&project), true, Vec::<Action>::new());
        let mut harness = Harness::new(Vec2::new(260., 850.));
        let mut draw = |ui: &mut egui::Ui, state: &mut (Draft, bool, Vec<Action>)| {
            if let Some(action) = controls(ui, &mut state.0, &project, state.1) {
                state.2.push(action);
            }
        };
        harness.frame(&mut state, &mut draw);
        assert!(state.2.is_empty());
        harness
            .replace_text("sphere_mesh.young.0", "NaN", &mut state, &mut draw)
            .unwrap();
        assert!(
            harness
                .click("sphere_mesh.apply", &mut state, &mut draw)
                .unwrap_err()
                .contains("disabled")
        );
        harness
            .replace_text("sphere_mesh.young.0", "220000", &mut state, &mut draw)
            .unwrap();
        harness
            .key(
                "sphere_mesh.young.0",
                egui::Key::Enter,
                egui::Modifiers::NONE,
                &mut state,
                &mut draw,
            )
            .unwrap();
        assert!(state.2.is_empty());
        state.1 = false;
        harness.frame(&mut state, &mut draw);
        for target in ["sphere_mesh.apply", "sphere_mesh.uniform"] {
            assert!(
                harness
                    .click(target, &mut state, &mut draw)
                    .unwrap_err()
                    .contains("disabled")
            );
        }
        state.1 = true;
        harness.frame(&mut state, &mut draw);
        harness
            .click("sphere_mesh.apply", &mut state, &mut draw)
            .unwrap();
        let Action::Physics(plan) = &state.2[0] else {
            panic!("expected sizing plan")
        };
        assert_eq!(plan.young_pa, [220000., 110000.]);
        assert_eq!(
            plan.bending_nm,
            [project.material.bend_warp, project.material.bend_weft]
        );
        harness
            .click("sphere_mesh.uniform", &mut state, &mut draw)
            .unwrap();
        assert!(matches!(state.2[1], Action::Uniform));
        assert_eq!(before, serde_json::to_value(&project).unwrap());
    }
}
