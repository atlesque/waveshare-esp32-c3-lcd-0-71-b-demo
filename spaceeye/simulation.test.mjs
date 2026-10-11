import assert from 'node:assert/strict';
import { newWorld, newShip, advanceWorld, fireAction, steerBot, MAX_PROJECTILES } from './simulation.mjs';
function ship(slot, x, y, a = 0) { return { ...newShip(slot, 0), x, y, a, shieldUntil: 0 }; }
function run(world, ships, until) { for (let now = world.last + 20; now <= until; now += 20) advanceWorld(world, ships, now); }
{
  const world = newWorld(0), attacker = ship(0, 40, 80), victim = ship(1, 70, 80);
  victim.hp = 8;
  assert.ok(fireAction(world, [attacker, victim], attacker, 'gun', 0));
  assert.equal(fireAction(world, [attacker, victim], attacker, 'gun', 0), false, 'gun cooldown');
  run(world, [attacker, victim], 300);
  assert.equal(victim.hp, 0, 'gun hit destroys weakened ship'); assert.equal(attacker.kills, 1);
  assert.equal(victim.deaths, 1); assert.ok(world.effects.some(e => e.kind === 1));
  run(world, [attacker, victim], 2000);
  assert.equal(victim.hp, 100, 'automatic respawn'); assert.ok(victim.shieldUntil > 2000); assert.equal(victim.deaths, 1);
}
{
  const world = newWorld(0), attacker = ship(0, 40, 80), victim = ship(1, 65, 95), distant = ship(2, 105, 110);
  fireAction(world, [attacker, victim, distant], attacker, 'missile', 0);
  assert.equal(world.projectiles[0].target, 1, 'nearest opponent targeted');
  run(world, [attacker, victim, distant], 200);
  assert.ok(world.projectiles[0].a > 0, 'missile turns towards off-axis target');
  run(world, [attacker, victim, distant], 1500); assert.equal(victim.hp, 76, 'guided missile hits');
}
{
  const world = newWorld(0), attacker = ship(0, 30, 80), victim = ship(1, 55, 80), nearby = ship(2, 60, 90);
  fireAction(world, [attacker, victim, nearby], attacker, 'photon', 0);
  run(world, [attacker, victim, nearby], 600);
  assert.equal(victim.hp, 60); assert.equal(nearby.hp, 60, 'photon splash damages nearby opponent');
  assert.equal(attacker.hp, 100, 'no self damage'); assert.ok(world.effects.some(e => e.kind === 3));
}
{
  const world = newWorld(0), s = ship(0, 130, 80); const old = { x: s.x, y: s.y };
  assert.ok(fireAction(world, [s], s, 'warp', 0)); assert.ok(Math.hypot(s.x - old.x, s.y - old.y) > 5);
  assert.ok(Math.hypot(s.x - 80, s.y - 80) <= 64.001, 'warp stays inside arena');
  assert.equal(world.effects.filter(e => e.kind === 2).length, 2, 'both warp portals visible');
  assert.equal(fireAction(world, [s], s, 'warp', 1), false, 'warp cooldown');
  assert.ok(fireAction(world, [s], s, 'warp', 5000), 'warp recharges');
  s.hp = 0; assert.equal(fireAction(world, [s], s, 'missile', 6000), false, 'destroyed ships cannot fire');
}
{
  const world = newWorld(0), attacker = ship(0, 40, 80), victim = ship(1, 60, 80);
  victim.shieldUntil = 1000; fireAction(world, [attacker, victim], attacker, 'gun', 0);
  run(world, [attacker, victim], 400); assert.equal(victim.hp, 100, 'spawn shield blocks damage');
  world.projectiles = Array.from({ length: MAX_PROJECTILES }, () => ({})); attacker.ready.photon = 0;
  assert.equal(fireAction(world, [attacker, victim], attacker, 'photon', 500), false, 'bounded projectile pool');
  assert.equal(fireAction(world, [attacker, victim], attacker, 'unknown', 500), false);
}
{
  const world = newWorld(0), s = ship(0, 80, 80); s.input = { gun: true }; s.inputAt = 0;
  run(world, [s], 300); assert.ok(world.projectiles.length > 0, 'held guns fire');
  run(world, [s], 380); const fired = s.ready.gun;
  run(world, [s], 700); assert.equal(s.ready.gun, fired, 'stale input stops firing');
}
{
  const world = newWorld(0), bot = { ...ship(1, 80, 80, Math.PI / 2), bot: true }, human = ship(0, 110, 80);
  steerBot(world, [human, bot], bot, 0);
  assert.equal(bot.input.left, true, 'AI pilot turns towards its target');
  run(world, [human, bot], 3000);
  assert.ok(human.hp < 100 || human.deaths > 0, 'AI pilot attacks the nearest opponent');
  assert.ok(world.projectiles.every(p => p.owner === 1) && bot.inputAt === 3000, 'AI pilot keeps steering itself');
}
console.log('PASS: AI steering and attacks, gun hits, kill credit, respawn shields, guided missiles, photon splash, warp bounds/cooldowns, projectile limits, stale input');
