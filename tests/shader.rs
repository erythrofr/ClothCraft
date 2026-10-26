/// Parse and validate WGSL entirely on CPU. Never create a wgpu Instance or adapter.
#[test]
fn viewport_shader_validates_without_gpu() {
    let module = naga::front::wgsl::parse_str(include_str!("../src/cloth.wgsl")).unwrap();
    let view = module
        .types
        .iter()
        .find(|(_, ty)| ty.name.as_deref() == Some("View"))
        .unwrap()
        .1;
    let naga::TypeInner::Struct { span, ref members } = view.inner else {
        panic!("View uniform must be a struct")
    };
    assert_eq!(span, 80);
    assert_eq!(
        members.iter().map(|m| m.offset).collect::<Vec<_>>(),
        [0, 64]
    );
    naga::valid::Validator::new(
        naga::valid::ValidationFlags::all(),
        naga::valid::Capabilities::empty(),
    )
    .validate(&module)
    .unwrap();
}

#[test]
fn environment_shader_and_uniform_layout_validate_without_gpu() {
    let module =
        naga::front::wgsl::parse_str(include_str!("../src/render/environment.wgsl")).unwrap();
    naga::valid::Validator::new(
        naga::valid::ValidationFlags::all(),
        naga::valid::Capabilities::empty(),
    )
    .validate(&module)
    .unwrap();
    let uniform = module
        .types
        .iter()
        .find(|(_, ty)| ty.name.as_deref() == Some("Environment"))
        .unwrap()
        .1;
    let naga::TypeInner::Struct { span, ref members } = uniform.inner else {
        panic!("uniform must be a struct")
    };
    assert_eq!(span, 208, "must match the host uniform allocation");
    assert_eq!(
        members.iter().map(|m| m.offset).collect::<Vec<_>>(),
        [0, 64, 128, 144, 160, 176, 192]
    );
}
