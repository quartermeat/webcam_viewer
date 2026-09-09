import test from 'node:test';
import assert from 'node:assert/strict';
import { updateDefender } from './nose-defender.mjs';
const nose = { x: 300, y: 300 };
test('a hit knocks a drone away from the nose and gives it retreat time', () => {
  const drone = { x: 310, y: 240, radius: 10, vx: 0, vy: 0 };
  const guard = updateDefender(null, [drone], nose, 1, 1000);
  assert.equal(guard.hitAt, 1000);
  assert.ok(drone.vx * (drone.x - nose.x) + drone.vy * (drone.y - nose.y) > 0);
  assert.equal(drone.retreatUntil, 2400);
});
test('distant and retreating drones do not draw the defender out', () => {
  const drones = [{ x: 300, y: 290, radius: 10, retreatUntil: 2000 }, { x: 900, y: 300, radius: 10 }];
  const guard = updateDefender(null, drones, nose, 1, 1000);
  assert.equal(guard.charging, false);
  assert.equal(drones[0].retreatUntil, 2000);
  assert.equal(drones[1].vx, undefined);
});
test('tracking loss clears the defender and reacquisition starts near the nose', () => {
  assert.equal(updateDefender({x:1,y:1}, [], null, 1, 1000), null);
  const guard = updateDefender({x:1,y:1}, [], {x:1000,y:1000}, 1, 1000);
  assert.ok(Math.hypot(guard.x - 1000, guard.y - 1000) < 100);
});
test('the guard closes on nearby threats with bounded travel after a pause', () => {
  const drone = {x:430,y:300,radius:10};
  const guard = updateDefender(null, [], nose, 1, 0);
  const start = {...guard};
  updateDefender(guard, [drone], nose, 1, 10000);
  assert.equal(guard.charging, true);
  assert.ok(Math.hypot(guard.x-start.x,guard.y-start.y) <= 58.001);
  assert.ok(Math.hypot(guard.x-drone.x,guard.y-drone.y) < Math.hypot(start.x-drone.x,start.y-drone.y));
});
