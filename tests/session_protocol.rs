use marvelous_cloth::{
    garment::GarmentTemplate,
    session_protocol::{MAX_MESSAGE_BYTES, PROTOCOL, Session, serve},
};
use serde_json::{Value, json};
use std::io::Write;

fn request(session: &mut Session, payload: Value) -> Value {
    session.handle_line(
        &json!({"protocol":PROTOCOL,"protocolVersion":1,"requestId":"test","payload":payload})
            .to_string(),
    )
}
fn snapshot(session: &mut Session) -> Value {
    request(session, json!({"op":"snapshot"}))["data"].clone()
}
fn guard(snapshot: &Value) -> Value {
    json!({"documentSession":snapshot["documentSession"],"expectedRevision":snapshot["revision"]})
}
fn open(session: &mut Session) -> Value {
    let before = snapshot(session);
    let response = request(
        session,
        json!({"op":"open","guard":guard(&before),"template":GarmentTemplate::two_panel_demo()}),
    );
    assert_eq!(response["ok"], true, "{response}");
    response["data"].clone()
}
fn layout(snapshot: &Value, x: f64) -> Value {
    json!({"kind":"layout","panel":snapshot["template"]["panels"][0]["id"],"origin":[x,0.]})
}

#[test]
fn guarded_edit_history_and_reopen_reject_old_session() {
    let mut s = Session::new().unwrap();
    let initial = open(&mut s);
    let edit = request(
        &mut s,
        json!({"op":"edit","guard":guard(&initial),"command":layout(&initial,2.)}),
    );
    assert_eq!(edit["ok"], true, "{edit}");
    let changed = edit["data"].clone();
    assert_eq!(changed["revision"], 1);
    assert_eq!(
        changed["template"]["panels"][0]["layout_2d"],
        json!([2., 0.])
    );
    assert_eq!(changed["canUndo"], true);
    let stale = request(
        &mut s,
        json!({"op":"edit","guard":guard(&initial),"command":layout(&initial,3.)}),
    );
    assert_eq!(stale["error"]["code"], "stale_revision");
    assert_eq!(snapshot(&mut s), changed);
    let undo = request(&mut s, json!({"op":"undo","guard":guard(&changed)}));
    assert_eq!(undo["data"]["template"], initial["template"]);
    assert_eq!(undo["data"]["revision"], 2);
    let redo = request(&mut s, json!({"op":"redo","guard":guard(&undo["data"])}));
    assert_eq!(redo["data"]["template"], changed["template"]);
    let fresh = open(&mut s);
    assert_ne!(fresh["documentSession"], initial["documentSession"]);
    assert_eq!(fresh["revision"], 0);
    assert_eq!(fresh["canUndo"], false);
    let stale = request(
        &mut s,
        json!({"op":"edit","guard":guard(&initial),"command":layout(&initial,4.)}),
    );
    assert_eq!(stale["error"]["code"], "stale_session");
    assert_eq!(snapshot(&mut s), fresh);
    let mut other = Session::new().unwrap();
    assert_ne!(
        snapshot(&mut other)["documentSession"],
        fresh["documentSession"]
    );
}

#[test]
fn preparation_cancel_commit_and_failed_requests_are_atomic() {
    let mut s = Session::new().unwrap();
    let initial = open(&mut s);
    let prepared = request(
        &mut s,
        json!({"op":"prepare_edit","guard":guard(&initial),"command":layout(&initial,1.)}),
    );
    assert_eq!(prepared["ok"], true, "{prepared}");
    let pending = snapshot(&mut s);
    assert_eq!(pending["template"], initial["template"]);
    assert_eq!(pending["revision"], 0);
    assert_eq!(pending["canUndo"], false);
    let invalid = request(
        &mut s,
        json!({"op":"edit","guard":guard(&pending),"command":{"kind":"remove_panel","panel":"absent"}}),
    );
    assert_eq!(invalid["ok"], false);
    assert_eq!(snapshot(&mut s), pending);
    let cancel = request(
        &mut s,
        json!({"op":"cancel","guard":guard(&pending),"change":prepared["data"]["change"]}),
    );
    assert_eq!(cancel["data"], initial);
    let retry = request(
        &mut s,
        json!({"op":"prepare_edit","guard":guard(&initial),"command":layout(&initial,1.)}),
    );
    assert_ne!(retry["data"]["change"], prepared["data"]["change"]);
    let old = request(
        &mut s,
        json!({"op":"commit","guard":guard(&initial),"change":prepared["data"]["change"]}),
    );
    assert_eq!(old["error"]["code"], "invalid_change");
    let commit = request(
        &mut s,
        json!({"op":"commit","guard":guard(&initial),"change":retry["data"]["change"]}),
    );
    assert_eq!(commit["data"]["revision"], 1);
    assert_eq!(commit["data"]["template"], retry["data"]["template"]);
    assert_eq!(commit["data"]["canUndo"], true);
    let undo = request(&mut s, json!({"op":"undo","guard":guard(&commit["data"])}));
    assert_eq!(undo["data"]["template"], initial["template"]);
    assert_eq!(undo["data"]["canUndo"], false);
}

