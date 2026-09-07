#!/bin/sh
set -eu

project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
config_root=${XDG_CONFIG_HOME:-$HOME/.config}/webcam_viewer
cert_dir="$config_root/certs"
phone_ip=${WEBCAM_VIEWER_PHONE_IP:-$(ip route get 1.1.1.1 2>/dev/null | awk '{for (i=1; i<=NF; i++) if ($i == "src") { print $(i+1); exit }}')}
phone_ip=${phone_ip:-127.0.0.1}
mkdir -p "$cert_dir"

if [ ! -s "$cert_dir/phone-cert.pem" ] || [ ! -s "$cert_dir/phone-key.pem" ]; then
  openssl req -x509 -newkey rsa:2048 -nodes -days 365 \
    -keyout "$cert_dir/phone-key.pem" -out "$cert_dir/phone-cert.pem" \
    -subj "/CN=$phone_ip" -addext "subjectAltName=IP:$phone_ip" >/dev/null 2>&1
  chmod 600 "$cert_dir/phone-key.pem"
fi

cd "$project_dir"
export WEBCAM_VIEWER_BIND=${WEBCAM_VIEWER_BIND:-0.0.0.0}
export WEBCAM_VIEWER_TLS_BIND=${WEBCAM_VIEWER_TLS_BIND:-0.0.0.0:8443}
export WEBCAM_VIEWER_TLS_CERT="$cert_dir/phone-cert.pem"
export WEBCAM_VIEWER_TLS_KEY="$cert_dir/phone-key.pem"
exec env PATH="${PATH:-/usr/local/bin:/usr/bin:/bin}" npm start
