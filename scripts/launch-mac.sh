#!/bin/zsh
set -eu
ROOT="${0:A:h:h}"
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS:/Applications/Codex.app/Contents/Resources:$PATH"
cd "$ROOT"
mkdir -p .local
fail() {
  /usr/bin/osascript - "$1" <<'APPLESCRIPT'
on run argv
  display dialog (item 1 of argv) with title "Kirat Lead Desk" buttons {"OK"} default button "OK" with icon caution
end run
APPLESCRIPT
  exit 1
}
NODE="$(command -v node || true)"
[[ -n "$NODE" ]] || fail "Node.js 20 or newer is required. Install Node.js, then reopen this app."
"$NODE" -e 'if(Number(process.versions.node.split(".")[0])<20)process.exit(1)' || fail "Please update Node.js to version 20 or newer, then reopen this app."
open_app() { if [[ "${1:-}" != "--no-open" ]]; then /usr/bin/open http://127.0.0.1:4173/; fi }
MODE="${1:-}"
IDENTITY="$("$NODE" -e 'console.log(require("./lib/local-server").identity)')"
HEALTH="$(/usr/bin/curl --silent --max-time 2 http://127.0.0.1:4173/health || true)"
if [[ "$HEALTH" == *"$IDENTITY"* && "$HEALTH" == *"kirat-local-app-v1"* ]]; then
  open_app "$MODE"
  exit 0
fi
# Only one Finder launch may claim startup at a time.
if ! mkdir .local/launch.lock 2>/dev/null; then
  for attempt in {1..20}; do
    HEALTH="$(/usr/bin/curl --silent --max-time 1 http://127.0.0.1:4173/health || true)"
    if [[ "$HEALTH" == *"$IDENTITY"* ]]; then open_app "$MODE"; exit 0; fi
    sleep 1
  done
  fail "Another launch is still starting. Try again shortly. If it failed, remove .local/launch.lock in the project folder."
fi
trap 'rmdir "$ROOT/.local/launch.lock" 2>/dev/null || true' EXIT
/usr/bin/nohup "$NODE" bin/kirat.js app >.local/app.log 2>&1 </dev/null &
PID=$!
for attempt in {1..40}; do
  HEALTH="$(/usr/bin/curl --silent --max-time 1 http://127.0.0.1:4173/health || true)"
  if [[ "$HEALTH" == *"$IDENTITY"* ]]; then
    open_app "$MODE"
    exit 0
  fi
  kill -0 "$PID" 2>/dev/null || fail "The local service could not start. Port 4173 may already be in use. Details are in .local/app.log inside the project folder."
  sleep 0.5
done
fail "Startup took too long. See .local/app.log in the project folder."