#[test]
fn strict_protocol_and_invalid_document_preserve_history() {
    let mut s = Session::new().unwrap();
    let initial = open(&mut s);
    let hello = request(&mut s, json!({"op":"hello"}));
    assert_eq!(hello["data"]["simulation"], false);
    for payload in [
        json!({"op":"shell","command":"anything"}),
        json!({"op":"snapshot","extra":1}),
        json!({"op":"hello","extra":1}),
        json!({"op":"edit","guard":guard(&initial),"command":{"kind":"unknown"}}),
        json!({"op":"edit","guard":guard(&initial),"command":{"kind":"layout","panel":"x","origin":[1,2],"extra":1}}),
    ] {
        assert_eq!(request(&mut s, payload.clone())["ok"], false, "{payload}");
        assert_eq!(snapshot(&mut s), initial);
    }
    let mut template = initial["template"].clone();
    template["version"] = json!(99);
    assert_eq!(
        request(
            &mut s,
            json!({"op":"open","guard":guard(&initial),"template":template})
        )["error"]["code"],
        "unsupported_document_version"
    );
    let mut template = initial["template"].clone();
    template["panels"] = json!([]);
    assert_eq!(
        request(
            &mut s,
            json!({"op":"open","guard":guard(&initial),"template":template})
        )["error"]["code"],
        "compilation_failed"
    );
    let bad = s.handle_line(
        &json!({"protocol":PROTOCOL,"protocolVersion":2,"requestId":"v2","payload":{"op":"hello"}})
            .to_string(),
    );
    assert_eq!(bad["error"]["code"], "unsupported_protocol_version");
    assert_eq!(snapshot(&mut s), initial);
}

#[test]
fn framing_recovers_after_oversize_invalid_utf8_and_final_line() {
    let mut s = Session::new().unwrap();
    let mut input = vec![b'x'; MAX_MESSAGE_BYTES + 128];
    input.push(b'\n');
    input.extend_from_slice(&[255, b'\n']);
    input.extend_from_slice(json!({"protocol":PROTOCOL,"protocolVersion":1,"requestId":"last","payload":{"op":"hello"}}).to_string().as_bytes());
    let mut output = Vec::new();
    serve(std::io::Cursor::new(input), &mut output, &mut s).unwrap();
    let responses: Vec<Value> = String::from_utf8(output)
        .unwrap()
        .lines()
        .map(|line| serde_json::from_str(line).unwrap())
        .collect();
    assert_eq!(responses.len(), 3);
    assert_eq!(responses[0]["error"]["code"], "message_too_large");
    assert_eq!(responses[1]["error"]["code"], "invalid_payload");
    assert_eq!(responses[2]["ok"], true);
    assert_eq!(responses[2]["requestId"], "last");
}

#[test]
fn exact_limit_accepts_crlf_and_rejects_one_extra_payload_byte() {
    let line = json!({"protocol":PROTOCOL,"protocolVersion":1,"requestId":"limit","payload":{"op":"hello"}}).to_string();
    let mut input = line.as_bytes().to_vec();
    input.resize(MAX_MESSAGE_BYTES, b' ');
    input.extend_from_slice(b"\r\n");
    input.extend_from_slice(line.as_bytes());
    input.extend(std::iter::repeat_n(
        b' ',
        MAX_MESSAGE_BYTES + 1 - line.len(),
    ));
    input.extend_from_slice(b"\r\n");
    let mut session = Session::new().unwrap();
    let mut output = Vec::new();
    serve(std::io::Cursor::new(input), &mut output, &mut session).unwrap();
    let rows: Vec<Value> = String::from_utf8(output)
        .unwrap()
        .lines()
        .map(|s| serde_json::from_str(s).unwrap())
        .collect();
    assert_eq!(rows.len(), 2);
    assert_eq!(rows[0]["ok"], true);
    assert_eq!(rows[1]["error"]["code"], "message_too_large");
}

