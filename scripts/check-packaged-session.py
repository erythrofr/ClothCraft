#!/usr/bin/env python3
"""Exercise the shipped authoring process, without graphics or third-party Python packages."""
import argparse
import contextlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import threading

PROTOCOL = "clothcraft.authoring"
MAX_REPLY = 16 * 1024 * 1024


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


class Client:
    def __init__(self, command, cwd, timeout=60):
        self.count = 0
        self.expired = threading.Event()
        self.stderr = tempfile.TemporaryFile(mode="w+b")
        try:
            self.process = subprocess.Popen(
                command, cwd=cwd, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                stderr=self.stderr, text=True, encoding="utf-8",
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
            )
        except BaseException:
            self.stderr.close()
            raise
        self.timer = threading.Timer(timeout, self.expire)
        self.timer.daemon = True
        self.timer.start()

    def expire(self):
        self.expired.set()
        with contextlib.suppress(ProcessLookupError):
            if self.process.poll() is None:
                self.process.kill()

    def send(self, payload, error=None):
        self.count += 1
        request_id = str(self.count)
        request = dict(protocol=PROTOCOL, protocolVersion=1,
                       requestId=request_id, payload=payload)
        self.process.stdin.write(json.dumps(request, allow_nan=False) + "\n")
        self.process.stdin.flush()
        line = self.process.stdout.readline(MAX_REPLY + 1)
        require(not self.expired.is_set(), "Authoring process timed out")
        require(line and len(line) <= MAX_REPLY and line.endswith("\n"),
                "Missing, oversized or unterminated JSON reply")
        reply = json.loads(line)
        require(isinstance(reply, dict), "Reply must be a JSON object")
        require((reply.get("protocol"), reply.get("protocolVersion"), reply.get("requestId"))
                == (PROTOCOL, 1, request_id), "Reply envelope/identity mismatch")
        if error:
            require(reply.get("ok") is False and reply.get("error", {}).get("code") == error,
                    f"Expected {error}: {reply}")
            return reply
        require(reply.get("ok") is True, f"Rejected request {payload['op']}: {reply}")
        return reply["data"]

    def finish(self):
        self.process.stdin.close()
        # Drain stdout before wait so unexpected trailing output cannot deadlock.
        extra = self.process.stdout.read(MAX_REPLY + 1)
        require(not extra, "Unexpected output after the final response")
        code = self.process.wait(timeout=10)
        require(not self.expired.is_set(), "Authoring process timed out at EOF")
        require(code == 0, f"Authoring process exited with {code}")

    def close(self):
        self.timer.cancel()
        if self.process.poll() is None:
            self.process.kill()
        self.process.wait(timeout=10)
        self.process.stdin.close()
        self.process.stdout.close()
        self.stderr.close()


@contextlib.contextmanager
def client(command, cwd, timeout=60):
    session = Client(command, cwd, timeout)
    try:
        yield session
        session.finish()
    except BaseException:
        session.stderr.seek(0)
        diagnostic = session.stderr.read(4096).decode("utf-8", errors="replace")
        if diagnostic:
            print(diagnostic)
        raise
    finally:
        session.close()


def guard(snapshot):
    return dict(documentSession=snapshot["documentSession"], expectedRevision=snapshot["revision"])


def open_template(c, template):
    hello = c.send(dict(op="hello"))
    require(all(hello.get(k) is False for k in ("simulation", "desktopAttachment", "filesystemRequests")),
            "Unexpected authoring capabilities")
    initial = c.send(dict(op="snapshot"))
    require(initial == hello["session"] and initial["template"] is None and initial["revision"] == 0,
            "Process did not start empty")
    opened = c.send(dict(op="open", guard=guard(initial), template=template))
    require(opened["documentSession"] != initial["documentSession"], "Open did not replace identity")
    require(opened["revision"] == 0 and not opened["canUndo"] and not opened["canRedo"],
            "Open retained history")
    return opened


def edit(c, snapshot, command):
    changed = c.send(dict(op="edit", guard=guard(snapshot), command=command))
    require(changed["documentSession"] == snapshot["documentSession"]
            and changed["revision"] == snapshot["revision"] + 1, "Edit revision mismatch")
    require(changed["template"] != snapshot["template"], "Edit had no effect")
    return changed


def check_package(package):
    package = Path(package).resolve(strict=True)
    require(package.is_dir(), "Expected the staged artifact directory")
    with tempfile.TemporaryDirectory(prefix="ClothCraft session check ") as temporary:
        root = Path(temporary) / "Extracted Package"
        shutil.copytree(package, root)
        executable = root / ("cloth-session.exe" if os.name == "nt" else "cloth-session")
        require(executable.is_file(), "Artifact is missing cloth-session")
        command = [str(executable)]
        template = json.loads((root / "examples/templates/two-panel.json").read_text(encoding="utf-8"))
        with client(command, root) as c:
            s = open_template(c, template)
            original_ids = [p["id"] for p in s["template"]["panels"]]
            fabric = s["template"]["fabrics"][0]["id"]
            for _ in range(2):
                s = edit(c, s, dict(kind="polygon", points=[[0, 0], [.2, 0], [.2, .3], [0, .3]],
                                    tangents=[], meshing=dict(target_edge_m=.04), fabric=fabric))
            for panel in original_ids:
                s = edit(c, s, dict(kind="remove_panel", panel=panel))
            panels = s["template"]["panels"]
            require(len(panels) == 2 and not s["template"]["seams"], "Unexpected panel/seam count")
            def boundary(panel):
                return dict(panel=panel["id"], side="bottom", edge=panel["polygon"]["edges"][0],
                            range=[0, 1], reversed=False)
            before_sew = s
            s = edit(c, s, dict(kind="sew", a=boundary(panels[0]), b=boundary(panels[1]),
                               reverse=True, ease=False))
            sewn = s["template"]
            require(len(sewn["seams"]) == 1, "Sew did not create one seam")
            c.send(dict(op="undo", guard=guard(before_sew)), error="stale_revision")
            require(c.send(dict(op="snapshot")) == s, "Stale request changed state")
            undone = c.send(dict(op="undo", guard=guard(s)))
            require(undone["template"] == before_sew["template"] and undone["revision"] == s["revision"] + 1,
                    "Undo did not restore the pre-seam template")
            redone = c.send(dict(op="redo", guard=guard(undone)))
            require(redone["template"] == sewn and redone["revision"] == undone["revision"] + 1,
                    "Redo did not restore the seam")
            old_guard = guard(redone)
            requests = c.count
        # Only the client accesses files. A fresh process must need no resident state.
        saved = Path(temporary) / "Two sewn panels.json"
        with saved.open("x", encoding="utf-8") as f:
            json.dump(sewn, f, allow_nan=False)
        with client(command, root) as c:
            reopened = open_template(c, json.loads(saved.read_text(encoding="utf-8")))
            require(reopened["template"] == sewn, "Fresh-process round-trip changed the garment")
            c.send(dict(op="undo", guard=old_guard), error="stale_session")
            require(c.send(dict(op="snapshot")) == reopened, "Foreign guard changed state")
            requests += c.count
        return dict(passed=True, requests=requests, processes=2, panels=2, seams=1, graphics=False)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("package", help="Staged artifact directory (copied to an isolated path with spaces)")
    args = parser.parse_args()
    print(json.dumps(check_package(args.package)))
