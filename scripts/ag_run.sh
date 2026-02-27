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

if [[ -z "$JOB_ID" || -z "$ENGINE" || -z "$COMMAND_TEXT" ]]; then
  echo '{"ok":false,"error":"missing required args"}'
  exit 2
fi

# Default repo to mission-control if not set or invalid
MC_REPO="/Users/david/.openclaw/workspace/mission-control"
if [[ -z "$REPO" || "$REPO" == "null" || ! -d "$REPO" ]]; then
  REPO="$MC_REPO"
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

    # Build --mcp-config from agent's assigned MCP servers
    # Reads mcp-servers.json (master config), filters to only this agent's servers,
    # writes a temp config JSON, passes it via --mcp-config
    MCP_FLAGS=()
    MCP_BASE="$MC_REPO/mcp-servers.json"
    if [[ -n "$MCP_SERVERS" ]]; then
      if [[ "$MCP_SERVERS" == /* || "$MCP_SERVERS" == ./* ]]; then
        # Direct file path — use as-is
        if [[ -f "$MCP_SERVERS" ]]; then
          MCP_FLAGS+=(--mcp-config "$MCP_SERVERS")
        fi
      elif [[ -f "$MCP_BASE" ]]; then
        # Comma-separated server names — filter from master config
        MCP_TMP="/tmp/mcp-${JOB_ID}.json"
        MCP_SERVERS="$MCP_SERVERS" python3 - "$MCP_BASE" "$MCP_TMP" <<'PYFILTER'
import json, os, sys
base_path, out_path = sys.argv[1], sys.argv[2]
wanted = set(os.environ.get("MCP_SERVERS","").split(","))
wanted.discard("")
with open(base_path) as f:
    base = json.load(f)
filtered = {}
for name, cfg in base.get("mcpServers", {}).items():
    if name in wanted:
        # Resolve env var placeholders in env block
        if "env" in cfg:
            for k, v in cfg["env"].items():
                if v.startswith("${") and v.endswith("}"):
                    env_name = v[2:-1]
                    cfg["env"][k] = os.environ.get(env_name, v)
        filtered[name] = cfg
if filtered:
    with open(out_path, "w") as f:
        json.dump({"mcpServers": filtered}, f)
    print(out_path)
else:
    print("")
PYFILTER
        if [[ -f "$MCP_TMP" ]]; then
          MCP_FLAGS+=(--mcp-config "$MCP_TMP")
        fi
      fi
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

    # Assemble final args array (avoids unbound variable errors with empty arrays)
    CLAUDE_ARGS=(-p --permission-mode bypassPermissions)
    [[ ${#MODEL_FLAGS[@]} -gt 0 ]] && CLAUDE_ARGS+=("${MODEL_FLAGS[@]}")
    [[ ${#SYSTEM_FLAGS[@]} -gt 0 ]] && CLAUDE_ARGS+=("${SYSTEM_FLAGS[@]}")
    [[ ${#MCP_FLAGS[@]} -gt 0 ]] && CLAUDE_ARGS+=("${MCP_FLAGS[@]}")
    CLAUDE_ARGS+=("$PROMPT")

    # Try AntiGravity proxy first, fall back to direct CLI
    if curl -fsS http://localhost:8080/health >/dev/null 2>&1; then
      OUT="$(ANTHROPIC_BASE_URL="http://localhost:8080" ANTHROPIC_AUTH_TOKEN="test" claude "${CLAUDE_ARGS[@]}" 2>&1 || true)"
    else
      # Direct CLI mode — uses Claude's own authenticated session
      OUT="$(claude "${CLAUDE_ARGS[@]}" 2>&1 || true)"
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
    if curl -fsS http://localhost:8080/health >/dev/null 2>&1; then
      # Use AntiGravity proxy for Gemini
      USER_MSG="$COMMAND_TEXT"
      if [[ -n "$ARGS_JOINED" ]]; then
        USER_MSG="$USER_MSG\nArgs: $ARGS_JOINED"
      fi

      PAYLOAD="$(USER_MSG="$USER_MSG" python3 - <<'PY'
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
    else
      # Proxy down — fall back to Claude CLI
      PROMPT="$COMMAND_TEXT"
      if [[ -n "$ARGS_JOINED" ]]; then
        PROMPT="$PROMPT\n\nArgs: $ARGS_JOINED"
      fi
      unset CLAUDECODE 2>/dev/null || true
      OUT="$(claude -p --permission-mode bypassPermissions "$PROMPT" 2>&1 || true)"
      OUT="$OUT" python3 - <<'PY'
import json, os
print(json.dumps({"ok": True, "engine": "gemini-fallback-claude", "result": os.environ.get("OUT","")[:12000]}))
PY
    fi
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