#[test]
fn advertised_geometry_commands_reach_native_authoring_and_reopen() {
    fn edit(s: &mut Session, command: Value) -> Value {
        let before = snapshot(s);
        let result = request(
            s,
            json!({"op":"edit","guard":guard(&before),"command":command}),
        );
        assert_eq!(result["ok"], true, "{result}");
        assert_eq!(
            result["data"]["revision"].as_u64(),
            Some(before["revision"].as_u64().unwrap() + 1)
        );
        let template: GarmentTemplate =
            serde_json::from_value(result["data"]["template"].clone()).unwrap();
        template.compile().unwrap();
        result["data"].clone()
    }
    let mut s = Session::new().unwrap();
    let original = open(&mut s);
    let seam = &original["template"]["seams"][0];
    let unsewn = edit(&mut s, json!({"kind":"remove_seam","seam":seam["id"]}));
    assert_eq!(unsewn["template"]["seams"].as_array().unwrap().len(), 0);
    let sewn = edit(
        &mut s,
        json!({"kind":"sew","a":seam["a"],"b":seam["b"],"reverse":seam["reverse_b"],"ease":seam["allow_ease"]}),
    );
    assert_eq!(sewn["template"]["seams"].as_array().unwrap().len(), 1);
    let polygon = edit(
        &mut s,
        json!({"kind":"polygon","points":[[0.,0.],[0.2,0.],[0.2,0.3],[0.,0.3]],"tangents":[],
        "fabric":original["template"]["fabrics"][0]["id"],"meshing":{"target_edge_m":0.1,"max_vertices":128}}),
    );
    let panel = polygon["template"]["panels"][2]["id"].clone();
    let duplicate = edit(&mut s, json!({"kind":"duplicate","panel":panel}));
    assert_eq!(duplicate["template"]["panels"].as_array().unwrap().len(), 4);
    let copy = duplicate["template"]["panels"][3]["id"].clone();
    let moved = edit(
        &mut s,
        json!({"kind":"place","panel":copy,"placement":{"translation":[2.,0.,0.],"rotation_degrees":[0.,0.,0.]}}),
    );
    assert_eq!(
        moved["template"]["panels"][3]["placement"]["translation"],
        json!([2., 0., 0.])
    );
    edit(
        &mut s,
        json!({"kind":"mirror","panel":copy,"axis":"x","copy_side":null}),
    );
    let board = edit(
        &mut s,
        json!({"kind":"board_transform","panel":copy,"origin":[1.,2.],"rotation_degrees":45.}),
    );
    assert_eq!(
        board["template"]["panels"][3]["layout_rotation_degrees"],
        45.
    );
    let removed = edit(&mut s, json!({"kind":"remove_panel","panel":copy}));
    assert_eq!(removed["template"]["panels"].as_array().unwrap().len(), 3);
    let reopened = request(
        &mut s,
        json!({"op":"open","guard":guard(&removed),"template":removed["template"]}),
    );
    assert_eq!(reopened["ok"], true, "{reopened}");
    assert_eq!(reopened["data"]["template"], removed["template"]);
}

