import { FilesetResolver, GestureRecognizer, PoseLandmarker } from './node_modules/@mediapipe/tasks-vision/vision_bundle.mjs';

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
let poseRecognizer;
let latestPoseResults;
let poseFrameCount = 0;
let flexEffects = [];
const flexLatched = { left: false, right: false };
let mirrored = true;
let animationId;
let previousVideoTime = -1;
let frameCount = 0;
let fpsWindowStart = performance.now();
let musicControlActive = false;
let palmHoldStarted = 0;
let palmLatched = false;
let pinchLatched = false;
let volumeGestureLatched = false;
let mediaGestureLatched = false;
let controlStatusTimer;
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

function setMusicControlActive(active) {
  musicControlActive = active;
  app.classList.toggle('music-control-active', active);
  controlState.textContent = active ? 'MUSIC ACTIVE' : 'OBSERVE';
  if (!active) {
    window.clearTimeout(controlStatusTimer);
    gestureCursor.classList.remove('pinching');
    gestureCursor.style.display = 'none';
    pinchLatched = false;
    volumeGestureLatched = false;
    mediaGestureLatched = false;
  } else {
    gestureCursor.style.display = '';
  }
}

async function changeVolume(direction) {
  controlState.textContent = direction === 'up' ? 'VOLUME UP' : 'VOLUME DOWN';
  try {
    const response = await fetch('/api/volume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ direction }),
    });
    if (!response.ok) throw new Error(`Volume bridge returned ${response.status}`);
  } catch (error) {
    controlState.textContent = 'VOLUME ERROR';
    logError('Could not change system volume', error);
  }
  window.clearTimeout(controlStatusTimer);
  controlStatusTimer = window.setTimeout(() => {
    if (musicControlActive) controlState.textContent = 'MUSIC ACTIVE';
  }, 700);
}

