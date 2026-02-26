#!/usr/bin/env bash
set -euo pipefail

# Usage:
# ag_run.sh --job-id <id> --engine <claude|gemini|openai|shell> --repo <path> --command <text> [--args '<json-array>'] [--model <model-id>] [--system-prompt <text>]

JOB_ID=""
ENGINE=""
REPO=""
COMMAND_TEXT=""
ARGS_JSON='[]'
MCP_SERVERS=""
MODEL=""
SYSTEM_PROMPT=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --job-id) JOB_ID="$2"; shift 2 ;;
    --engine) ENGINE="$2"; shift 2 ;;
    --repo) REPO="$2"; shift 2 ;;
    --command) COMMAND_TEXT="$2"; shift 2 ;;
    --args) ARGS_JSON="$2"; shift 2 ;;
    --mcp-servers) MCP_SERVERS="$2"; shift 2 ;;
    --model) MODEL="$2"; shift 2 ;;
    --system-prompt) SYSTEM_PROMPT="$2"; shift 2 ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

if [[ -z "$JOB_ID" || -z "$ENGINE" || -z "$REPO" || -z "$COMMAND_TEXT" ]]; then
  echo '{"ok":false,"error":"missing required args"}'
  exit 2
fi

if [[ ! -d "$REPO" ]]; then
  echo "{\"ok\":false,\"error\":\"repo not found: $REPO\"}"
  exit 2
fi

cd "$REPO"

join_args() {
  python3 - <<'PY'
import json, os
raw = os.environ.get('ARGS_JSON','[]')
try:
    a = json.loads(raw)
    if not isinstance(a, list):
        a = []
except Exception:
    a = []
print(' '.join(str(x) for x in a))
PY
}

ARGS_JOINED="$(ARGS_JSON="$ARGS_JSON" join_args)"

case "$ENGINE" in
  shell)
    OUT="$(bash -lc "$COMMAND_TEXT $ARGS_JOINED" 2>&1)"
    python3 - <<'PY'
import json, os
print(json.dumps({"ok": True, "engine": "shell", "result": os.environ.get("OUT","")[:12000]}))
PY
    ;;

  claude)
    PROMPT="$COMMAND_TEXT"
    if [[ -n "$ARGS_JOINED" ]]; then
      PROMPT="$PROMPT\n\nArgs: $ARGS_JOINED"
    fi

    # Build --mcp-server flags from comma-separated list
    MCP_FLAGS=()
    if [[ -n "$MCP_SERVERS" ]]; then
      IFS=',' read -ra MCP_ARRAY <<< "$MCP_SERVERS"
      for srv in "${MCP_ARRAY[@]}"; do
        srv="$(echo "$srv" | xargs)"  # trim whitespace
        if [[ -n "$srv" ]]; then
          MCP_FLAGS+=(--mcp-server "$srv")
        fi
      done
    fi

    # Build --model flag
    MODEL_FLAGS=()
    if [[ -n "$MODEL" ]]; then
      MODEL_FLAGS+=(--model "$MODEL")
    fi

    # Build --system-prompt flag
    SYSTEM_FLAGS=()
    if [[ -n "$SYSTEM_PROMPT" ]]; then
      SYSTEM_FLAGS+=(--system-prompt "$SYSTEM_PROMPT")
    fi

    # Allow nested CLI calls (e.g. from launchd services)
    unset CLAUDECODE 2>/dev/null || true

    # Try AntiGravity proxy first, fall back to direct CLI
    if curl -fsS http://localhost:8080/health >/dev/null 2>&1; then
      OUT="$(ANTHROPIC_BASE_URL="http://localhost:8080" ANTHROPIC_AUTH_TOKEN="test" claude -p --permission-mode bypassPermissions "${MODEL_FLAGS[@]}" "${SYSTEM_FLAGS[@]}" "${MCP_FLAGS[@]}" "$PROMPT" 2>&1 || true)"
    else
      # Direct CLI mode — uses Claude's own authenticated session
      OUT="$(claude -p --permission-mode bypassPermissions "${MODEL_FLAGS[@]}" "${SYSTEM_FLAGS[@]}" "${MCP_FLAGS[@]}" "$PROMPT" 2>&1 || true)"
    fi

    if echo "$OUT" | grep -qi "Not logged in"; then
      python3 - <<'PY'
import json, os
print(json.dumps({"ok": False, "engine": "claude", "error": "Claude CLI not authenticated", "raw": os.environ.get("OUT","")[:2000]}))
PY
      exit 20
    fi

    OUT="$OUT" python3 - <<'PY'
import json, os
print(json.dumps({"ok": True, "engine": "claude", "result": os.environ.get("OUT","")[:12000]}))
PY
    ;;

  gemini)
    if ! curl -fsS http://localhost:8080/health >/dev/null 2>&1; then
      python3 - <<'PY'
import json
print(json.dumps({"ok": False, "engine": "gemini", "error": "AntiGravity proxy not running on :8080"}))
PY
      exit 10
    fi

    USER_MSG="$COMMAND_TEXT"
    if [[ -n "$ARGS_JOINED" ]]; then
      USER_MSG="$USER_MSG\nArgs: $ARGS_JOINED"
    fi

    PAYLOAD="$(python3 - <<'PY'
import json, os
print(json.dumps({
  "model": "gemini-3-flash",
  "max_tokens": 1024,
  "messages": [{"role":"user","content": os.environ.get("USER_MSG","")}]
}))
PY
)"
    OUT="$(curl -sS http://localhost:8080/v1/messages -H 'content-type: application/json' -H 'anthropic-version: 2023-06-01' -H 'x-api-key: test' -d "$PAYLOAD" 2>&1)"
    OUT="$OUT" python3 - <<'PY'
import json, os
print(json.dumps({"ok": True, "engine": "gemini", "result": os.environ.get("OUT","")[:12000]}))
PY
    ;;

  openai)
    if [[ -z "${OPENAI_API_KEY:-}" ]]; then
      python3 - <<'PY'
import json
print(json.dumps({"ok": False, "engine": "openai", "error": "OPENAI_API_KEY not set"}))
PY
      exit 20
    fi

    USER_MSG="$COMMAND_TEXT"
    if [[ -n "$ARGS_JOINED" ]]; then
      USER_MSG="$USER_MSG\nArgs: $ARGS_JOINED"
    fi

    PAYLOAD="$(python3 - <<'PY'
import json, os
print(json.dumps({"model":"gpt-4.1-mini","input": os.environ.get("USER_MSG","")}))
PY
)"
    OUT="$(curl -sS https://api.openai.com/v1/responses -H 'content-type: application/json' -H "Authorization: Bearer ${OPENAI_API_KEY}" -d "$PAYLOAD" 2>&1)"
    OUT="$OUT" python3 - <<'PY'
import json, os
print(json.dumps({"ok": True, "engine": "openai", "result": os.environ.get("OUT","")[:12000]}))
PY
    ;;

  *)
    echo "{\"ok\":false,\"error\":\"unsupported engine: $ENGINE\"}"
    exit 2
    ;;
esac
