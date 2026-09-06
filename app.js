import { FilesetResolver, GestureRecognizer } from './node_modules/@mediapipe/tasks-vision/vision_bundle.mjs';

const $ = selector => document.querySelector(selector);
const video = $('#video');
const stage = $('#stage');
const overlay = $('#overlay');
const ctx = overlay.getContext('2d');
const cameraSelect = $('#cameraSelect');
const startButton = $('#startButton');
const mirrorButton = $('#mirrorButton');
const emptyState = $('#emptyState');
const status = $('#status');
const modelState = $('#modelState');
const gestureState = $('#gestureState');
const confidenceState = $('#confidenceState');
const cameraState = $('#cameraState');
const fpsState = $('#fpsState');
const app = $('.app');
const controlState = $('#controlState');
const activationMeter = $('#activationMeter');
const gestureCursor = $('#gestureCursor');
const transcriptPanel = $('.transcript-panel');
const transcriptText = $('#transcriptText');
const transcriptState = $('#transcriptState');
const nowPlaying = $('.now-playing');
const playerName = $('#playerName');
const trackTitle = $('#trackTitle');
const trackArtist = $('#trackArtist');
const albumArt = $('#albumArt');

const connections = [
  [0,1],[1,2],[2,3],[3,4], [0,5],[5,6],[6,7],[7,8],
  [5,9],[9,10],[10,11],[11,12], [9,13],[13,14],[14,15],[15,16],
  [13,17],[17,18],[18,19],[19,20],[0,17],
];

let stream;
let recognizer;
let mirrored = true;
let animationId;
let previousVideoTime = -1;
let frameCount = 0;
let fpsWindowStart = performance.now();
let controlActive = false;
let palmHoldStarted = 0;
let palmLatched = false;
let pinchLatched = false;
let cursorPoint;
let lastClickAt = 0;
let lastTranscript = '';

function logError(context, error) {
  console.error(`[Interface] ${context}`, error);
}

async function updateTranscript() {
  try {
    const response = await fetch(`latest-transcript.txt?t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error('Transcript bridge unavailable');
    const text = (await response.text()).trim();
    transcriptState.textContent = 'LINKED';
    if (text && text !== lastTranscript) {
      lastTranscript = text;
      transcriptText.textContent = text;
      transcriptPanel.classList.remove('updated');
      void transcriptPanel.offsetWidth;
      transcriptPanel.classList.add('updated');
    }
  } catch {
    transcriptState.textContent = 'STANDBY';
  }
}

async function updateNowPlaying() {
  try {
    const response = await fetch(`now-playing.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error('Now-playing bridge unavailable');
    const track = await response.json();
    const active = Boolean(track.active && track.title);
    nowPlaying.classList.toggle('playing', active && track.status === 'Playing');
    playerName.textContent = active ? (track.player || 'MEDIA').toUpperCase() : 'LISTENING';
    trackTitle.textContent = active ? track.title : 'No signal';
    trackArtist.textContent = active
      ? [track.artist, track.album].filter(Boolean).join(' // ')
      : 'Waiting for media…';
    if (active && track.artUrl) {
      albumArt.src = track.artUrl;
      albumArt.hidden = false;
    } else {
      albumArt.removeAttribute('src');
      albumArt.hidden = true;
    }
  } catch {
    nowPlaying.classList.remove('playing');
    playerName.textContent = 'OFFLINE';
  }
}

function setControlActive(active) {
  controlActive = active;
  app.classList.toggle('control-active', active);
  nowPlaying.classList.toggle('gesture-visible', active);
  controlState.textContent = active ? 'CONTROL ACTIVE' : 'OBSERVE';
  if (!active) {
    gestureCursor.classList.remove('pinching');
    gestureCursor.style.display = 'none';
    pinchLatched = false;
  } else {
    gestureCursor.style.display = '';
  }
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clickAt(point, ratio) {
  const clientX = point.x / ratio;
  const clientY = point.y / ratio;
  const target = document.elementFromPoint(clientX, clientY);
  const actionable = target?.closest('button, select');
  if (!actionable) return;
  actionable.classList.add('gesture-target');
  actionable.click();
  window.setTimeout(() => actionable.classList.remove('gesture-target'), 300);
}

function updateGestureControl(results, transform, ratio) {
  const landmarks = results.landmarks?.[0];
  const gesture = results.gestures?.[0]?.[0];
  const isOpen = gesture?.categoryName === 'Open_Palm' && gesture.score >= .65;
  const now = performance.now();

  if (isOpen && !palmLatched) {
    if (!palmHoldStarted) palmHoldStarted = now;
    const progress = Math.min(1, (now - palmHoldStarted) / 1000);
    activationMeter.style.setProperty('--activation', `${progress * 100}%`);
    if (progress === 1) {
      setControlActive(!controlActive);
      palmLatched = true;
      palmHoldStarted = 0;
      activationMeter.style.setProperty('--activation', '0%');
    }
  } else if (!isOpen) {
    palmHoldStarted = 0;
    palmLatched = false;
    activationMeter.style.setProperty('--activation', '0%');
  }

  if (!controlActive || !landmarks) {
    if (controlActive) gestureCursor.style.display = 'none';
    return;
  }

  const indexTip = displayPoint(landmarks[8], transform);
  cursorPoint = cursorPoint
    ? { x: cursorPoint.x * .65 + indexTip.x * .35, y: cursorPoint.y * .65 + indexTip.y * .35 }
    : indexTip;
  gestureCursor.style.display = 'block';
  gestureCursor.style.transform = `translate(${cursorPoint.x / ratio}px, ${cursorPoint.y / ratio}px)`;

  const pinchRatio = distance(landmarks[4], landmarks[8]) / Math.max(distance(landmarks[0], landmarks[9]), .001);
  const pinching = pinchRatio < .42;
  gestureCursor.classList.toggle('pinching', pinching);
  if (pinching && !pinchLatched && now - lastClickAt > 650) {
    pinchLatched = true;
    lastClickAt = now;
    clickAt(cursorPoint, ratio);
  } else if (pinchRatio > .58) {
    pinchLatched = false;
  }
}

async function loadRecognizer() {
  try {
    const vision = await FilesetResolver.forVisionTasks('./node_modules/@mediapipe/tasks-vision/wasm');
    recognizer = await GestureRecognizer.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task',
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numHands: 2,
      minHandDetectionConfidence: 0.55,
      minHandPresenceConfidence: 0.55,
      minTrackingConfidence: 0.55,
    });
    modelState.textContent = 'Vision ready';
  } catch (error) {
    modelState.textContent = 'Vision error';
    logError('Hand recognition could not load', error);
  }
}

