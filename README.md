# Human Interface

A local, camera-led computer interface that combines live vision, hand gestures,
voice transcription, and a subdued heads-up display. MediaPipe provides hand
recognition; Voxtype mirrors completed speech into the transcript panel.

## Run

```bash
cd /home/quartermeat/work/webcam_viewer
npm start
```

The Electron desktop overlay builds and starts the local Go control bridge, then opens a transparent window. Allow camera access when prompted. For browser-only development, run `npm run serve` and open <http://127.0.0.1:8090/>; browser windows do not expose the desktop through transparent page backgrounds. For the phone camera prototype, run `WEBCAM_VIEWER_BIND=0.0.0.0 npm run serve`, then open `http://<workstation-LAN-IP>:8090/phone.html` on the phone. A host/IP without a port automatically uses port 8090. The phone and workstation must be on the same LAN. The phone page sends camera video to the Linux viewer over direct LAN WebRTC and receives a compositor preview back; the Electron viewer still has a Local webcam source fallback.

The first load downloads Google's gesture- and pose-recognition models. Hold an open palm toward the camera to display the green recognition box and HUD confidence score. Bend either arm into a bicep flex to emit a holographic energy burst from the tracked upper arm; relax the arm before flexing again.

Floating fuzzballs home in on your tracked nose, bounce away on impact, and circle back for another attack. A dedicated short-range face detector downloads on first load and tracks the nose in close-up webcam views, with pose tracking as a fallback. The nose target stays invisible; the system readout shows `Swarm locked` when acquired or `Searching face` when lost. When nose tracking is lost, they drift freely. Sweep a hand through them to scatter or deflect them with the tracked hand wireframes.

In **Attack nose** mode, a larger gold defender fuzzball patrols near your nose, charges nearby drones, and knocks them outward for a short retreat. An impact ring marks each hit. The nose itself stays unmarked. The defender disappears when tracking is lost or fuzzballs are switched off or to Drift; Freeze pauses it with the swarm.

## Gesture controls

The **Fuzzballs** button cycles **Attack nose → Drift → Freeze** independently of music control. Attack seeks your invisible nose target; Drift lets balls float and respond to your hands; Freeze holds their positions. The FUZZBALLS HUD shows the selected behavior and whether an attack has acquired a target. Reloading starts in Attack nose mode.

- Hold an open palm steady for one second to enter or leave music control mode.
- Hold an OK sign (thumb and index touching, other three fingers extended) for one second to enter or leave fuzzball control. Release the sign before toggling again. Music and fuzzball control are mutually exclusive.
- Either tracked hand can switch modes. The gesture readout shows `OK SIGN` or `OPEN HAND`, with `HOLD 1 SEC` followed by `ACCEPTED`. Brief tracking gaps are tolerated; release for at least a quarter second before repeating a sign.
- In fuzzball control, peace/victory cycles forward through Attack nose, Drift, and Freeze; a closed fist cycles backward. Return to neutral between steps. Exiting control leaves the selected behavior running.
- While music control is active, show a thumb up or thumb down to change system volume by 5%. Return to a neutral hand position before each additional step.
- Show a victory sign to skip to the next track or a closed fist to return to the previous track. Return to a neutral hand position before repeating either action.
- In music control mode, move your index fingertip to position the virtual cursor.
- Touch your thumb and index fingertip together to click a button.
- Press Escape to leave either hand-control mode immediately.

Gesture control is intentionally limited to this app while tracking behavior is tuned. It does not control the system pointer yet.

Camera access works on `localhost`/`127.0.0.1` because browsers treat them as a secure context. Remote access requires HTTPS.

## Pool table overlay (first milestone)

Select **Pool mode: on**, point the phone's back camera at the complete table,
then choose **Calibrate table on phone** and tap the corners clockwise starting
at the top-left. Calibration is sent to the Linux viewer, so the table boundary
and live aim-line guide are visible on both outputs. This manual calibration is
the foundation for automatic ball detection and shot recommendations; ball
recognition is not enabled yet.

## Streaming with OBS

Run `npm run stream` to install the versioned OBS templates, start the overlay when needed, and launch the configured collection. Use `npm run obs:setup` to install only the OBS files or `npm run obs` to open an already-installed setup. The installer is idempotent and backs up conflicting scene/profile files before replacing them.

