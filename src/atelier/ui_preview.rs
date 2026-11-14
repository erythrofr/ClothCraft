//! CPU-only checks of real chrome/layout components. Never initialize wgpu.
use super::*;

fn frame(
    ctx: &egui::Context,
    width: f32,
    workspace: &mut layout::WorkspaceLayout,
    events: Vec<egui::Event>,
) -> egui::FullOutput {
    ctx.run_ui(
        egui::RawInput {
            screen_rect: Some(egui::Rect::from_min_size(
                egui::Pos2::ZERO,
                Vec2::new(width, 800.),
            )),
            events,
            ..Default::default()
        },
        |ui| {
            egui::CentralPanel::default().show(ui, |ui| {
                let area = ui.available_rect_before_wrap();
                let panes = layout::arrange(ui, area, workspace);
                for (rect, is_3d) in [(panes.garment, true), (panes.patterns, false)] {
                    let Some(rect) = rect else { continue };
                    let mut child = ui.new_child(
                        egui::UiBuilder::new()
                            .id_salt(is_3d)
                            .max_rect(rect.shrink(7.)),
                    );
                    let header = chrome::view_header(
                        &mut child,
                        if is_3d { "3D GARMENT" } else { "2D PATTERNS" },
                        false,
                        is_3d,
                        "Navigation",
                    );
                    assert!(
                        rect.contains_rect(header.settings.rect),
                        "display menu clipped at {width}"
                    );
                    if let Some(camera) = header.camera {
                        assert!(
                            rect.contains_rect(camera.rect),
                            "camera menu clipped at {width}"
                        );
                    }
                }
            });
        },
    )
}

#[test]
fn narrow_headers_and_dragging_dividers_work_without_gpu() {
    let ctx = egui::Context::default();
    settings::apply(&ctx, &Default::default());
    for width in [1048., 1548., 2500.] {
        for split in [0.2, 0.58, 0.8] {
            let mut layout = layout::WorkspaceLayout {
                split,
                ..Default::default()
            };
            let mut output = frame(&ctx, width, &mut layout, vec![]);
            output.textures_delta.clear();
        }
    }
    let mut state = layout::WorkspaceLayout::default();
    let mut out = frame(&ctx, 1548., &mut state, vec![]);
    out.textures_delta.clear();
    let area = egui::Rect::from_min_max(egui::pos2(8., 8.), egui::pos2(1540., 792.));
    let panes = layout::rectangles(area, &state);
    let start = egui::pos2(panes.garment.unwrap().right() + 3.5, 400.);
    let end = start + Vec2::new(100., 0.);
    let button = |pos, pressed| egui::Event::PointerButton {
        pos,
        button: egui::PointerButton::Primary,
        pressed,
        modifiers: Default::default(),
    };
    for events in [
        vec![egui::Event::PointerMoved(start)],
        vec![button(start, true)],
        vec![egui::Event::PointerMoved(end)],
        vec![button(end, false)],
    ] {
        let mut out = frame(&ctx, 1548., &mut state, events);
        out.textures_delta.clear();
    }
    assert!(
        state.split > 0.63,
        "divider drag must resize the views: {}",
        state.split
    );
}

