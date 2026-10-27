//! Typed descriptions of existing native workspace actions.
//!
//! A command is not an editor implementation: `Atelier::dispatch_command`
//! remains the sole live adapter. Future toolbars and automation clients can
//! inspect this registry but must use that checked adapter to perform actions.
//! This catalog intentionally omits planned tools and experimental backends.

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum CommandId {
    ToggleSimulation,
    StepSimulation,
    ResetSimulation,
    ExportSession,
    SplitView,
    GarmentView,
    PatternView,
    ToggleInspector,
    ResetLayout,
    OpenPreferences,
    LoadTshirt,
    LoadDress,
    ToolEdit,
    ToolDraw,
    ToolRectangle,
    ToolEllipse,
    ToolSector,
    ToolInternalLine,
    ToolSew,
    ToolMove,
    ToolRotate,
    ToolGrab,
    ToolMeasure,
    ToolInspect,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum CommandContext {
    Simulation,
    File,
    Workspace,
    Example,
    Tool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum UndoPolicy {
    /// The operation has no authoring-history undo command.
    NotUndoable,
    /// Saved as a user preference, outside the garment authoring history.
    Preference,
    /// Restores only the previous template through authoring history, not
    /// simulated positions, velocities, solver caches or files on disk.
    TemplateHistory,
    /// Writes files; undo does not remove or restore files on disk.
    ExternalSideEffect,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Backend {
    NativeWorkspace,
    SimulationWorker,
    LocalFilesystem,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct CommandDescriptor {
    pub id: CommandId,
    pub key: &'static str,
    pub label: &'static str,
    pub context: CommandContext,
    /// None means no shortcut is wired; do not advertise speculative bindings.
    pub shortcut: Option<&'static str>,
    pub undo: UndoPolicy,
    pub backend: Backend,
}

macro_rules! entry {
    ($id:ident, $key:literal, $label:literal, $context:ident, $shortcut:expr, $undo:ident, $backend:ident) => {
        CommandDescriptor {
            id: CommandId::$id,
            key: $key,
            label: $label,
            context: CommandContext::$context,
            shortcut: $shortcut,
            undo: UndoPolicy::$undo,
            backend: Backend::$backend,
        }
    };
}

pub const REGISTRY: &[CommandDescriptor] = &[
    entry!(
        ToggleSimulation,
        "simulation.toggle",
        "Start or pause simulation",
        Simulation,
        Some("Space"),
        NotUndoable,
        SimulationWorker
    ),
    entry!(
        StepSimulation,
        "simulation.step",
        "Advance one simulation step",
        Simulation,
        None,
        NotUndoable,
        SimulationWorker
    ),
    entry!(
        ResetSimulation,
        "simulation.reset",
        "Reset flat arrangement",
        Simulation,
        None,
        NotUndoable,
        NativeWorkspace
    ),
    entry!(
        ExportSession,
        "file.export",
        "Export session artifacts",
        File,
        None,
        ExternalSideEffect,
        LocalFilesystem
    ),
    entry!(
        SplitView,
        "workspace.view_split",
        "Split view",
        Workspace,
        None,
        Preference,
        NativeWorkspace
    ),
    entry!(
        GarmentView,
        "workspace.view_garment",
        "3D only",
        Workspace,
        None,
        Preference,
        NativeWorkspace
    ),
    entry!(
        PatternView,
        "workspace.view_patterns",
        "2D only",
        Workspace,
        None,
        Preference,
        NativeWorkspace
    ),
    entry!(
        ToggleInspector,
        "workspace.inspector",
        "Toggle properties inspector",
        Workspace,
        None,
        Preference,
        NativeWorkspace
    ),
    entry!(
        ResetLayout,
        "workspace.reset_layout",
        "Reset workspace layout",
        Workspace,
        None,
        Preference,
        NativeWorkspace
    ),
    entry!(
        OpenPreferences,
        "workspace.preferences",
        "Open preferences",
        Workspace,
        None,
        NotUndoable,
        NativeWorkspace
    ),
    entry!(
        LoadTshirt,
        "example.tshirt",
        "Load T-shirt example",
        Example,
        None,
        TemplateHistory,
        NativeWorkspace
    ),
    entry!(
        LoadDress,
        "example.dress",
        "Load dress example",
        Example,
        None,
        TemplateHistory,
        NativeWorkspace
    ),
    entry!(
        ToolEdit,
        "tool.edit",
        "Select and edit",
        Tool,
        None,
        NotUndoable,
        NativeWorkspace
    ),
    entry!(
        ToolDraw,
        "tool.draw",
        "Draw pattern",
        Tool,
        None,
        NotUndoable,
        NativeWorkspace
    ),
    entry!(
        ToolRectangle,
        "tool.rectangle",
        "Draw rectangle",
        Tool,
        None,
        NotUndoable,
        NativeWorkspace
    ),
    entry!(
        ToolEllipse,
        "tool.ellipse",
        "Draw ellipse",
        Tool,
        None,
        NotUndoable,
        NativeWorkspace
    ),
    entry!(
        ToolSector,
        "tool.sector",
        "Draw arc sector",
        Tool,
        None,
        NotUndoable,
        NativeWorkspace
    ),
    entry!(
        ToolInternalLine,
        "tool.internal_line",
        "Draw internal line",
        Tool,
        None,
        NotUndoable,
        NativeWorkspace
    ),
    entry!(
        ToolSew,
        "tool.sew",
        "Sew boundaries",
        Tool,
        None,
        NotUndoable,
        NativeWorkspace
    ),
    entry!(
        ToolMove,
        "tool.move_3d",
        "Move panel in 3D",
        Tool,
        None,
        NotUndoable,
        NativeWorkspace
    ),
    entry!(
        ToolRotate,
        "tool.rotate_3d",
        "Rotate panel in 3D",
        Tool,
        None,
        NotUndoable,
        NativeWorkspace
    ),
    entry!(
        ToolGrab,
        "tool.grab",
        "Grab cloth",
        Tool,
        None,
        NotUndoable,
        NativeWorkspace
    ),
    entry!(
        ToolMeasure,
        "tool.measure",
        "Measure on 2D board",
        Tool,
        None,
        NotUndoable,
        NativeWorkspace
    ),
    entry!(
        ToolInspect,
        "tool.inspect",
        "Mark simulation issue",
        Tool,
        None,
        NotUndoable,
        NativeWorkspace
    ),
];

impl CommandId {
    pub fn descriptor(self) -> &'static CommandDescriptor {
        REGISTRY
            .iter()
            .find(|d| d.id == self)
            .expect("registry must cover every command")
    }
}

/// Simple, side-effect-free capability snapshot; no fake command is created
/// merely because a future backend happens to be present on a computer.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct CapabilityContext {
    pub document_loaded: bool,
    pub selected_panel: bool,
    pub worker_ready: bool,
    pub filesystem_ready: bool,
    pub playing: bool,
    pub pending: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum UnavailableReason {
    NoDocument,
    NoSelectedPanel,
    WorkerUnavailable,
    FilesystemUnavailable,
    SimulationRunning,
    SimulationBusy,
}

impl UnavailableReason {
    pub fn message(self) -> &'static str {
        match self {
            Self::NoDocument => "No garment document is loaded",
            Self::NoSelectedPanel => "Select a panel before arranging it",
            Self::WorkerUnavailable => "The simulation worker is unavailable",
            Self::FilesystemUnavailable => "Local export storage is unavailable",
            Self::SimulationRunning => "Pause simulation before stepping",
            Self::SimulationBusy => "The previous simulation step is still pending",
        }
    }
}

pub fn availability(id: CommandId, ctx: CapabilityContext) -> Result<(), UnavailableReason> {
    let descriptor = id.descriptor();
    if !ctx.document_loaded
        && matches!(
            descriptor.context,
            CommandContext::Simulation | CommandContext::File
        )
    {
        return Err(UnavailableReason::NoDocument);
    }
    match descriptor.backend {
        Backend::SimulationWorker if !ctx.worker_ready => {
            return Err(UnavailableReason::WorkerUnavailable);
        }
        Backend::LocalFilesystem if !ctx.filesystem_ready => {
            return Err(UnavailableReason::FilesystemUnavailable);
        }
        _ => {}
    }
    if matches!(id, CommandId::ToolMove | CommandId::ToolRotate) && !ctx.selected_panel {
        return Err(UnavailableReason::NoSelectedPanel);
    }
    if id == CommandId::StepSimulation {
        if ctx.playing {
            return Err(UnavailableReason::SimulationRunning);
        }
        if ctx.pending {
            return Err(UnavailableReason::SimulationBusy);
        }
    }
    Ok(())
}
