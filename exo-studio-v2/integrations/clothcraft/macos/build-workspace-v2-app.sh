#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT"
export EXO_DESKTOP_DEST="${EXO_DESKTOP_DEST:-$HOME/Applications/EXO ClothCraft Studio V2.app}"

# Rebuilding a running .app can leave its previously launched localhost Node
# processes orphaned after an abrupt AppKit termination. Those stale services
# will then occupy 5385/5386 and make the new window look broken. Handle only
# processes whose executable AND script paths match this exact installed app.
if [[ -d "$EXO_DESKTOP_DEST" ]]; then
  for port in 5385 5386; do
    while read -r pid; do
      [[ "$pid" =~ ^[0-9]+$ ]] || continue
      cmd="$(ps -p "$pid" -o command= 2>/dev/null || true)"
      if [[ "$cmd" == *"EXO-ClothCraft-Studio-V2/Runtime/node "* && "$cmd" == *"$EXO_DESKTOP_DEST/Contents/Resources/integrations/clothcraft/"* ]]; then
        if [[ "$port" == 5385 ]]; then
          # Save the user's persistent Rust workspace before stopping services.
          curl -fsS --connect-timeout 2 --max-time 10 -X POST \
            -H 'Origin: http://127.0.0.1:5386' -H 'Content-Type: application/json' \
            --data '{"op":"pause"}' http://127.0.0.1:5385/workspace >/dev/null || true
          curl -fsS --connect-timeout 2 --max-time 10 -X POST \
            -H 'Origin: http://127.0.0.1:5386' -H 'Content-Type: application/json' \
            --data '{"op":"save"}' http://127.0.0.1:5385/workspace >/dev/null || true
          while read -r child; do
            [[ "$child" =~ ^[0-9]+$ ]] || continue
            childcmd="$(ps -p "$child" -o command= 2>/dev/null || true)"
            [[ "$childcmd" == "$EXO_DESKTOP_DEST/Contents/Resources/research/oss/clothcraft/target/debug/exo-session "* ]] && kill -TERM "$child" 2>/dev/null || true
          done < <(pgrep -P "$pid" || true)
        fi
        kill -TERM "$pid" 2>/dev/null || true
      fi
    done < <(lsof -nP -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)
  done
  while read -r pid command; do
    if [[ "$command" == "$EXO_DESKTOP_DEST/Contents/MacOS/EXOClothCraft" ]]; then
      kill -TERM "$pid" 2>/dev/null || true
    fi
  done < <(ps -axo pid=,command=)
  sleep 1
fi
export CARGO_HOME="$ROOT/research/runtime/clothcraft-rust-toolchain/cargo"
export RUSTUP_HOME="$ROOT/research/runtime/clothcraft-rust-toolchain/rustup"
export PATH="$CARGO_HOME/bin:/usr/local/bin:$PATH"
if [[ -e research/oss/clothcraft/src/bin/exo-session.rs ]] && \
   ! cmp -s integrations/clothcraft/exo-session.rs research/oss/clothcraft/src/bin/exo-session.rs; then
  echo 'Refusing to overwrite different local Rust session work in the ClothCraft checkout.' >&2
  echo 'Review src/bin/exo-session.rs and integrations/clothcraft/exo-session.rs before packaging.' >&2
  exit 1
fi
cp integrations/clothcraft/exo-session.rs research/oss/clothcraft/src/bin/exo-session.rs
(cd research/oss/clothcraft && cargo build --locked -j 2 --bin exo-session)
export EXO_DESKTOP_SWIFT_SOURCE=integrations/clothcraft/macos/EXOClothCraftWorkspaceV2.swift
export EXO_BUILD_BRIDGE_URL=http://127.0.0.1:5385
bash integrations/clothcraft/macos/build.sh
/usr/libexec/PlistBuddy -c 'Set :CFBundleIdentifier com.mikristian.exo.clothcraft.workspace.v2' "$EXO_DESKTOP_DEST/Contents/Info.plist"
/usr/libexec/PlistBuddy -c 'Set :CFBundleDisplayName EXO ClothCraft Studio V2' "$EXO_DESKTOP_DEST/Contents/Info.plist"
/usr/libexec/PlistBuddy -c 'Set :CFBundleShortVersionString 0.3.0' "$EXO_DESKTOP_DEST/Contents/Info.plist"
/usr/bin/codesign --force --deep --sign - "$EXO_DESKTOP_DEST"
/usr/bin/codesign --verify --deep --strict "$EXO_DESKTOP_DEST"
