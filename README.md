# Human Interface

A local, camera-led computer interface that combines live vision, hand gestures,
voice transcription, and a subdued heads-up display. MediaPipe provides hand
recognition; Voxtype mirrors completed speech into the transcript panel.

## Run

```bash
cd /home/quartermeat/work/webcam_viewer
npm start
```

The Electron desktop overlay starts the local control bridge and opens a transparent window. Allow camera access when prompted. For browser-only development, run `npm run serve` and open <http://127.0.0.1:8090/>; browser windows do not expose the desktop through transparent page backgrounds.

The first load downloads Google's gesture-recognition model. Hold an open palm toward the camera to display the green recognition box and HUD confidence score.

## Gesture controls

- Hold an open palm steady for one second to enter or leave music control mode.
- While music control is active, show a thumb up or thumb down to change system volume by 5%. Return to a neutral hand position before each additional step.
- Show a victory sign to skip to the next track or a closed fist to return to the previous track. Return to a neutral hand position before repeating either action.
- In music control mode, move your index fingertip to position the virtual cursor.
- Touch your thumb and index fingertip together to click a button.
- Press Escape to disable music control mode immediately.

Gesture control is intentionally limited to this app while tracking behavior is tuned. It does not control the system pointer yet.

Camera access works on `localhost`/`127.0.0.1` because browsers treat them as a secure context. Remote access requires HTTPS.