function stopCamera() {
  cancelAnimationFrame(animationId);
  stream?.getTracks().forEach(track => track.stop());
  stream = undefined;
  video.srcObject = null;
  ctx.clearRect(0, 0, overlay.width, overlay.height);
  startButton.textContent = 'Initialize interface';
  status.textContent = 'Camera off';
  status.classList.remove('live');
  emptyState.classList.remove('hidden');
  gestureState.textContent = confidenceState.textContent = cameraState.textContent = '—';
  fpsState.textContent = '0';
  setControlActive(false);
}

async function listCameras() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const cameras = devices.filter(device => device.kind === 'videoinput');
  const selected = cameraSelect.value;
  cameraSelect.replaceChildren(...cameras.map((camera, index) => {
    const option = document.createElement('option');
    option.value = camera.deviceId;
    option.textContent = camera.label || `Camera ${index + 1}`;
    return option;
  }));
  if (cameras.some(camera => camera.deviceId === selected)) cameraSelect.value = selected;
}

async function startCamera(deviceId = cameraSelect.value) {
  stopCamera();
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: deviceId ? { deviceId: { exact: deviceId } } : {
        width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 },
      },
      audio: false,
    });
    video.srcObject = stream;
    await video.play();
    await listCameras();
    const settings = stream.getVideoTracks()[0].getSettings();
    cameraSelect.value = settings.deviceId || cameraSelect.value;
    cameraState.textContent = `${settings.width}×${settings.height}`;
    startButton.textContent = 'Suspend interface';
    status.textContent = 'Interface online';
    status.classList.add('live');
    emptyState.classList.add('hidden');
    previousVideoTime = -1;
    detectFrame();
  } catch (error) {
    stopCamera();
    logError(error.name === 'NotAllowedError'
      ? 'Camera permission was denied'
      : 'Could not start the camera', error);
  }
}

function displayPoint(landmark, transform) {
  return {
    x: transform.x + (mirrored ? 1 - landmark.x : landmark.x) * transform.width,
    y: transform.y + landmark.y * transform.height,
  };
}

