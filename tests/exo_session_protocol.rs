//! End-to-end checks for the optional EXO JSON-lines session executable.
use serde_json::{Value, json};
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, ChildStdin, ChildStdout, Command, Stdio};

struct Session {
    child: Child,
    input: ChildStdin,
    output: BufReader<ChildStdout>,
}

impl Session {
    fn launch() -> Self {
        let avatar = format!(
            "{}/assets/makehuman/mannequin.obj",
            env!("CARGO_MANIFEST_DIR")
        );
        let mut child = Command::new(env!("CARGO_BIN_EXE_exo-session"))
            .arg(avatar)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .expect("launch session process");
        let input = child.stdin.take().expect("stdin pipe");
        let output = BufReader::new(child.stdout.take().expect("stdout pipe"));
        Self {
            child,
            input,
            output,
        }
    }

    fn request(&mut self, value: &Value) -> Value {
        writeln!(self.input, "{value}").expect("write JSON request");
        self.input.flush().expect("flush request");
        let mut line = String::new();
        self.output
            .read_line(&mut line)
            .expect("read JSON response");
        assert!(!line.is_empty(), "session returned no JSON response");
        serde_json::from_str(&line).expect("parse response")
    }
}

impl Drop for Session {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

#[test]
fn session_preserves_revision_and_rejects_bad_property_edits() {
    let mut session = Session::launch();
    let opened = session.request(&json!({"op":"open","preset":"tshirt"}));
    assert_eq!(opened["ok"], true, "open failed: {opened}");
    let id = opened["data"]["template"]["panels"][0]["id"]
        .as_str()
        .expect("panel ID")
        .to_string();
    let rev = opened["data"]["revision"].as_u64().expect("revision");

    let edit = session.request(&json!({"op":"set-property","target":"panel","id":id,"field":"name","value":"EXO Test Panel","revision":rev}));
    assert_eq!(edit["ok"], true, "edit failed: {edit}");
    assert_eq!(edit["data"]["revision"], rev + 1);
    assert_eq!(
        edit["data"]["template"]["panels"][0]["name"],
        "EXO Test Panel"
    );

    let stale = session.request(&json!({"op":"set-property","target":"panel","id":id,"field":"name","value":"Stale","revision":rev}));
    assert_eq!(stale["ok"], false);
    assert!(stale["error"].as_str().unwrap_or("").contains("Stale"));

    let invalid = session.request(&json!({"op":"set-property","target":"panel","id":"unknown","field":"name","value":"Broken","revision":rev + 1}));
    assert_eq!(invalid["ok"], false);
    let snapshot = session.request(&json!({"op":"snapshot"}));
    assert_eq!(snapshot["ok"], true);
    assert_eq!(snapshot["data"]["revision"], rev + 1);
    assert_eq!(
        snapshot["data"]["template"]["panels"][0]["name"],
        "EXO Test Panel"
    );
}
