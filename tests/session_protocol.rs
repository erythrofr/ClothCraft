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
fn executable_answers_handshake_without_a_window_or_assets() {
    let mut child = std::process::Command::new(env!("CARGO_BIN_EXE_cloth-session"))
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .unwrap();
    let line=json!({"protocol":PROTOCOL,"protocolVersion":1,"requestId":"process","payload":{"op":"hello"}}).to_string();
    child
        .stdin
        .take()
        .unwrap()
        .write_all(line.as_bytes())
        .unwrap();
    let output = child.wait_with_output().unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let response: Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(response["ok"], true);
    assert_eq!(response["data"]["simulation"], false);
    assert_eq!(response["data"]["desktopAttachment"], false);
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
