#!/bin/bash
set -euo pipefail
cd /Users/david/.openclaw/workspace/mission-control
/usr/bin/env PATH="$HOME/Library/Python/3.9/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin" node scripts/youtube_watch_to_sources.mjs >> logs/youtube-watch.log 2>&1
