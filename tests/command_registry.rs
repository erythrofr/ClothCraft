// The registry is intentionally dependency-free, so CPU-only integration
// tests exercise the exact code used by the desktop adapter.
#[path = "../src/atelier/commands.rs"]
mod commands;

use commands::{
    Backend, CapabilityContext, CommandContext, CommandId, REGISTRY, UnavailableReason, UndoPolicy,
    availability,
};

fn ready() -> CapabilityContext {
    CapabilityContext {
        document_loaded: true,
        worker_ready: true,
        filesystem_ready: true,
        playing: false,
        pending: false,
    }
}

#[test]
fn every_command_has_a_unique_stable_key_and_a_real_descriptor() {
    let mut keys = std::collections::BTreeSet::new();
    let mut ids = std::collections::HashSet::new();
    assert_eq!(REGISTRY.len(), 12);
    for desc in REGISTRY {
        assert!(!desc.label.trim().is_empty());
        assert!(desc.key.contains('.'), "{:?}", desc.id);
        assert!(keys.insert(desc.key));
        assert!(ids.insert(desc.id));
        assert_eq!(CommandId::parse(desc.key), Some(desc.id));
        assert_eq!(desc.id.descriptor(), desc);
        assert_eq!(availability(desc.id, ready()), Ok(()));
    }
    assert_eq!(CommandId::parse("future.magic_auto_fit"), None);
    assert_eq!(CommandId::parse("simulation.gpu_xpbd"), None);
    assert_eq!(CommandId::parse(""), None);
}

#[test]
fn shortcuts_are_only_for_wired_keys() {
    let bindings: Vec<_> = REGISTRY
        .iter()
        .filter_map(|c| c.shortcut.map(|k| (c.id, k)))
        .collect();
    assert_eq!(bindings, vec![(CommandId::ToggleSimulation, "Space")]);
}

#[test]
fn unavailable_commands_cannot_pass_the_dispatch_gate() {
    let mut context = ready();
    context.document_loaded = false;
    for descriptor in REGISTRY {
        assert_eq!(
            availability(descriptor.id, context),
            Err(UnavailableReason::NoDocument)
        );
    }
    context = ready();
    context.worker_ready = false;
    assert_eq!(
        availability(CommandId::ToggleSimulation, context),
        Err(UnavailableReason::WorkerUnavailable)
    );
    assert_eq!(
        availability(CommandId::StepSimulation, context),
        Err(UnavailableReason::WorkerUnavailable)
    );
    assert_eq!(availability(CommandId::SplitView, context), Ok(()));
    context = ready();
    context.filesystem_ready = false;
    assert_eq!(
        availability(CommandId::ExportSession, context),
        Err(UnavailableReason::FilesystemUnavailable)
    );
    context = ready();
    context.playing = true;
    assert_eq!(
        availability(CommandId::StepSimulation, context),
        Err(UnavailableReason::SimulationRunning)
    );
    assert_eq!(availability(CommandId::ToggleSimulation, context), Ok(()));
    context = ready();
    context.pending = true;
    assert_eq!(
        availability(CommandId::StepSimulation, context),
        Err(UnavailableReason::SimulationBusy)
    );
}

#[test]
fn metadata_matches_actual_workspace_side_effects() {
    let simulation = CommandId::ToggleSimulation.descriptor();
    assert_eq!(simulation.context, CommandContext::Simulation);
    assert_eq!(simulation.backend, Backend::SimulationWorker);
    assert_eq!(simulation.undo, UndoPolicy::NotUndoable);

    let export = CommandId::ExportSession.descriptor();
    assert_eq!(export.context, CommandContext::File);
    assert_eq!(export.backend, Backend::LocalFilesystem);
    assert_eq!(export.undo, UndoPolicy::ExternalSideEffect);

    assert_eq!(
        CommandId::LoadTshirt.descriptor().undo,
        UndoPolicy::AuthoringSnapshot
    );
    assert_eq!(
        CommandId::ResetLayout.descriptor().undo,
        UndoPolicy::Preference
    );
    assert_eq!(
        CommandId::GarmentView.descriptor().context,
        CommandContext::Workspace
    );
    assert_eq!(
        CommandId::LoadDress.descriptor().context,
        CommandContext::Example
    );
}

#[test]
fn each_unavailable_reason_has_a_clear_user_message() {
    for reason in [
        UnavailableReason::NoDocument,
        UnavailableReason::WorkerUnavailable,
        UnavailableReason::FilesystemUnavailable,
        UnavailableReason::SimulationRunning,
        UnavailableReason::SimulationBusy,
    ] {
        assert!(reason.message().len() >= 12);
    }
}