function drawBox(left, top, right, bottom, isOpen, score, ratio) {
  const color = isOpen ? '#55ffad' : '#62d9ff';
  const corner = Math.min(24 * ratio, (right - left) * .18, (bottom - top) * .18);
  ctx.strokeStyle = color;
  ctx.lineWidth = (isOpen ? 3 : 2) * ratio;
  ctx.beginPath();
  [[left,top,1,1],[right,top,-1,1],[right,bottom,-1,-1],[left,bottom,1,-1]].forEach(([x,y,dx,dy]) => {
    ctx.moveTo(x + dx * corner, y); ctx.lineTo(x, y); ctx.lineTo(x, y + dy * corner);
  });
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = `${Math.round(14 * ratio)}px ui-monospace, monospace`;
  ctx.fillText(isOpen ? `OPEN HAND  ${Math.round(score * 100)}%` : 'HAND TRACKING', left, Math.max(18 * ratio, top - 8 * ratio));
}

function drawResults(results) {
  const ratio = window.devicePixelRatio || 1;
  overlay.width = Math.round(stage.clientWidth * ratio);
  overlay.height = Math.round(stage.clientHeight * ratio);
  ctx.clearRect(0, 0, overlay.width, overlay.height);

  const scale = Math.max(overlay.width / video.videoWidth, overlay.height / video.videoHeight);
  const transform = {
    width: video.videoWidth * scale,
    height: video.videoHeight * scale,
  };
  transform.x = (overlay.width - transform.width) / 2;
  transform.y = (overlay.height - transform.height) / 2;
  let bestGesture;

  updateGestureControl(results, transform, ratio);

  (results.landmarks || []).forEach((landmarks, index) => {
    const gesture = results.gestures?.[index]?.[0];
    const isOpen = gesture?.categoryName === 'Open_Palm';
    if (!bestGesture || (gesture?.score || 0) > bestGesture.score) bestGesture = gesture;
    const points = landmarks.map(point => displayPoint(point, transform));
    const xs = points.map(point => point.x);
    const ys = points.map(point => point.y);
    const padding = 14 * ratio;

    ctx.strokeStyle = isOpen ? '#55ffad99' : '#62d9ff77';
    ctx.lineWidth = 1.5 * ratio;
    ctx.beginPath();
    connections.forEach(([from, to]) => {
      ctx.moveTo(points[from].x, points[from].y);
      ctx.lineTo(points[to].x, points[to].y);
    });
    ctx.stroke();
    ctx.fillStyle = isOpen ? '#8affc8' : '#8de7ff';
    points.forEach(point => {
      ctx.beginPath(); ctx.arc(point.x, point.y, 2.2 * ratio, 0, Math.PI * 2); ctx.fill();
    });
    drawBox(
      Math.max(0, Math.min(...xs) - padding), Math.max(0, Math.min(...ys) - padding),
      Math.min(overlay.width, Math.max(...xs) + padding), Math.min(overlay.height, Math.max(...ys) + padding),
      isOpen, gesture?.score || 0, ratio,
    );
  });

  gestureState.textContent = bestGesture
    ? (bestGesture.categoryName === 'Open_Palm' ? 'OPEN HAND' : bestGesture.categoryName.replaceAll('_', ' '))
    : 'SEARCHING';
  confidenceState.textContent = bestGesture ? `${Math.round(bestGesture.score * 100)}%` : '—';
}

function detectFrame() {
  if (!stream) return;
  if (recognizer && video.readyState >= 2 && video.currentTime !== previousVideoTime) {
    previousVideoTime = video.currentTime;
    drawResults(recognizer.recognizeForVideo(video, performance.now()));
    frameCount++;
    const now = performance.now();
    if (now - fpsWindowStart >= 500) {
      fpsState.textContent = Math.round(frameCount * 1000 / (now - fpsWindowStart));
      frameCount = 0;
      fpsWindowStart = now;
    }
  }
  animationId = requestAnimationFrame(detectFrame);
}

startButton.addEventListener('click', () => stream ? stopCamera() : startCamera());
cameraSelect.addEventListener('change', () => startCamera(cameraSelect.value));
mirrorButton.addEventListener('click', () => {
  mirrored = !mirrored;
  video.classList.toggle('mirrored', mirrored);
  mirrorButton.textContent = `Mirror: ${mirrored ? 'on' : 'off'}`;
  mirrorButton.setAttribute('aria-pressed', String(mirrored));
});
$('#fullscreenButton').addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.querySelector('.app').requestFullscreen();
});
document.addEventListener('fullscreenchange', () => {
  $('#fullscreenButton').textContent = document.fullscreenElement ? 'Exit interface' : 'Enter interface';
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && controlActive) setControlActive(false);
});
window.addEventListener('beforeunload', stopCamera);

video.classList.add('mirrored');
listCameras().catch(() => {});
loadRecognizer();
updateTranscript();
window.setInterval(updateTranscript, 350);
updateNowPlaying();
window.setInterval(updateNowPlaying, 1000);
