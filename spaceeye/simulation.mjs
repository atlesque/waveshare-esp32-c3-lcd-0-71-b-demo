import { advanceShips, wrapShip } from './physics.mjs';
export const WEAPONS = {
  gun: { kind: 0, speed: 95, damage: 8, radius: 1, ttl: 1400, cooldown: 180 },
  missile: { kind: 1, speed: 45, damage: 24, radius: 2, ttl: 3500, cooldown: 1500 },
  photon: { kind: 2, speed: 32, damage: 40, radius: 3, ttl: 3500, cooldown: 2500 },
  warp: { cooldown: 5000 },
};
export const MAX_PROJECTILES = 24;
export const MAX_EFFECTS = 8;
export function newWorld(now) { return { last: now, nextId: 1, projectiles: [], effects: [], bots: [] }; }
export function newShip(slot, now) {
  const a = slot * Math.PI / 2;
  return { slot, x: 80 + 35 * Math.cos(a), y: 80 + 35 * Math.sin(a), a: a + Math.PI / 2,
    vx: 0, vy: 0, hp: 100, kills: 0, deaths: 0, shieldUntil: now + 2000,
    respawnAt: 0, hitUntil: 0, warpUntil: 0, ready: { gun: 0, missile: 0, photon: 0, warp: 0 },
    input: {}, inputAt: 0, thrust: false };
}

// AI pilots chase the nearest opponent, fire guns when lined up and use heavier
// weapons when their cooldowns allow. They reuse the human input model, so physics
// and weapons treat them exactly like any other ship.
export function steerBot(world, ships, bot, now) {
  const target = ships.filter(s => s.slot !== bot.slot && s.hp > 0)
    .sort((a, b) => Math.hypot(a.x - bot.x, a.y - bot.y) - Math.hypot(b.x - bot.x, b.y - bot.y))[0];
  bot.inputAt = now;
  if (!target) { bot.input = { thrust: Math.hypot(bot.x - 80, bot.y - 80) > 30, right: true }; return; }
  const distance = Math.hypot(target.x - bot.x, target.y - bot.y);
  const delta = Math.atan2(Math.sin(Math.atan2(target.y - bot.y, target.x - bot.x) - bot.a),
    Math.cos(Math.atan2(target.y - bot.y, target.x - bot.x) - bot.a));
  const aligned = Math.abs(delta) < 0.25;
  bot.input = { left: delta < -0.08, right: delta > 0.08, thrust: Math.abs(delta) < 0.8 && distance > 25,
    brake: distance < 14, gun: aligned && distance < 50 && now >= target.shieldUntil };
  if (now < target.shieldUntil) return;
  if (aligned && distance < 40 && now >= bot.ready.photon) fireAction(world, ships, bot, 'photon', now);
  else if (distance < 60 && now >= bot.ready.missile + 1500) fireAction(world, ships, bot, 'missile', now);
}

