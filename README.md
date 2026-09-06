# Human Interface

A local, camera-led computer interface that combines live vision, hand gestures,
voice transcription, and a subdued heads-up display. MediaPipe provides hand
recognition; Voxtype mirrors completed speech into the transcript panel.

## Run

```bash
cd /home/quartermeat/work/webcam_viewer
npm start
```

The Electron desktop overlay builds and starts the local Go control bridge, then opens a transparent window. Allow camera access when prompted. For browser-only development, run `npm run serve` and open <http://127.0.0.1:8090/>; browser windows do not expose the desktop through transparent page backgrounds.

The first load downloads Google's gesture- and pose-recognition models. Hold an open palm toward the camera to display the green recognition box and HUD confidence score. Bend either arm into a bicep flex to emit a holographic energy burst from the tracked upper arm; relax the arm before flexing again.

Floating fuzz particles drift across the display and collide only with the tracked hand wireframes. Sweep a hand through them to scatter them with the motion of the gesture.

## Gesture controls

- Hold an open palm steady for one second to enter or leave music control mode.
- While music control is active, show a thumb up or thumb down to change system volume by 5%. Return to a neutral hand position before each additional step.
- Show a victory sign to skip to the next track or a closed fist to return to the previous track. Return to a neutral hand position before repeating either action.
- In music control mode, move your index fingertip to position the virtual cursor.
- Touch your thumb and index fingertip together to click a button.
- Press Escape to disable music control mode immediately.

Gesture control is intentionally limited to this app while tracking behavior is tuned. It does not control the system pointer yet.

Camera access works on `localhost`/`127.0.0.1` because browsers treat them as a secure context. Remote access requires HTTPS.

## Streaming with OBS

Run `npm run stream` to install the versioned OBS templates, start the overlay when needed, and launch the configured collection. Use `npm run obs:setup` to install only the OBS files or `npm run obs` to open an already-installed setup. The installer is idempotent and backs up conflicting scene/profile files before replacing them.

The `Webcam Overlay Stream` profile uses a 1920×1080 canvas at 30 FPS with NVIDIA NVENC, 6000 Kbps video, 160 Kbps audio, the tuned full-desktop XSHM crop, default desktop audio, and the default microphone. Stream-service credentials are intentionally excluded from the repository.

OBS captures the complete 3440×1440 desktop inside the 16:9 canvas without stretching it. Minimize OBS or move it to another workspace to keep its preview out of the capture. Choose a streaming service and authenticate in OBS before using **Start Streaming**; account credentials are not stored in this project.
