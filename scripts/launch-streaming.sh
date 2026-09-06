#!/bin/sh
set -eu

project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$project_dir"
"$project_dir/scripts/setup-obs.sh"

if ! pgrep -f "$project_dir/node_modules/electron/dist/electron" >/dev/null 2>&1; then
  npm start >"${TMPDIR:-/tmp}/webcam-viewer-overlay.log" 2>&1 &
  for attempt in 1 2 3 4 5 6 7 8 9 10; do
    if curl -fsS http://127.0.0.1:8090/ >/dev/null 2>&1; then
      break
    fi
    sleep 0.25
  done
fi

exec obs --collection "Webcam Overlay Stream" --profile "Webcam Overlay Stream"