#[test]
#[ignore = "Optional CPU-only layout preview, writes output/ui-preview-mesh.json"]
fn export_chrome_preview() {
    let ctx = egui::Context::default();
    let prefs = settings::Preferences {
        theme: settings::ThemeChoice::Dark,
        ..Default::default()
    };
    settings::apply(&ctx, &prefs);
    let mut textures = Vec::new();
    let mut final_output = None;
    for frame_index in 0..3 {
        let mut out=ctx.run_ui(egui::RawInput { time: Some(frame_index as f64), screen_rect: Some(egui::Rect::from_min_size(egui::Pos2::ZERO,Vec2::new(1600.,900.))),..Default::default() },|ui| {
            egui::Panel::top("top").show(ui,|ui| { ui.horizontal(|ui| {
                ui.colored_label(workspace::ACCENT,egui::RichText::new("CLOTHCRAFT").strong());
                ui.small("ALPHA");ui.separator();
                for label in ["▶ Simulate","Simulation","File","Import","Export","View"] { let _=ui.button(label); }
                for label in ["Commands…","Workspace profiles…","Preferences…"] { let _=ui.button(label); }
            }); });
            egui::Panel::bottom("bottom").show(ui,|ui| { ui.small("CPU layout preview · real egui chrome · placeholder canvases · GPU renderer not started"); });
            egui::Panel::left("tools").exact_size(52.).resizable(false).show(ui,|ui| { ui.vertical_centered(|ui| {
                let _=ui.button("···");
                for (i,icon) in [icons::Icon::Select,icons::Icon::Pen,icons::Icon::Rectangle,icons::Icon::Sew,icons::Icon::Pen,icons::Icon::Move3d,icons::Icon::Rotate3d,icons::Icon::Grab].into_iter().enumerate() {
                    if [3,5,7].contains(&i) { ui.separator(); }
                    icons::icon_only(ui,icon,36.,i==0,"");
                }
                ui.separator();
                icons::icon_only(ui,icons::Icon::Undo,32.,false,"");
                icons::icon_only(ui,icons::Icon::Redo,32.,false,"");
            }); });
            egui::CentralPanel::default().frame(egui::Frame::NONE).show(ui,|ui| {
                let area=ui.available_rect_before_wrap();
                let panes=layout::arrange(ui,area,&mut prefs.workspace.clone());
                for (id,rect) in [("3d",panes.garment),("2d",panes.patterns),("props",panes.inspector)] {
                    let rect=rect.unwrap();
                    ui.painter().rect_filled(rect,0.,ui.visuals().panel_fill);
                    let mut pane=ui.new_child(egui::UiBuilder::new().id_salt(id).max_rect(rect.shrink(7.)));
                    if id=="props" {
                        pane.strong("PROPERTIES");pane.separator();pane.label("Pieces (4)");
                        for name in ["Front","Back","Left sleeve","Right sleeve"] { let _=pane.selectable_label(name=="Front",name); }
                        pane.separator();pane.horizontal(|ui| { for name in ["Piece","Fabric","Simulation"] { let _=ui.selectable_label(name=="Piece",name); } });
                        pane.separator();pane.strong("Active panel");pane.label("Front");pane.small("520 × 700 mm");
                        for name in ["Existing seams (6)","Dimensions and points","Mirrors and booleans"] { pane.collapsing(name,|_| {}); }
                        pane.horizontal(|ui| { let _=ui.button("Duplicate");let _=ui.button("Delete panel"); });
                    } else {
                        let _=chrome::view_header(&mut pane,if id=="3d" { "3D GARMENT" } else { "2D PATTERNS" },false,id=="3d","");
                        if id=="2d" { pane.horizontal(|ui| { for label in ["Shapes","Edit","New sheet","?"] { let _=ui.button(label); } }); }
                        pane.separator();
                        let rect=pane.available_rect_before_wrap();
                        pane.painter().rect_filled(rect,0.,if id=="3d" { Color32::from_rgb(70,78,92) } else { Color32::from_rgb(234,237,241) });
                        pane.painter().text(rect.center(),egui::Align2::CENTER_CENTER,if id=="3d" { "3D viewport\nRenderer validation pending" } else { "Unified pattern canvas" },egui::FontId::proportional(16.),if id=="3d" { Color32::LIGHT_GRAY } else { Color32::DARK_GRAY });
                    }
                }
            });
            egui::Window::new("3D display · CPU preview").fixed_pos(egui::pos2(430.,100.)).resizable(false).show(ui.ctx(),|ui| { chrome::appearance_controls(ui,&mut prefs.viewport.clone(),true); });
        });
        for (id, deltas) in &out.textures_delta.set {
            for delta in deltas {
                let egui::ImageData::Color(data) = &delta.image;
                textures.push(serde_json::json!({"id":format!("{id:?}"),"pos":delta.pos,"size":data.size,"pixels":data.pixels.iter().map(|c|c.to_array()).collect::<Vec<_>>()}));
            }
        }
        out.textures_delta.clear();
        final_output = Some(out);
    }
    let out = final_output.unwrap();
    let meshes=ctx.tessellate(out.shapes,out.pixels_per_point).into_iter().filter_map(|p| {
        let egui::epaint::Primitive::Mesh(m)=p.primitive else { return None };
        Some(serde_json::json!({"clip":[p.clip_rect.min.x,p.clip_rect.min.y,p.clip_rect.max.x,p.clip_rect.max.y],"texture":format!("{:?}",m.texture_id),"indices":m.indices,"vertices":m.vertices.iter().map(|v|serde_json::json!([v.pos.x,v.pos.y,v.uv.x,v.uv.y,v.color.to_array()])).collect::<Vec<_>>()}))
    }).collect::<Vec<_>>();
    std::fs::create_dir_all("output").unwrap();
    std::fs::write(
        "output/ui-preview-mesh.json",
        serde_json::to_vec(
            &serde_json::json!({"width":1600,"height":900,"textures":textures,"meshes":meshes}),
        )
        .unwrap(),
    )
    .unwrap();
}