function effect(world, kind, x, y, slot, now) {
  world.effects.push({ id: world.nextId++, kind, x, y, slot, born: now, until: now + 1000 });
  world.effects = world.effects.slice(-MAX_EFFECTS);
}
export function fireAction(world, ships, ship, action, now) {
  const spec = WEAPONS[action];
  if (!spec || !ship || ship.hp <= 0 || now < ship.ready[action]) return false;
  if (action === 'warp') {
    effect(world, 2, ship.x, ship.y, ship.slot, now);
    ship.x += Math.cos(ship.a) * 45; ship.y += Math.sin(ship.a) * 45; wrapShip(ship);
    ship.vx *= .25; ship.vy *= .25; ship.warpUntil = now + 700; ship.shieldUntil = now + 500;
    effect(world, 2, ship.x, ship.y, ship.slot, now);
  } else {
    if (world.projectiles.length >= MAX_PROJECTILES) return false;
    const target = ships.filter(s => s.slot !== ship.slot && s.hp > 0)
      .sort((a, b) => Math.hypot(a.x - ship.x, a.y - ship.y) - Math.hypot(b.x - ship.x, b.y - ship.y))[0];
    world.projectiles.push({ id: world.nextId++, owner: ship.slot, kind: spec.kind,
      x: ship.x + Math.cos(ship.a) * 7, y: ship.y + Math.sin(ship.a) * 7,
      a: ship.a, target: target?.slot ?? -1, until: now + spec.ttl });
    // Firing ends spawn protection, so protected ships cannot attack without risk.
    ship.shieldUntil = 0;
  }
  ship.ready[action] = now + spec.cooldown;
  return true;
}
function damage(world, ships, victim, amount, owner, now) {
  if (victim.hp <= 0 || now < victim.shieldUntil || victim.slot === owner) return;
  victim.hp = Math.max(0, victim.hp - amount); victim.hitUntil = now + 250;
  if (!victim.hp) {
    victim.deaths++; victim.respawnAt = now + 1500; victim.vx = victim.vy = 0; victim.thrust = false;
    const attacker = ships.find(s => s.slot === owner); if (attacker) attacker.kills++;
    effect(world, 1, victim.x, victim.y, victim.slot, now);
  }
}
function step(world, ships, now, dt) {
  for (const s of ships) {
    if (s.hp <= 0) {
      if (now >= s.respawnAt) {
        const fresh = newShip(s.slot, now);
        Object.assign(s, fresh, { kills: s.kills, deaths: s.deaths });
      } else continue;
    }
  }
  const activeShips = ships.filter(s => s.hp > 0);
  for (const s of activeShips) if (s.bot) steerBot(world, ships, s, now);
  advanceShips(activeShips, dt, now);
  for (const s of activeShips) {
    const input = now - s.inputAt < 350 ? s.input : {};
    if (input.gun) fireAction(world, ships, s, 'gun', now);
  }

  world.projectiles = world.projectiles.filter(p => {
    const spec = Object.values(WEAPONS).find(w => w.kind === p.kind);
    if (now >= p.until) {
      if (p.kind === 2) explode(world, ships, p, spec, now);
      return false;
    }
    if (p.kind === 1) {
      let target = ships.find(s => s.slot === p.target && s.hp > 0 && s.slot !== p.owner);
      if (!target) target = ships.filter(s => s.slot !== p.owner && s.hp > 0)
        .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
      if (target) {
        p.target = target.slot;
        const desired = Math.atan2(target.y - p.y, target.x - p.x);
        const delta = Math.atan2(Math.sin(desired - p.a), Math.cos(desired - p.a));
        p.a += Math.max(-2.8 * dt, Math.min(2.8 * dt, delta));
      }
    }
    const x = p.x, y = p.y;
    p.x += Math.cos(p.a) * spec.speed * dt; p.y += Math.sin(p.a) * spec.speed * dt;
    const victim = ships.find(s => {
      if (s.slot === p.owner || s.hp <= 0 || now < s.shieldUntil) return false;
      const dx = p.x - x, dy = p.y - y, length = dx * dx + dy * dy;
      const u = length ? Math.max(0, Math.min(1, ((s.x - x) * dx + (s.y - y) * dy) / length)) : 0;
      return Math.hypot(s.x - x - u * dx, s.y - y - u * dy) < 4 + spec.radius;
    });
    if (victim) {
      if (p.kind === 2) explode(world, ships, p, spec, now);
      else { damage(world, ships, victim, spec.damage, p.owner, now); effect(world, 0, p.x, p.y, p.owner, now); }
      return false;
    }
    if (Math.hypot(p.x - 80, p.y - 80) > 70) {
      if (p.kind === 2) explode(world, ships, p, spec, now);
      return false;
    }
    return true;
  });
}
function explode(world, ships, p, spec, now) {
  effect(world, 3, p.x, p.y, p.owner, now);
  for (const s of ships) {
    if (Math.hypot(s.x - p.x, s.y - p.y) < 18) damage(world, ships, s, spec.damage, p.owner, now);
  }
}
export function advanceWorld(world, ships, now) {
  // Substeps prevent fast gun rounds passing through ships between network messages.
  const elapsed = Math.max(0, Math.min(250, now - world.last));
  const steps = Math.max(1, Math.ceil(elapsed / 20));
  for (let i = 0; i < steps; i++) step(world, ships, now - elapsed + elapsed * (i + 1) / steps, elapsed / steps / 1000);
  world.last = now; world.effects = world.effects.filter(e => e.until > now);
}
