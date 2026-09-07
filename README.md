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
