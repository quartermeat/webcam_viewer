// Positions and velocities use the overlay's device-pixel coordinates.
export function updateDefender(guard, balls, nose, ratio, now) {
  if (!nose) return null;
  const zone = 155 * ratio;
  const radius = 23 * ratio;
  if (!guard || Math.hypot(guard.x - nose.x, guard.y - nose.y) > zone * 3) {
    guard = { x: nose.x, y: nose.y - 65 * ratio, radius, lastAt: now, hitAt: -Infinity };
  }
  const step = Math.min(2, Math.max(0, (now - guard.lastAt) / 33));
  guard.lastAt = now;
  guard.radius = radius;
  let threat = null;
  let nearest = Infinity;
  for (const ball of balls) {
    const distance = Math.hypot(ball.x - nose.x, ball.y - nose.y);
    if (distance < zone && distance < nearest && now >= (ball.retreatUntil || 0)) {
      nearest = distance;
      threat = ball;
    }
  }
  const aim = threat || {
    x: nose.x + Math.cos(now * .002) * 62 * ratio,
    y: nose.y + Math.sin(now * .002) * 48 * ratio,
  };
  const dx = aim.x - guard.x, dy = aim.y - guard.y;
  const distance = Math.hypot(dx, dy);
  const travel = Math.min(distance, (threat ? 29 : 12) * ratio * step);
  if (distance) { guard.x += dx / distance * travel; guard.y += dy / distance * travel; }
  guard.charging = Boolean(threat);
  for (const ball of balls) {
    if (now < (ball.retreatUntil || 0)) continue;
    if (Math.hypot(ball.x - guard.x, ball.y - guard.y) > radius + ball.radius + 8 * ratio) continue;
    // Always knock drones away from the nose, even on a side-on collision.
    const angle = Math.atan2(ball.y - nose.y, ball.x - nose.x);
    ball.vx = Math.cos(angle) * 21 * ratio;
    ball.vy = Math.sin(angle) * 21 * ratio;
    ball.retreatUntil = now + 1400;
    guard.hitAt = now;
  }
  return guard;
}
