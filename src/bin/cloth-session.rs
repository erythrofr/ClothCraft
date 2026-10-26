//! Local JSON-lines authoring process. CPU only, even in a desktop build.
fn main() -> Result<(), Box<dyn std::error::Error>> {
    rayon::ThreadPoolBuilder::new()
        .num_threads(2)
        .build_global()?;
    let mut session = marvelous_cloth::session_protocol::Session::new()?;
    marvelous_cloth::session_protocol::serve(
        std::io::stdin().lock(),
        std::io::stdout().lock(),
        &mut session,
    )?;
    Ok(())
}
