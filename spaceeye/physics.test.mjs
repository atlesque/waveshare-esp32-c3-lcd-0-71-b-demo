import assert from 'node:assert/strict';
import { advanceShips, collideShips, wrapShip, ARENA_RADIUS, SHIP_RADIUS } from './physics.mjs';
import { newWorld, newShip, advanceWorld, fireAction } from './simulation.mjs';

const ship = (x, y, vx = 0, vy = 0) => ({ x, y, vx, vy, a: 0, input: {}, inputAt: 0 });
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-5, `${actual} != ${expected}`);

for (const angle of [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2, Math.PI / 4]) {
  const s = ship(80 + 65 * Math.cos(angle), 80 + 65 * Math.sin(angle), 12, -7);
  wrapShip(s);
  near(s.x, 80 - 63 * Math.cos(angle)); near(s.y, 80 - 63 * Math.sin(angle));
  assert.equal(s.vx, 12); assert.equal(s.vy, -7); assert.equal(s.a, 0);
}
const edge = ship(144, 80); wrapShip(edge); assert.equal(edge.x, 144);
const crossing = ship(143.9, 80, 35); advanceShips([crossing], .15, 1000);
assert.ok(crossing.x < 25 && crossing.vx > 0, 'crossing wraps and keeps momentum');

let a = ship(77, 80, 10), b = ship(83, 80, -10);
collideShips([a, b]);
assert.ok(a.vx < 0 && b.vx > 0, 'head-on impact bounces both ships');
near(a.vx + b.vx, 0);
assert.ok(Math.hypot(b.x - a.x, b.y - a.y) >= 2 * SHIP_RADIUS);

a = ship(77, 80, -10); b = ship(83, 80, 10);
collideShips([a, b]);
assert.equal(a.vx, -10); assert.equal(b.vx, 10);

a = ship(80, 80, 10, 2); b = ship(80, 80, -10, -2);
collideShips([a, b]);
assert.ok(a.vx < 0 && b.vx > 0, 'coincident ships separate and bounce');
for (const s of [a, b]) for (const k of ['x', 'y', 'vx', 'vy']) assert.ok(Number.isFinite(s[k]));

a = ship(77, 80, 10, 3); b = ship(83, 80, -10, 3);
collideShips([a, b]); near(a.vy, 3); near(b.vy, 3);

a = ship(72, 80, 35); b = ship(88, 80, -35);
advanceShips([a, b], .15, 1000);
assert.ok(a.x < b.x && a.vx < 0 && b.vx > 0, 'fast ships cannot tunnel through each other');

const cluster = [ship(80, 80), ship(80, 80), ship(80, 80), ship(80, 80)];
advanceShips(cluster, .15, 1000);
for (let i = 0; i < cluster.length; i++) for (let j = i + 1; j < cluster.length; j++) {
  assert.ok(Math.hypot(cluster[i].x - cluster[j].x, cluster[i].y - cluster[j].y) >= 2 * SHIP_RADIUS - 1e-5);
}
const boundary = [ship(142, 80), ship(143, 80)];
advanceShips(boundary, .15, 1000);
for (const s of boundary) assert.ok(Math.hypot(s.x - 80, s.y - 80) <= ARENA_RADIUS);

const stale = ship(80, 80); stale.input = { thrust: true }; stale.inputAt = 1;
advanceShips([stale], .15, 1000); assert.equal(stale.vx, 0);
console.log('PASS: circular wrapping, momentum, collisions, overlap recovery, fast impacts, stale input');

const world = newWorld(1000);
const pilot = newShip(0, 1000);
Object.assign(pilot, { x: 143.9, y: 80, vx: 35, a: 0 });
advanceWorld(world, [pilot], 1150);
assert.ok(pilot.x < 25 && pilot.vx > 0, 'combat world uses edge wrapping');
const first = newShip(0, 1000), second = newShip(1, 1000);
Object.assign(first, { x: 77, y: 80, vx: 10 });
Object.assign(second, { x: 83, y: 80, vx: -10 });
advanceWorld(newWorld(1000), [first, second], 1150);
assert.ok(first.vx < 0 && second.vx > 0, 'combat world uses ship collisions');
Object.assign(pilot, { x: 140, y: 80, a: 0 });
assert.ok(fireAction(world, [pilot], pilot, 'warp', 1200));
assert.ok(pilot.x < 80, 'combat warp also respects map wrapping');
console.log('PASS: collisions and edge wrapping integrated with combat simulation');
