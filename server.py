#!/usr/bin/env python3
"""Local static server with a narrowly scoped system-volume bridge."""

import json
import subprocess
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


HOST = "127.0.0.1"
PORT = 8090
VOLUME_STEPS = {"up": "5%+", "down": "5%-"}


class InterfaceHandler(SimpleHTTPRequestHandler):
    def send_json(self, status, payload):
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if self.path != "/api/volume":
            self.send_json(404, {"error": "Not found"})
            return

        origin = self.headers.get("Origin")
        if origin and origin != f"http://{HOST}:{PORT}":
            self.send_json(403, {"error": "Cross-origin request denied"})
            return
        if self.headers.get_content_type() != "application/json":
            self.send_json(415, {"error": "JSON required"})
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length > 256:
                raise ValueError("Request too large")
            payload = json.loads(self.rfile.read(length))
            direction = payload.get("direction")
            step = VOLUME_STEPS[direction]
            subprocess.run(
                ["wpctl", "set-volume", "-l", "1.0", "@DEFAULT_AUDIO_SINK@", step],
                check=True,
                capture_output=True,
                text=True,
            )
            result = subprocess.run(
                ["wpctl", "get-volume", "@DEFAULT_AUDIO_SINK@"],
                check=True,
                capture_output=True,
                text=True,
            )
            self.send_json(200, {"direction": direction, "volume": result.stdout.strip()})
        except (KeyError, TypeError, ValueError, json.JSONDecodeError):
            self.send_json(400, {"error": "direction must be 'up' or 'down'"})
        except (OSError, subprocess.CalledProcessError) as error:
            self.log_error("volume command failed: %s", error)
            self.send_json(503, {"error": "Volume control unavailable"})


if __name__ == "__main__":
    server = ThreadingHTTPServer((HOST, PORT), InterfaceHandler)
    print(f"Serving Human Interface on http://{HOST}:{PORT}/", flush=True)
    server.serve_forever()