The `Webcam Overlay Stream` profile uses a 1920×1080 canvas at 30 FPS with NVIDIA NVENC, 6000 Kbps video, 160 Kbps audio, the tuned full-desktop XSHM crop, default desktop audio, and the default microphone. Stream-service credentials are intentionally excluded from the repository.

OBS captures the complete 3440×1440 desktop inside the 16:9 canvas without stretching it. Minimize OBS or move it to another workspace to keep its preview out of the capture. Choose a streaming service and authenticate in OBS before using **Start Streaming**; account credentials are not stored in this project.

### Android phone companion (debug)

The `android/` project is a small hardware-accelerated WebView shell around `phone.html`. It keeps the existing WebRTC signaling and camera UI, while providing a dedicated fullscreen vehicle for the processed preview.

Open `android/` in Android Studio and run the `app` debug configuration, or build with a local Gradle installation:

```bash
cd android
gradle assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

The default workstation URL is `https://192.168.1.13:8443/phone.html`. For another LAN address, pass it when launching:

```bash
adb shell am start -n com.quartermeat.humaninterface/.MainActivity \
  --es server_url https://WORKSTATION_IP:8443/phone.html
```

The debug shell accepts the project's self-signed HTTPS certificate. Keep this behavior limited to development builds on the trusted LAN.

## Substrate desktop terrarium (prototype)

Run `npm run terrarium` to open a transparent, primary-monitor desktop-level
habitat on X11. Ordinary application windows remain above it; it does not set
always-on-top or change the wallpaper or login configuration. Desktop icons and
input routing depend on the window manager and still need desktop validation.
The existing interface remains available through `npm start`.

The terrarium is a single aquarium view with no persistent text or controls.
Hover over a creature or circuit root for a contextual readout. Click the
canvas to release energy packets; packet grazers consume them and charge roots.
**Ctrl+Alt+Q** quits the terrarium process. The shortcut is available if another
application has not already registered it.

`GET /api/system-stats` reads Linux `/proc/stat` and `/proc/meminfo` every time
it is requested. The terrarium polls every two seconds. CPU is aggregate busy
time between samples (the first sample is unavailable); RAM uses
`1 - MemAvailable / MemTotal`. CPU drives root pulse speed; RAM shifts fissure
rims from green toward amber. Missing readings show a dash. All organisms are
simulated entities, not actual OS processes. Webcam interaction and above-window
notifications are future work. No camera is activated by this mode.

Browser preview: `npm run serve`, then open
`http://127.0.0.1:8090/terrarium.html`. Restart an older running bridge to
expose the new stats endpoint.

Land mice scurry in bursts, pause to scan with twitching sensor ears, and stop
to nibble collected packets. Their chip shells have contact feet and glowing
nose sensors; land mice have no trailing appendage.

### GPU diagnostics

Run `npm run gpu:check` to inspect Electron graphics acceleration using a hidden
window, which closes automatically. Terrarium launches also log Canvas 2D,
compositing, and rasterization status after GPU information updates. `enabled`
indicates hardware acceleration; software fallback is reported explicitly by
Electron. The checked NVIDIA setup reports these three features enabled.
Rendering uses accelerated Canvas 2D; creature simulation selects a GPU backend when available.
No GPU blocklist overrides or sandbox-disabling switches are used.

### Creature compute and Go

Go serves a reproducible seeded population at `GET /api/habitat` and continues
to provide system metrics. JavaScript initializes WebGPU first, then tries
WebGL2 transform feedback (verified on this NVIDIA setup). WGSL/GLSL shaders
perform food searches, steering, scanning, nibble timers, movement, and energy
decay. GPU shader code is required here; ordinary Go does not execute directly
on the GPU. JavaScript retains input, packet ownership, root charging, and
Canvas drawing. CPU simulation takes over if initialization or compute fails.
The HUD names the selected backend. An older Go bridge without `/api/habitat`
uses the local starting population until restarted.

Run `npm run gpu:check -- --compute` for an actual GPU dispatch test covering
both habitats, food targeting, no-food behavior, and destroyed-context rejection.
Run `go test ./...` and `npm test` for the Go and CPU tests.

This is a hybrid compute implementation: compact creature state is transferred
back to Canvas each tick, and food consumption is resolved in creature order
to avoid duplicate consumption. Readback has a cost, especially for just 28
creatures; no performance improvement is claimed. A future renderer can draw
directly from GPU buffers to remove that transfer. WebGPU was unavailable on
the checked machine, so its shader path still needs hardware validation.
