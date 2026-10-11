import { DurableObject } from 'cloudflare:workers';
import { HTML } from './page.mjs';
import { newWorld, newShip, advanceWorld, fireAction } from './simulation.mjs';
const noCache = { 'Cache-Control': 'no-store' };
export class SpaceRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS arena_world (id INTEGER PRIMARY KEY, value TEXT NOT NULL)');
    const saved = this.ctx.storage.sql.exec('SELECT value FROM arena_world WHERE id = 1').toArray()[0];
    this.world = saved ? JSON.parse(saved.value) : newWorld(Date.now());
    this.savedActive = !!saved; this.lcdAt = 0;
  }
  sessions() { return this.ctx.getWebSockets().filter(ws => ws.readyState === 1).map(ws => ({ ws, data: ws.deserializeAttachment() })); }
  save(sessions) {
    for (const { ws, data } of sessions) ws.serializeAttachment(data);
    const active = this.world.projectiles.length > 0 || this.world.effects.length > 0;
    if (active) this.ctx.storage.sql.exec('INSERT OR REPLACE INTO arena_world (id, value) VALUES (1, ?)', JSON.stringify(this.world));
    else if (this.savedActive) this.ctx.storage.sql.exec('DELETE FROM arena_world WHERE id = 1');
    this.savedActive = active;
  }
  advance() {
    const sessions = this.sessions();
    advanceWorld(this.world, sessions.map(s => s.data).filter(s => s.slot !== null), Date.now());
    this.save(sessions);
  }
  state() {
    const now = Date.now();
    return { type: 'state', physics: 'collisions-wrap-v1', now, lcdAt: this.lcdAt, projectiles: this.world.projectiles, effects: this.world.effects,
      ships: this.sessions().map(s => s.data).filter(s => s.slot !== null).map(s => ({
        slot: s.slot, x: s.x, y: s.y, a: s.a, vx: s.vx, vy: s.vy, thrust: s.thrust,
        hp: s.hp, kills: s.kills, deaths: s.deaths, shield: now < s.shieldUntil,
        hit: now < s.hitUntil, warp: now < s.warpUntil,
        respawnMs: Math.max(0, s.respawnAt - now),
        cooldowns: Object.fromEntries(Object.entries(s.ready).map(([k, at]) => [k, Math.max(0, at - now)])),
      })) };
  }
  broadcast() {
    const value = JSON.stringify(this.state());
    for (const { ws } of this.sessions()) { try { ws.send(value); } catch { ws.close(1011, 'Connection error'); } }
  }
  async fetch(request) {
    const url = new URL(request.url); this.advance();
    if (url.pathname === '/lcd') {
      this.lcdAt = Date.now(); const state = this.state();
      // Keep the first protocol available for already-flashed devices during rollout.
      const legacy = url.searchParams.get('v') !== '2';
      const rows = state.ships.map(s => legacy
        ? `${s.slot} ${s.x.toFixed(2)} ${s.y.toFixed(2)} ${s.a.toFixed(3)} ${s.thrust ? 1 : 0}`
        : `${s.slot} ${s.x.toFixed(2)} ${s.y.toFixed(2)} ${s.a.toFixed(3)} ${s.thrust ? 1 : 0} ${s.hp} ${s.shield ? 1 : 0} ${s.warp ? 1 : 0}`);
      let lines = ['SPACEYE' + (legacy ? '1' : '2'), rows.length, ...rows];
      if (!legacy) lines.push(state.projectiles.length,
        ...state.projectiles.map(p => `${p.kind} ${p.owner} ${p.x.toFixed(2)} ${p.y.toFixed(2)} ${p.a.toFixed(3)}`),
        state.effects.length, ...state.effects.map(e => `${e.kind} ${e.slot} ${e.x.toFixed(2)} ${e.y.toFixed(2)} ${((state.now - e.born) / 1000).toFixed(2)}`));
      return new Response(lines.join('\n') + '\n', { headers: { ...noCache, 'Content-Type': 'text/plain' } });
    }
    if (url.pathname === '/state') return Response.json(this.state(), { headers: noCache });
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return new Response('WebSocket required', { status: 426 });
    if (request.headers.get('Origin') !== url.origin) return new Response('Origin rejected', { status: 403 });
    if (this.sessions().length >= 20) return new Response('Room at capacity', { status: 503 });
    const [client, server] = Object.values(new WebSocketPair()); this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ slot: null, lastMessage: 0, inputAt: 0, input: {} });
    server.send(JSON.stringify({ type: 'welcome', slot: null, version: 3 })); server.send(JSON.stringify(this.state()));
    return new Response(null, { status: 101, webSocket: client });
  }
  webSocketMessage(ws, message) {
    if (typeof message !== 'string' || message.length > 256) { ws.close(1009, 'Invalid message'); return; }
    let m; try { m = JSON.parse(message); } catch { return; }
    if (!m || typeof m !== 'object' || !['join', 'leave', 'input', 'ping', 'action'].includes(m.type)) return;
    let s = ws.deserializeAttachment(); const now = Date.now();
    if ((m.type === 'input' || m.type === 'ping') && now - s.lastMessage < 25) return;
    this.advance(); s = ws.deserializeAttachment(); s.lastMessage = now;
    if (m.type === 'join' && s.slot === null) {
      const used = this.state().ships.map(s => s.slot), slot = [0, 1, 2, 3].find(i => !used.includes(i));
      if (slot === undefined) { ws.send(JSON.stringify({ type: 'error', message: 'All four seats are taken.' })); return; }
      s = { ...s, ...newShip(slot, now) }; ws.serializeAttachment(s);
      ws.send(JSON.stringify({ type: 'joined', slot })); this.broadcast(); return;
    }
    if (m.type === 'leave') {
      this.world.projectiles = this.world.projectiles.filter(p => p.owner !== s.slot);
      s.slot = null; s.input = {}; ws.serializeAttachment(s); this.save(this.sessions()); this.broadcast(); return;
    }
    if (m.type === 'action' && s.slot !== null) {
      if (!['gun', 'missile', 'photon', 'warp'].includes(m.action)) return;
      const accepted = fireAction(this.world, this.sessions().map(s => s.data).filter(s => s.slot !== null), s, m.action, now);
      ws.send(JSON.stringify({ type: 'action', action: m.action, accepted }));
    }
    if (m.type === 'input' && s.slot !== null) {
      s.input = { left: m.left === true, right: m.right === true, thrust: m.thrust === true, brake: m.brake === true, gun: m.gun === true }; s.inputAt = now;
    }
    ws.serializeAttachment(s); this.save(this.sessions()); this.broadcast();
  }
  release(ws) {
    const s = ws.deserializeAttachment(); this.world.projectiles = this.world.projectiles.filter(p => p.owner !== s.slot);
    s.slot = null; ws.serializeAttachment(s); this.save(this.sessions()); this.broadcast();
  }
  webSocketClose(ws, code, reason) { this.release(ws); ws.close(code, reason); }
  webSocketError(ws) { this.release(ws); ws.close(1011, 'Connection error'); }
}
export default {
  async fetch(request, env) {
    const u = new URL(request.url);
    if (['/ws', '/lcd', '/state'].includes(u.pathname)) return env.ROOM.getByName('lcd-arena-v4').fetch(request);
    if (u.pathname === '/health') return Response.json({ ok: true, game: 'spaceeye', players: 4, version: 3 });
    if (u.pathname !== '/') return new Response('Not found', { status: 404 });
    return new Response(HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'" } });
  },
};
