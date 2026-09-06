#!/bin/sh
set -eu

project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
default_config_root=${XDG_CONFIG_HOME:-$HOME/.config}/obs-studio
config_root=${OBS_CONFIG_HOME:-$default_config_root}
scene_target="$config_root/basic/scenes/Webcam Overlay Stream.json"
profile_dir="$config_root/basic/profiles/WebcamOverlay"
profile_target="$profile_dir/basic.ini"
timestamp=$(date +%Y%m%d-%H%M%S)

if [ "$config_root" = "$default_config_root" ] && pgrep -x obs >/dev/null 2>&1; then
  echo "Close OBS before installing its scene and profile." >&2
  exit 1
fi

mkdir -p "$config_root/basic/scenes" "$profile_dir"

backup_if_different() {
  source_file=$1
  target_file=$2
  if [ -f "$target_file" ] && ! cmp -s "$source_file" "$target_file"; then
    cp "$target_file" "$target_file.backup-$timestamp"
    echo "Backed up $target_file"
  fi
}

backup_if_different "$project_dir/obs/scene-collection.json" "$scene_target"
backup_if_different "$project_dir/obs/profile.ini" "$profile_target"
install -m 0644 "$project_dir/obs/scene-collection.json" "$scene_target"
install -m 0644 "$project_dir/obs/profile.ini" "$profile_target"
if [ ! -f "$profile_dir/service.json" ]; then
  printf '{}\n' > "$profile_dir/service.json"
fi
echo "Installed OBS collection and profile: Webcam Overlay Stream"