async function changeTrack(action) {
  controlState.textContent = action === 'next' ? 'NEXT TRACK' : 'PREVIOUS TRACK';
  try {
    const response = await fetch('/api/media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    if (!response.ok) throw new Error(`Media bridge returned ${response.status}`);
  } catch (error) {
    controlState.textContent = 'MEDIA ERROR';
    logError('Could not change track', error);
  }
  window.clearTimeout(controlStatusTimer);
  controlStatusTimer = window.setTimeout(() => {
    if (musicControlActive) controlState.textContent = 'MUSIC ACTIVE';
  }, 700);
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function jointAngle(a, b, c) {
  const first = { x: a.x - b.x, y: a.y - b.y };
  const second = { x: c.x - b.x, y: c.y - b.y };
  const cosine = (first.x * second.x + first.y * second.y)
    / Math.max(Math.hypot(first.x, first.y) * Math.hypot(second.x, second.y), .0001);
  return Math.acos(Math.max(-1, Math.min(1, cosine))) * 180 / Math.PI;
}

function triggerFlexEffect(point, ratio) {
  flexEffects.push({
    startedAt: performance.now(),
    point,
    particles: Array.from({ length: 14 }, (_, index) => {
      const angle = index / 14 * Math.PI * 2 + Math.random() * .28;
      const speed = (35 + Math.random() * 65) * ratio;
      return { angle, speed, size: (1.8 + Math.random() * 2.8) * ratio };
    }),
  });
}

function updateFlexDetection(results, transform, ratio) {
  const landmarks = results?.landmarks?.[0];
  if (!landmarks) return;
  [
    ['left', 11, 13, 15],
    ['right', 12, 14, 16],
  ].forEach(([side, shoulderIndex, elbowIndex, wristIndex]) => {
    const shoulder = landmarks[shoulderIndex];
    const elbow = landmarks[elbowIndex];
    const wrist = landmarks[wristIndex];
    if ([shoulder, elbow, wrist].some(point => (point.visibility ?? 1) < .6)) return;
    const angle = jointAngle(shoulder, elbow, wrist);
    const flexing = angle < 72 && wrist.y < elbow.y + .08;
    if (flexing && !flexLatched[side]) {
      const upperArm = {
        x: shoulder.x * .46 + elbow.x * .54,
        y: shoulder.y * .46 + elbow.y * .54,
      };
      triggerFlexEffect(displayPoint(upperArm, transform), ratio);
      flexLatched[side] = true;
    } else if (angle > 112) {
      flexLatched[side] = false;
    }
  });
}

function drawFlexEffects(now, ratio) {
  flexEffects = flexEffects.filter(effect => now - effect.startedAt < 950);
  flexEffects.forEach(effect => {
    const progress = (now - effect.startedAt) / 950;
    const alpha = 1 - progress;
    const radius = (18 + progress * 78) * ratio;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.strokeStyle = `rgba(92, 255, 190, ${alpha})`;
    ctx.lineWidth = Math.max(1, 4 * (1 - progress) * ratio);
    ctx.shadowColor = '#39ffad';
    ctx.shadowBlur = 18 * ratio;
    ctx.beginPath();
    ctx.arc(effect.point.x, effect.point.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    effect.particles.forEach(particle => {
      const travel = particle.speed * progress;
      const x = effect.point.x + Math.cos(particle.angle) * travel;
      const y = effect.point.y + Math.sin(particle.angle) * travel;
      ctx.fillStyle = `rgba(132, 255, 211, ${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, particle.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  });
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
  const volumeDirection = gesture?.score >= .65 && {
    Thumb_Up: 'up',
    Thumb_Down: 'down',
  }[gesture.categoryName];
  const mediaAction = gesture?.score >= .65 && {
    Victory: 'next',
    Closed_Fist: 'previous',
  }[gesture.categoryName];
  const now = performance.now();

  if (isOpen && !palmLatched) {
    if (!palmHoldStarted) palmHoldStarted = now;
    const progress = Math.min(1, (now - palmHoldStarted) / 1000);
    activationMeter.style.setProperty('--activation', `${progress * 100}%`);
    if (progress === 1) {
      setMusicControlActive(!musicControlActive);
      palmLatched = true;
      palmHoldStarted = 0;
      activationMeter.style.setProperty('--activation', '0%');
    }
  } else if (!isOpen) {
    palmHoldStarted = 0;
    palmLatched = false;
    activationMeter.style.setProperty('--activation', '0%');
  }

  if (musicControlActive && volumeDirection && !volumeGestureLatched) {
    volumeGestureLatched = true;
    changeVolume(volumeDirection);
  } else if (!volumeDirection) {
    volumeGestureLatched = false;
  }

  if (musicControlActive && mediaAction && !mediaGestureLatched) {
    mediaGestureLatched = true;
    changeTrack(mediaAction);
  } else if (!mediaAction) {
    mediaGestureLatched = false;
  }

  if (!musicControlActive || !landmarks) {
    if (musicControlActive) gestureCursor.style.display = 'none';
    return;
  }
  if (volumeDirection || mediaAction) {
    gestureCursor.style.display = 'none';
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
    modelState.textContent = 'Hands ready';
    try {
      poseRecognizer = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: .55,
        minPosePresenceConfidence: .55,
        minTrackingConfidence: .55,
      });
      modelState.textContent = 'Vision ready';
    } catch (error) {
      modelState.textContent = 'Hands only';
      logError('Pose recognition could not load', error);
    }
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
  latestPoseResults = undefined;
  poseFrameCount = 0;
  flexEffects = [];
  flexLatched.left = flexLatched.right = false;
  setMusicControlActive(false);
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

function drawResults(results, poseResults, now) {
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
  updateFlexDetection(poseResults, transform, ratio);

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
  drawFlexEffects(now, ratio);
}

function detectFrame() {
  if (!stream) return;
  if (recognizer && video.readyState >= 2 && video.currentTime !== previousVideoTime) {
    previousVideoTime = video.currentTime;
    const now = performance.now();
    if (poseRecognizer && poseFrameCount++ % 2 === 0) {
      latestPoseResults = poseRecognizer.detectForVideo(video, now);
    }
    drawResults(recognizer.recognizeForVideo(video, now), latestPoseResults, now);
    frameCount++;
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
  if (event.key === 'Escape' && musicControlActive) setMusicControlActive(false);
});
window.addEventListener('beforeunload', stopCamera);

video.classList.add('mirrored');
listCameras().catch(() => {});
loadRecognizer();
updateTranscript();
window.setInterval(updateTranscript, 350);
updateNowPlaying();
window.setInterval(updateNowPlaying, 1000);
