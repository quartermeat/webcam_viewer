import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceMouse } from './circuit-mouse.mjs';
const mouse = () => ({x:.5,y:.5,speed:.04,phase:0});
test('mice pause to scan and to digest packets',()=>{
 const m=mouse();advanceMouse(m,1,0,.05,Math.PI/4.2);
 assert.equal(m.activity,'scanning');assert.equal(m.x,.5);
 m.nibble=.6;advanceMouse(m,1,0,.05,0);
 assert.equal(m.activity,'nibbling');assert.equal(m.x,.5);
 advanceMouse(m,1,0,.6,0);assert.equal(m.activity,'scurrying');assert.ok(m.x>.5);
});
test('short approaches stop at target without overshooting',()=>{
 const m=mouse();advanceMouse(m,.0001,0,.05,0);
 assert.equal(m.x,.5001);assert.equal(m.y,.5);
 advanceMouse(m,0,0,.05,0);assert.ok(Number.isFinite(m.heading));
});
