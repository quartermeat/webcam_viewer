import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyControlHand, createControlHold, updateControlHold } from './gesture-controls.mjs';

function hand(ok = false) {
  const points = Array.from({ length: 21 }, () => ({ x: 0, y: 0 }));
  [5, 9, 13, 17].forEach((base, finger) => {
    for (let joint = 0; joint < 4; joint++) {
      points[base + joint] = { x: (finger - 1.5) * .3, y: 1 + joint * .4 };
    }
  });
  points[4] = { x: -1, y: .7 };
  if (ok) points[4] = points[8] = { x: -.6, y: .9 };
  return points;
}

test('OK and palm geometry work even when canned classifier says None', () => {
  const unknown = { categoryName: 'None', score: .9 };
  for (const angle of [0, .7, 1.8]) {
    for (const mirror of [-1, 1]) {
      const rotate = points => points.map(({ x, y }) => ({
        x: mirror * (x * Math.cos(angle) - y * Math.sin(angle)),
        y: x * Math.sin(angle) + y * Math.cos(angle),
      }));
      assert.equal(classifyControlHand(rotate(hand(true)), unknown), 'ok');
      assert.equal(classifyControlHand(rotate(hand()), unknown), 'palm');
    }
  }
  const pinch = hand(true);
  [12, 16, 20].forEach(tip => { pinch[tip] = { x: 0, y: .5 }; });
  assert.equal(classifyControlHand(pinch, unknown), null);
  assert.equal(classifyControlHand(undefined), null);
});

test('holds survive short dropouts, fire once, and rearm after release', () => {
  for (const kind of ['ok', 'palm']) {
    const state = createControlHold();
    let triggers = 0;
    for (let t = 0; t <= 2200; t += 100) {
      if (updateControlHold(state, t % 400 === 200 ? null : kind, t).triggered) triggers++;
    }
    assert.equal(triggers, 1);
    updateControlHold(state, null, 2600);
    for (let t = 2700; t <= 3800; t += 100) {
      if (updateControlHold(state, kind, t).triggered) triggers++;
    }
    assert.equal(triggers, 2);
  }
});

test('long tracking loss cancels a pending hold', () => {
  const state = createControlHold();
  for (let t = 0; t <= 700; t += 100) updateControlHold(state, 'ok', t);
  assert.equal(updateControlHold(state, 'ok', 1100).triggered, null);
  assert.equal(state.started, 1100);
});
