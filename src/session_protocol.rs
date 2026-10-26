//! Local CPU authoring protocol. Native templates remain unwrapped on disk.
//! No solver, renderer, network listener or caller-controlled filesystem paths.
//!
//! Start `cloth-session` and send one JSON object per line:
//! `{"protocol":"clothcraft.authoring","protocolVersion":1,"requestId":"1","payload":{"op":"hello"}}`.
//! The response lists actual commands and the initial session identity. Every
//! mutation includes `guard: {documentSession, expectedRevision}` in its payload.
//! `open` takes a native `template` and returns a fresh identity; use that identity
//! for later commands. `edit` takes a `command` with a snake_case `kind` and fields
//! matching the native command (metres, except explicit degree fields).
//! `prepare_edit` returns a `change` token without changing the resident template;
//! `commit` or `cancel` consumes it under the same guard. Successful direct edits,
//! history moves and document replacement invalidate any previous prepared edit.
//! Snapshot output is an editable template, not simulated state or a fitting file.
//! `fabric` accepts panel, name, native FabricProperties and all_panels. It
//! changes mechanical properties, unlike optical appearance; native validation
//! and shared-fabric splitting apply. Units match the native template schema.
use crate::{
    authoring::{self, Command, Edit, History},
    garment::{
        GarmentTemplate,
        meshing::MeshingSettings,
        seam::BoundaryRef,
        shapes::MirrorAxis,
        template::{FabricProperties, Placement},
    },
};
use glam::DVec2;
use serde::Deserialize;
use serde_json::{Value, json};
use std::io::{self, BufRead, Write};

pub const PROTOCOL: &str = "clothcraft.authoring";
pub const MAX_MESSAGE_BYTES: usize = 2 * 1024 * 1024;
const OPERATIONS: &[&str] = &[
    "hello",
    "snapshot",
    "open",
    "edit",
    "prepare_edit",
    "commit",
    "cancel",
    "undo",
    "redo",
];
const COMMANDS: &[&str] = &[
    "layout",
    "board_transform",
    "polygon",
    "duplicate",
    "remove_panel",
    "sew",
    "remove_seam",
    "place",
    "mirror",
    "fabric",
];

#[derive(Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct Guard {
    document_session: String,
    expected_revision: u64,
}

#[derive(Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
enum WireCommand {
    Fabric {
        panel: String,
        name: String,
        properties: FabricProperties,
        all_panels: bool,
    },
    Layout {
        panel: String,
        origin: DVec2,
    },
    BoardTransform {
        panel: String,
        origin: DVec2,
        rotation_degrees: f64,
    },
    Polygon {
        points: Vec<DVec2>,
        tangents: Vec<DVec2>,
        meshing: MeshingSettings,
        fabric: String,
    },
    Duplicate {
        panel: String,
    },
    RemovePanel {
        panel: String,
    },
    Sew {
        a: BoundaryRef,
        b: BoundaryRef,
        reverse: bool,
        ease: bool,
    },
    RemoveSeam {
        seam: String,
    },
    Place {
        panel: String,
        placement: Placement,
    },
    Mirror {
        panel: String,
        axis: MirrorAxis,
        copy_side: Option<i8>,
    },
}
impl WireCommand {
    fn native(self) -> Command {
        match self {
            Self::Fabric {
                panel,
                name,
                properties,
                all_panels,
            } => Command::Fabric {
                panel,
                name,
                properties,
                all_panels,
            },
            Self::Layout { panel, origin } => Command::Layout { panel, origin },
            Self::BoardTransform {
                panel,
                origin,
                rotation_degrees,
            } => Command::BoardTransform {
                panel,
                origin,
                rotation_degrees,
            },
            Self::Polygon {
                points,
                tangents,
                meshing,
                fabric,
            } => Command::Polygon {
                points,
                tangents,
                meshing,
                fabric,
                replace: false,
            },
            Self::Duplicate { panel } => Command::Duplicate { panel },
            Self::RemovePanel { panel } => Command::RemovePanel { panel },
            Self::Sew {
                a,
                b,
                reverse,
                ease,
            } => Command::Sew {
                a,
                b,
                reverse,
                ease,
            },
            Self::RemoveSeam { seam } => Command::RemoveSeam { seam },
            Self::Place { panel, placement } => Command::Place { panel, placement },
            Self::Mirror {
                panel,
                axis,
                copy_side,
            } => Command::Mirror {
                panel,
                axis,
                copy_side,
            },
        }
    }
}

