const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function classifyControlHand(points, gesture) {
  if (!points || points.length !== 21) return null;
  const palmSize = Math.max(distance(points[0], points[9]), distance(points[5], points[17]), .001);
  const extended = [8, 12, 16, 20].map(tip =>
    distance(points[tip], points[tip - 3]) > distance(points[tip - 2], points[tip - 3]) * 1.35
    && distance(points[tip], points[0]) > distance(points[tip - 2], points[0]) * 1.04);
  const circle = distance(points[4], points[8]) / palmSize;
  // The three free fingers distinguish a diver's OK from an ordinary click pinch.
  if (circle < .45 && extended.slice(1).every(Boolean)) return 'ok';
  if (circle > .55 && (extended.every(Boolean)
    || (gesture?.categoryName === 'Open_Palm' && gesture.score >= .55))) return 'palm';
  return null;
}

export function createControlHold() {
  return { kind: null, started: 0, lastSeen: 0, latched: false };
}

export function updateControlHold(state, kind, now) {
  // Brief classification dropouts must neither cancel a hold nor retrigger it.
  if (state.kind && now - state.lastSeen > 250) Object.assign(state, createControlHold());
  if (!kind) return { triggered: null, progress: 0 };
  if (kind !== state.kind) Object.assign(state, { kind, started: now, latched: false });
  state.lastSeen = now;
  const progress = Math.min(1, (now - state.started) / 1000);
  if (progress === 1 && !state.latched) {
    state.latched = true;
    return { triggered: kind, progress: 0 };
  }
  return { triggered: null, progress: state.latched ? 0 : progress };
}