// Exercise the shipped process, not just Session/serve. A watchdog kills a stuck
// child so a missing flush, blocked pipe or EOF regression cannot hang CI.
struct Cli {
    child: std::sync::Arc<std::sync::Mutex<std::process::Child>>,
    input: Option<std::process::ChildStdin>,
    output: std::io::BufReader<std::process::ChildStdout>,
    watchdog: Option<(std::sync::mpsc::Sender<()>, std::thread::JoinHandle<()>)>,
    sequence: usize,
}
impl Cli {
    fn new() -> Self {
        use std::{
            process::{Command, Stdio},
            sync::{Arc, Mutex, mpsc},
            time::Duration,
        };
        let mut child = Command::new(env!("CARGO_BIN_EXE_cloth-session"))
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .spawn()
            .unwrap();
        let input = child.stdin.take();
        let output = std::io::BufReader::new(child.stdout.take().unwrap());
        let child = Arc::new(Mutex::new(child));
        let watched = child.clone();
        let (stop, receiver) = mpsc::channel();
        let worker = std::thread::spawn(move || {
            if receiver.recv_timeout(Duration::from_secs(30)).is_err() {
                let _ = watched.lock().unwrap().kill();
            }
        });
        Self {
            child,
            input,
            output,
            watchdog: Some((stop, worker)),
            sequence: 0,
        }
    }
    fn read(&mut self) -> Value {
        use std::io::{BufRead, Read};
        let mut row = Vec::new();
        // These public fixtures have small replies; bound failures as well.
        self.output
            .by_ref()
            .take(4 * MAX_MESSAGE_BYTES as u64)
            .read_until(b'\n', &mut row)
            .unwrap();
        assert_eq!(
            row.last(),
            Some(&b'\n'),
            "Missing complete reply (watchdog may have killed a stuck child)"
        );
        serde_json::from_slice(&row).unwrap()
    }
    fn raw(&mut self, bytes: &[u8]) -> Value {
        let input = self.input.as_mut().unwrap();
        input.write_all(bytes).unwrap();
        input.flush().unwrap();
        self.read()
    }
    fn request(&mut self, payload: Value) -> Value {
        self.sequence += 1;
        let id = format!("cli-{}", self.sequence);
        let line = format!(
            "{}\n",
            json!({"protocol":PROTOCOL,"protocolVersion":1,"requestId":id,"payload":payload})
        );
        let response = self.raw(line.as_bytes());
        assert_eq!(response["requestId"], id);
        assert_eq!(response["protocol"], PROTOCOL);
        assert_eq!(response["protocolVersion"], 1);
        response
    }
    fn finish(&mut self) {
        self.input.take();
        loop {
            if let Some(status) = self.child.lock().unwrap().try_wait().unwrap() {
                assert!(
                    status.success(),
                    "Session failed or exceeded the 30-second watchdog: {status}"
                );
                break;
            }
            std::thread::sleep(std::time::Duration::from_millis(10));
        }
        use std::io::Read;
        let mut tail = Vec::new();
        self.output
            .by_ref()
            .take(4096)
            .read_to_end(&mut tail)
            .unwrap();
        assert!(tail.is_empty(), "Unexpected trailing stdout: {tail:?}");
    }
}
impl Drop for Cli {
    fn drop(&mut self) {
        let mut child = self.child.lock().unwrap();
        let _ = child.kill();
        let _ = child.wait();
        drop(child);
        if let Some((stop, worker)) = self.watchdog.take() {
            let _ = stop.send(());
            let _ = worker.join();
        }
    }
}

#[test]
fn cli_interactive_pipes_preserve_transactions_and_recover_framing() {
    let mut cli = Cli::new();
    let hello = cli.request(json!({"op":"hello"}));
    assert_eq!(hello["ok"], true);
    assert_eq!(hello["data"]["simulation"], false);
    assert_eq!(hello["data"]["desktopAttachment"], false);
    // Read while stdin stays open: a process that only flushes at EOF fails.
    let initial = cli.request(json!({"op":"snapshot"}))["data"].clone();
    let opened = cli.request(
        json!({"op":"open","guard":guard(&initial),"template":GarmentTemplate::two_panel_demo()}),
    );
    assert_eq!(opened["ok"], true, "{opened}");
    let before = opened["data"].clone();
    let prepared = cli.request(
        json!({"op":"prepare_edit","guard":guard(&before),"command":layout(&before, 1.25)}),
    );
    assert_eq!(prepared["ok"], true, "{prepared}");
    let pending = cli.request(json!({"op":"snapshot"}))["data"].clone();
    assert_eq!(pending["template"], before["template"]);
    assert_eq!(pending["revision"], before["revision"]);
    let cancelled = cli.request(
        json!({"op":"cancel","guard":guard(&pending),"change":prepared["data"]["change"]}),
    );
    assert_eq!(cancelled["data"], before);
    let prepared = cli.request(
        json!({"op":"prepare_edit","guard":guard(&before),"command":layout(&before, 1.25)}),
    );
    let committed = cli
        .request(json!({"op":"commit","guard":guard(&before),"change":prepared["data"]["change"]}));
    assert_eq!(committed["ok"], true, "{committed}");
    let after = committed["data"].clone();
    assert_eq!(
        after["template"]["panels"][0]["layout_2d"],
        json!([1.25, 0.])
    );
    let stale = cli.request(json!({"op":"undo","guard":guard(&before)}));
    assert_eq!(stale["error"]["code"], "stale_revision");
    assert_eq!(cli.request(json!({"op":"snapshot"}))["data"], after);
    let undone = cli.request(json!({"op":"undo","guard":guard(&after)}));
    assert_eq!(undone["data"]["template"], before["template"]);
    let redone = cli.request(json!({"op":"redo","guard":guard(&undone["data"])}));
    assert_eq!(redone["data"]["template"], after["template"]);
    let stable = redone["data"].clone();
    for malformed in [b"{broken}\n".as_slice(), b"\xff\n".as_slice()] {
        assert_eq!(cli.raw(malformed)["error"]["code"], "invalid_payload");
    }
    let mut oversized = vec![b' '; MAX_MESSAGE_BYTES + 1];
    oversized.push(b'\n');
    assert_eq!(cli.raw(&oversized)["error"]["code"], "message_too_large");
    assert_eq!(cli.request(json!({"op":"snapshot"}))["data"], stable);
    // EOF is also a valid final request delimiter.
    let last = json!({"protocol":PROTOCOL,"protocolVersion":1,"requestId":"eof","payload":{"op":"snapshot"}}).to_string();
    cli.input
        .as_mut()
        .unwrap()
        .write_all(last.as_bytes())
        .unwrap();
    cli.input.take();
    let eof = cli.read();
    assert_eq!(eof["requestId"], "eof");
    assert_eq!(eof["data"], stable);
    cli.finish();
}