#[derive(Deserialize)]
#[serde(tag = "op", rename_all = "snake_case", deny_unknown_fields)]
enum Operation {
    Hello {},
    Snapshot {},
    Open {
        guard: Guard,
        template: Box<GarmentTemplate>,
    },
    Edit {
        guard: Guard,
        command: WireCommand,
    },
    PrepareEdit {
        guard: Guard,
        command: WireCommand,
    },
    Commit {
        guard: Guard,
        change: String,
    },
    Cancel {
        guard: Guard,
        change: String,
    },
    Undo {
        guard: Guard,
    },
    Redo {
        guard: Guard,
    },
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct Request {
    protocol: String,
    protocol_version: u32,
    request_id: String,
    payload: Operation,
}

struct Failure {
    code: &'static str,
    detail: String,
}
fn fail(code: &'static str, detail: impl Into<String>) -> Failure {
    Failure {
        code,
        detail: detail.into(),
    }
}

/// One private in-memory editor. The opaque identity is not an authorization token.
pub struct Session {
    identity: tempfile::TempDir,
    template: Option<GarmentTemplate>,
    history: History,
    revision: u64,
    pending: Option<(String, Edit)>,
    next_change: u64,
}
fn identity() -> io::Result<tempfile::TempDir> {
    tempfile::Builder::new()
        .prefix("clothcraft-session-")
        .tempdir()
}
impl Session {
    pub fn new() -> io::Result<Self> {
        Ok(Self {
            identity: identity()?,
            template: None,
            history: History::default(),
            revision: 0,
            pending: None,
            next_change: 0,
        })
    }
    fn id(&self) -> String {
        self.identity
            .path()
            .file_name()
            .unwrap()
            .to_string_lossy()
            .into_owned()
    }
    fn snapshot(&self) -> Value {
        json!({"documentSession":self.id(),"revision":self.revision,"template":self.template,
            "canUndo":self.history.can_undo(),"canRedo":self.history.can_redo(),
            "pendingChange":self.pending.as_ref().map(|p| &p.0)})
    }
    fn guard(&self, guard: &Guard) -> Result<(), Failure> {
        if guard.document_session != self.id() {
            return Err(fail("stale_session", "Reload the current document session"));
        }
        if guard.expected_revision != self.revision {
            return Err(fail(
                "stale_revision",
                "Reload the current document revision",
            ));
        }
        Ok(())
    }
    fn next_revision(&self) -> Result<u64, Failure> {
        self.revision
            .checked_add(1)
            .ok_or_else(|| fail("revision_exhausted", "Open a new session"))
    }
    fn prepare(&self, command: WireCommand) -> Result<Edit, Failure> {
        let template = self
            .template
            .as_ref()
            .ok_or_else(|| fail("no_document", "Open a native template first"))?;
        authoring::apply(template, command.native()).map_err(|e| fail("invalid_geometry", e))
    }
    fn commit(&mut self, edit: Edit, next: u64) {
        self.history
            .record(self.template.take().expect("edit requires document"));
        self.template = Some(edit.template);
        self.revision = next;
        self.pending = None;
    }
    fn apply(&mut self, op: Operation) -> Result<Value, Failure> {
        match op {
            Operation::Hello {} => {
                return Ok(
                    json!({"supportedVersions":[1],"operations":OPERATIONS,"commands":COMMANDS,
                "nativeTemplateVersions":[1,2],"units":"metres","transport":"local-json-lines",
                "simulation":false,"desktopAttachment":false,"filesystemRequests":false,
                "maxMessageBytes":MAX_MESSAGE_BYTES,"session":self.snapshot()}),
                );
            }
            Operation::Snapshot {} => {}
            Operation::Open { guard, template } => {
                self.guard(&guard)?;
                if template.format != "marvelous-cloth-template"
                    || !matches!(template.version, 1 | 2)
                {
                    return Err(fail(
                        "unsupported_document_version",
                        "Expected a native template v1 or v2",
                    ));
                }
                template
                    .compile()
                    .map_err(|e| fail("compilation_failed", e))?;
                let identity = identity().map_err(|e| fail("io_failure", e.to_string()))?;
                self.identity = identity;
                self.template = Some(*template);
                self.history = History::default();
                self.revision = 0;
                self.pending = None;
                self.next_change = 0;
            }
            Operation::Edit { guard, command } => {
                self.guard(&guard)?;
                let next = self.next_revision()?;
                let edit = self.prepare(command)?;
                self.commit(edit, next);
            }
            Operation::PrepareEdit { guard, command } => {
                self.guard(&guard)?;
                if self.pending.is_some() {
                    return Err(fail(
                        "pending_change",
                        "Commit or cancel the pending change first",
                    ));
                }
                let number = self
                    .next_change
                    .checked_add(1)
                    .ok_or_else(|| fail("revision_exhausted", "Open a new session"))?;
                let edit = self.prepare(command)?;
                let change = format!("change-{number}");
                let result = json!({"change":change,"documentSession":self.id(),"revision":self.revision,
                    "template":edit.template,"resetsPhysicalCaches":edit.reset_simulation});
                self.pending = Some((change, edit));
                self.next_change = number;
                return Ok(result);
            }
            Operation::Commit { guard, change } => {
                self.guard(&guard)?;
                let next = self.next_revision()?;
                if self.pending.as_ref().map(|p| &p.0) != Some(&change) {
                    return Err(fail("invalid_change", "No matching prepared change"));
                }
                let (_, edit) = self.pending.take().unwrap();
                self.commit(edit, next);
            }
            Operation::Cancel { guard, change } => {
                self.guard(&guard)?;
                if self.pending.as_ref().map(|p| &p.0) != Some(&change) {
                    return Err(fail("invalid_change", "No matching prepared change"));
                }
                self.pending = None;
            }
            Operation::Undo { guard } => self.restore(guard, false)?,
            Operation::Redo { guard } => self.restore(guard, true)?,
        }
        Ok(self.snapshot())
    }
    fn restore(&mut self, guard: Guard, redo: bool) -> Result<(), Failure> {
        self.guard(&guard)?;
        let next = self.next_revision()?;
        let template = self
            .template
            .as_ref()
            .ok_or_else(|| fail("no_document", "Open a native template first"))?;
        let edit = self
            .history
            .restore(template, redo)
            .map_err(|e| fail("history_unavailable", e))?;
        self.template = Some(edit.template);
        self.revision = next;
        self.pending = None;
        Ok(())
    }
    /// Every rejected request leaves the resident document, pending edit and history unchanged.
    pub fn handle_line(&mut self, line: &str) -> Value {
        let mut request_id = None;
        let result = (|| {
            if line.len() > MAX_MESSAGE_BYTES {
                return Err(fail("message_too_large", "Request exceeds 2 MiB"));
            }
            let value: Value =
                serde_json::from_str(line).map_err(|e| fail("invalid_payload", e.to_string()))?;
            request_id = value
                .get("requestId")
                .and_then(Value::as_str)
                .filter(|s| s.len() <= 128)
                .map(str::to_owned);
            if value.get("protocol") != Some(&json!(PROTOCOL)) {
                return Err(fail("unsupported_protocol", "Use clothcraft.authoring"));
            }
            if value.get("protocolVersion").and_then(Value::as_u64) != Some(1) {
                return Err(fail("unsupported_protocol_version", "Supported version: 1"));
            }
            if let Some(op) = value["payload"]["op"].as_str()
                && !OPERATIONS.contains(&op)
            {
                return Err(fail("unsupported_operation", op));
            }
            if let Some(kind) = value["payload"]["command"]["kind"].as_str()
                && !COMMANDS.contains(&kind)
            {
                return Err(fail("unsupported_operation", kind));
            }
            let request: Request = serde_json::from_value(value).map_err(|e| {
                let message = e.to_string();
                fail(
                    if message.contains("unknown field") {
                        "unsupported_field"
                    } else {
                        "invalid_payload"
                    },
                    message,
                )
            })?;
            if request.request_id.is_empty() || request.request_id.len() > 128 {
                return Err(fail(
                    "invalid_payload",
                    "requestId must contain 1–128 bytes",
                ));
            }
            debug_assert_eq!(request.protocol, PROTOCOL);
            debug_assert_eq!(request.protocol_version, 1);
            self.apply(request.payload)
        })();
        match result {
            Ok(data) => {
                json!({"protocol":PROTOCOL,"protocolVersion":1,"requestId":request_id,"ok":true,"data":data})
            }
            Err(e) => {
                json!({"protocol":PROTOCOL,"protocolVersion":1,"requestId":request_id,"ok":false,"error":{"code":e.code,"detail":e.detail},"documentSession":self.id(),"revision":self.revision})
            }
        }
    }
}

/// Bounded framing drains an oversized line before processing the next request.
/// EOF accepts a final non-newline-terminated request. No stdout diagnostics.
pub fn serve(
    mut input: impl BufRead,
    mut output: impl Write,
    session: &mut Session,
) -> io::Result<()> {
    loop {
        let mut bytes = Vec::new();
        let mut oversized = false;
        let mut seen = false;
        loop {
            let buffer = input.fill_buf()?;
            if buffer.is_empty() {
                break;
            }
            seen = true;
            let end = buffer.iter().position(|b| *b == b'\n').map(|i| i + 1);
            let count = end.unwrap_or(buffer.len());
            if !oversized {
                if bytes.len().saturating_add(count) > MAX_MESSAGE_BYTES + 2 {
                    oversized = true;
                    bytes.clear();
                } else {
                    bytes.extend_from_slice(&buffer[..count]);
                }
            }
            input.consume(count);
            if end.is_some() {
                break;
            }
        }
        if !seen {
            break;
        }
        if bytes.last() == Some(&b'\n') {
            bytes.pop();
        }
        if bytes.last() == Some(&b'\r') {
            bytes.pop();
        }
        let response = if oversized || bytes.len() > MAX_MESSAGE_BYTES {
            json!({"protocol":PROTOCOL,"protocolVersion":1,"requestId":null,"ok":false,"error":{"code":"message_too_large","detail":"Request exceeds 2 MiB"}})
        } else {
            match std::str::from_utf8(&bytes) {
                Ok(line) => session.handle_line(line),
                Err(_) => {
                    json!({"protocol":PROTOCOL,"protocolVersion":1,"requestId":null,"ok":false,"error":{"code":"invalid_payload","detail":"Request is not UTF-8"}})
                }
            }
        };
        serde_json::to_writer(&mut output, &response)?;
        output.write_all(b"\n")?;
        output.flush()?;
    }
    Ok(())
}
