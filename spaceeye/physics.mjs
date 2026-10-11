export const ARENA_RADIUS = 64;
export const SHIP_RADIUS = 4;

// The circular map identifies opposite points on its boundary. Preserve overshoot
// and velocity so crossing an edge feels continuous instead of bouncing off it.
export function wrapShip(ship) {
  const dx = ship.x - 80, dy = ship.y - 80;
  const distance = Math.hypot(dx, dy);
  if (distance > ARENA_RADIUS) {
    const radius = ((distance + ARENA_RADIUS) % (2 * ARENA_RADIUS)) - ARENA_RADIUS;
    ship.x = 80 + dx / distance * radius;
    ship.y = 80 + dy / distance * radius;
  }
}

export function collideShips(ships) {
  // Several passes also separate a cluster of three or four overlapping ships.
  for (let pass = 0; pass < 4; pass++) {
    for (let i = 0; i < ships.length; i++) {
      for (let j = i + 1; j < ships.length; j++) {
        const a = ships[i], b = ships[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const distance = Math.hypot(dx, dy);
        if (distance >= 2 * SHIP_RADIUS) continue;
        const relativeX = b.vx - a.vx, relativeY = b.vy - a.vy;
        const relativeSpeed = Math.hypot(relativeX, relativeY);
        // Coincident centers use the incoming relative velocity, or a fixed axis.
        const nx = distance > 1e-9 ? dx / distance : relativeSpeed > 1e-9 ? -relativeX / relativeSpeed : 1;
        const ny = distance > 1e-9 ? dy / distance : relativeSpeed > 1e-9 ? -relativeY / relativeSpeed : 0;
        const correction = (2 * SHIP_RADIUS - distance + 1e-6) / 2;
        a.x -= nx * correction; a.y -= ny * correction;
        b.x += nx * correction; b.y += ny * correction;
        const approach = relativeX * nx + relativeY * ny;
        if (approach < 0) {
          // Equal masses, with a little energy loss on impact.
          const impulse = -(1 + 0.85) * approach / 2;
          a.vx -= impulse * nx; a.vy -= impulse * ny;
          b.vx += impulse * nx; b.vy += impulse * ny;
        }
        wrapShip(a); wrapShip(b);
      }
    }
  }
}

export function advanceShips(ships, dt, now) {
  // Small steps prevent fast ships passing through each other between updates.
  const steps = Math.max(1, Math.ceil(dt / 0.01)), step = dt / steps;
  for (let n = 0; n < steps; n++) {
    for (const s of ships) {
      const input = now - s.inputAt < 350 ? s.input : {};
      s.a += (Number(!!input.right) - Number(!!input.left)) * 3.5 * step;
      const damping = Math.exp(-(input.brake ? 6 : 0.65) * step);
      s.vx = (s.vx + Math.cos(s.a) * (input.thrust ? 30 : 0) * step) * damping;
      s.vy = (s.vy + Math.sin(s.a) * (input.thrust ? 30 : 0) * step) * damping;
      const speed = Math.hypot(s.vx, s.vy);
      if (speed > 35) { s.vx *= 35 / speed; s.vy *= 35 / speed; }
      s.x += s.vx * step; s.y += s.vy * step;
      s.thrust = !!input.thrust;
      wrapShip(s);
    }
    collideShips(ships);
  }
}