#[test]
fn mechanical_fabric_commands_preserve_transaction_and_shared_material_rules() {
    use marvelous_cloth::authoring::{self, Command};
    let mut session = Session::new().unwrap();
    let initial = open(&mut session);
    let hello = request(&mut session, json!({"op":"hello"}));
    assert!(
        hello["data"]["commands"]
            .as_array()
            .unwrap()
            .contains(&json!("fabric"))
    );
    let source: GarmentTemplate = serde_json::from_value(initial["template"].clone()).unwrap();
    let mut properties = source.fabrics[0].properties.clone();
    properties.density *= 1.5;
    let command = json!({"kind":"fabric","panel":source.panels[0].id,"name":"Test fabric","properties":properties,"all_panels":false});
    let prepared = request(
        &mut session,
        json!({"op":"prepare_edit","guard":guard(&initial),"command":command}),
    );
    assert_eq!(prepared["ok"], true, "{prepared}");
    let pending = snapshot(&mut session);
    assert_eq!(pending["template"], initial["template"]);
    for field in ["density", "thickness"] {
        let mut invalid = command.clone();
        invalid["properties"][field] = json!(-1.);
        let reply = request(
            &mut session,
            json!({"op":"edit","guard":guard(&pending),"command":invalid}),
        );
        assert_eq!(reply["ok"], false, "{reply}");
        assert_eq!(snapshot(&mut session), pending);
    }
    let mut unknown = command.clone();
    unknown["properties"]["unrecognized"] = json!(1);
    assert_eq!(
        request(
            &mut session,
            json!({"op":"edit","guard":guard(&pending),"command":unknown})
        )["error"]["code"],
        "unsupported_field"
    );
    assert_eq!(snapshot(&mut session), pending);
    let cancelled = request(
        &mut session,
        json!({"op":"cancel","guard":guard(&pending),"change":prepared["data"]["change"]}),
    );
    assert_eq!(cancelled["data"], initial);
    for all_panels in [false, true] {
        let before = snapshot(&mut session);
        let mut command = command.clone();
        command["all_panels"] = json!(all_panels);
        let prepared = request(
            &mut session,
            json!({"op":"prepare_edit","guard":guard(&before),"command":command}),
        );
        assert_eq!(prepared["ok"], true, "{prepared}");
        let applied = request(
            &mut session,
            json!({"op":"commit","guard":guard(&before),"change":prepared["data"]["change"]}),
        );
        assert_eq!(applied["ok"], true, "{applied}");
        let expected = authoring::apply(
            &source,
            Command::Fabric {
                panel: source.panels[0].id.clone(),
                name: "Test fabric".into(),
                properties: properties.clone(),
                all_panels,
            },
        )
        .unwrap();
        assert!(expected.reset_simulation);
        assert_eq!(
            applied["data"]["template"],
            serde_json::to_value(&expected.template).unwrap()
        );
        let panels = &applied["data"]["template"]["panels"];
        assert_eq!(panels[0]["fabric"] == panels[1]["fabric"], all_panels);
        let undo = request(
            &mut session,
            json!({"op":"undo","guard":guard(&applied["data"])}),
        );
        assert_eq!(undo["data"]["template"], initial["template"]);
        let redo = request(
            &mut session,
            json!({"op":"redo","guard":guard(&undo["data"])}),
        );
        assert_eq!(redo["data"]["template"], applied["data"]["template"]);
        let undo = request(
            &mut session,
            json!({"op":"undo","guard":guard(&redo["data"])}),
        );
        assert_eq!(undo["data"]["template"], initial["template"]);
    }
}
