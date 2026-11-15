//! Embeds the ClothCraft icon into the Windows executable, so Explorer,
//! the taskbar and shortcuts show it. The window icon is set separately
//! at runtime in `src/atelier.rs`.

fn main() {
    println!("cargo:rerun-if-changed=assets/branding/clothcraft-icon.ico");
    println!("cargo:rerun-if-changed=build.rs");

    #[cfg(windows)]
    {
        if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows") {
            let mut resource = winres::WindowsResource::new();
            resource.set_icon("assets/branding/clothcraft-icon.ico");
            resource
                .compile()
                .expect("failed to embed the ClothCraft icon into the Windows executable");
        }
    }
}
