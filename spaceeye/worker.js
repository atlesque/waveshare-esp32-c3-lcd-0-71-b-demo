import { DurableObject } from 'cloudflare:workers';
const HTML = "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><meta name=\"theme-color\" content=\"#080d19\"><title>Spaceeye · Four pilots, one tiny universe</title><style>\n*{box-sizing:border-box}body{margin:0;background:#080d19;color:#e9f2ff;font-family:system-ui,sans-serif}main{max-width:1150px;margin:auto;padding:30px 25px}header{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #253044;padding-bottom:20px}.brand{font-size:23px;font-weight:800;letter-spacing:3px}.brand span{color:#70e7da}.tag{font-size:11px;letter-spacing:2px;color:#91a4bd}.status{font-size:12px;color:#95a7be}.layout{display:grid;grid-template-columns:1fr 300px;gap:45px;margin-top:34px}h1{font-size:clamp(30px,4vw,46px);letter-spacing:-2px;margin:8px 0 12px}p{color:#91a4bd;line-height:1.6}.arena{width:100%;max-width:650px;display:block;aspect-ratio:1;touch-action:none}.panel{border:1px solid #253044;background:#0e1523;border-radius:18px;padding:24px;align-self:center}.eyebrow{color:#70e7da;font-size:11px;letter-spacing:2px}h2{font-size:22px;margin:14px 0}button{font:inherit;cursor:pointer;background:#70e7da;color:#07131c;border:0;border-radius:10px;padding:14px 18px;font-weight:700}button:disabled{opacity:.45;cursor:default}.primary{width:100%}.secondary{background:#1e293c;color:#dbe7fa;margin-top:10px;width:100%}.pilots{margin:24px 0}.pilot{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #243046;padding:13px 0;font-size:13px}.dot{display:inline-block;width:8px;height:8px;border-radius:100%;margin-right:10px}.controls{display:flex;gap:10px;margin-top:20px}.controls button{flex:1;background:#1d2b40;color:white;font-size:22px;touch-action:none;user-select:none;min-height:62px}.controls button.active{background:#70e7da;color:#07131c}small{font-size:12px;color:#91a4bd;line-height:1.6;display:block;margin-top:14px}.telemetry{display:flex;justify-content:space-between;font:11px monospace;letter-spacing:1px;color:#778ca9;margin:12px 0}footer{margin-top:26px;border-top:1px solid #253044;padding-top:18px;font-size:11px;letter-spacing:1px;color:#657b99}a{color:#70e7da}:focus-visible{outline:3px solid white;outline-offset:3px}@media(max-width:800px){main{padding:20px 18px}.layout{grid-template-columns:1fr;gap:16px;margin-top:22px}.panel{padding:20px}.arena{max-width:480px;margin:auto}.tag{display:none}h1{margin-top:5px}.pilots{display:grid;grid-template-columns:1fr 1fr;gap:0 20px;margin:15px 0}}\n.arsenal{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:12px}.arsenal button{background:#1c293d;color:#e9f2ff;touch-action:none;user-select:none;text-align:left;font-size:13px;padding:12px}.arsenal button strong{display:block}.arsenal button small{margin:4px 0 0;font:10px monospace;letter-spacing:.4px}.arsenal button.active{background:#70e7da;color:#07131c}.arsenal button[data-action=\"photon\"]{border:1px solid #bc9cff66}.arsenal button[data-action=\"warp\"]{border:1px solid #70e7da66}.hull{margin:14px 0 18px;font:12px monospace;color:#70e7da}.hull meter{display:block;width:100%;height:10px;margin-top:7px;accent-color:#70e7da}.pilot small{margin:0;font-size:10px}.panel{align-self:start}.arsenal button:disabled{opacity:.55}</style></head><body><main><header><div class=\"brand\">SPACE<span>EYE</span></div><div class=\"tag\">FOUR PILOTS · ONE TINY UNIVERSE</div><div class=\"status\" id=\"network\" role=\"status\">Connecting…</div></header><div class=\"layout\"><section><div class=\"eyebrow\">LIVE ORBIT / ATLESQUE</div><h1>Your universe. In miniature.</h1><p>Take a ship. Explore together. Every move lands on the tiny LCD.</p><canvas class=\"arena\" id=\"arena\" width=\"800\" height=\"800\" aria-label=\"Live shared space arena with up to four ships\"></canvas><div class=\"telemetry\"><span id=\"count\">0 / 4 PILOTS</span><span id=\"lcd\">LCD · WAITING</span><span>SECTOR 001</span></div></section><aside class=\"panel\"><div class=\"eyebrow\">FLIGHT DECK</div><h2 id=\"identity\">Ready for launch?</h2><p id=\"message\" role=\"status\">Join from any phone or computer. Four seats, one shared sky.</p><button class=\"primary\" id=\"join\" disabled>Take a ship →</button><button class=\"secondary\" id=\"leave\" hidden>Leave ship</button><div class=\"hull\" id=\"hull\" hidden><span id=\"hull-label\"></span><meter id=\"hull-meter\" min=\"0\" max=\"100\" value=\"100\" aria-label=\"Ship hull\"></meter></div><div class=\"pilots\" id=\"pilots\"></div><div class=\"eyebrow\">MANUAL CONTROLS</div><div class=\"controls\"><button aria-label=\"Turn left\" data-control=\"left\">↶</button><button aria-label=\"Thrust\" data-control=\"thrust\">↑</button><button aria-label=\"Turn right\" data-control=\"right\">↷</button><button aria-label=\"Brake\" data-control=\"brake\">■</button></div><small>← → or A / D to turn<br>↑ or W to thrust · ↓ or S to brake<br>On mobile, hold the flight buttons.<br>Ships bounce on contact. Cross an edge to wrap to the opposite side.</small><div class=\"eyebrow\" style=\"margin-top:22px\">WEAPONS &amp; WARP</div><div class=\"arsenal\"><button data-control=\"gun\" aria-label=\"Fire guns\" disabled><strong>Guns</strong><small>SPACE · HOLD TO FIRE</small></button><button data-action=\"missile\" aria-label=\"Launch missile\" disabled><strong>Missile</strong><small id=\"cd-missile\">M · GUIDED</small></button><button data-action=\"photon\" aria-label=\"Fire photon torpedo\" disabled><strong>Photon torpedo</strong><small id=\"cd-photon\">T · SPLASH DAMAGE</small></button><button data-action=\"warp\" aria-label=\"Activate warp drive\" disabled><strong>Warp drive</strong><small id=\"cd-warp\">SHIFT · JUMP</small></button></div><small>Guns: hold Space · Missile: M<br>Photon torpedo: T · Warp drive: Shift<br>Ships respawn after destruction.</small><small>Invite your crew: <a href=\"/\">spaceeye.atlesque.dev</a></small></aside></div><footer>ATLESQUE EXPERIMENTS &nbsp; / &nbsp; A SMALL WINDOW INTO A SHARED WORLD</footer></main><script>\nconst $ = id => document.getElementById(id);\nconst colors = ['#70e7da', '#fbb969', '#bc9cff', '#ff789a'], names = ['Comet', 'Nova', 'Orbit', 'Pulsar'];\nlet ws, slot = null, ships = [], projectiles = [], effects = [], connected = false;\nlet stateAt = 0, lcdAt = 0, serverNow = 0, retry = 500, feedback = '', feedbackUntil = 0;\nconst input = { left: false, right: false, thrust: false, brake: false, gun: false }, held = new Set();\nfunction send(value) { if (ws?.readyState === 1) ws.send(JSON.stringify(value)); }\nfunction clearControls() {\n  held.clear(); for (const k in input) input[k] = false;\n  document.querySelectorAll('[data-control]').forEach(b => b.classList.remove('active'));\n  send({ type: 'input', ...input });\n}\nfunction ui() {\n  const me = ships.find(s => s.slot === slot), age = Date.now() - stateAt, humans = ships.filter(s => !s.bot).length;\n  $('network').textContent = connected ? '● Connected' : '○ Reconnecting…';\n  $('join').disabled = !connected || humans >= 4;\n  $('join').hidden = slot !== null; $('leave').hidden = slot === null;\n  $('identity').textContent = slot === null ? 'Ready for launch?' : names[slot] + ' · Pilot ' + (slot + 1);\n  $('identity').style.color = slot === null ? '' : colors[slot];\n  $('message').textContent = slot === null\n    ? (humans >= 4 ? 'All four ships are flying. Watch here until a seat opens.' : humans ? 'Join to take over an AI ship. Four seats, one shared sky.' : 'Join from any phone or computer. AI pilots fill the empty seats.')\n    : (me?.hp === 0 ? 'Ship destroyed. Respawning in ' + (Math.max(0, me.respawnMs - age) / 1000).toFixed(1) + 's…'\n      : Date.now() < feedbackUntil ? feedback : 'Fly, fight, and jump. Hold guns to fire; heavier weapons recharge.');\n  $('hull').hidden = slot === null;\n  $('hull-label').textContent = 'HULL ' + (me?.hp ?? 100) + '% · ' + (me?.kills ?? 0) + ' KILLS';\n  $('hull-meter').value = me?.hp ?? 100;\n  $('count').textContent = humans + ' / 4 PILOTS' + (ships.length > humans ? ' · ' + (ships.length - humans) + ' AI' : '');\n  $('lcd').textContent = Date.now() - lcdAt < 5000 ? 'LCD · LIVE' : 'LCD · OFFLINE';\n  $('pilots').innerHTML = names.map((n, i) => {\n    const s = ships.find(s => s.slot === i);\n    return '<div class=\"pilot\"><span><i class=\"dot\" style=\"background:' + colors[i] + '\"></i>' + n + '</span><span>'\n      + (s ? (slot === i ? 'YOU · ' : s.bot ? 'AI · ' : '') + s.hp + '%<small>' + s.kills + ' kills' + (s.hp === 0 ? ' · respawning' : '') + '</small>' : 'OPEN SEAT') + '</span></div>';\n  }).join('');\n  document.querySelectorAll('[data-control]').forEach(b => b.disabled = !connected || slot === null || me?.hp === 0);\n  const hints = { missile: 'M · GUIDED', photon: 'T · SPLASH DAMAGE', warp: 'SHIFT · JUMP' };\n  document.querySelectorAll('[data-action]').forEach(b => {\n    const action = b.dataset.action, remaining = Math.max(0, (me?.cooldowns?.[action] ?? 0) - age);\n    b.disabled = !connected || slot === null || !me || me.hp === 0 || remaining > 0;\n    $('cd-' + action).textContent = remaining > 0 ? 'RECHARGING ' + (remaining / 1000).toFixed(1) + 's' : hints[action];\n  });\n}\nfunction connect() {\n  ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws');\n  ws.onopen = () => { connected = true; retry = 500; ui(); };\n  ws.onmessage = e => {\n    const m = JSON.parse(e.data);\n    if (m.type === 'welcome' || m.type === 'joined') { slot = m.slot; ui(); }\n    if (m.type === 'state') { ships = m.ships; projectiles = m.projectiles || []; effects = m.effects || []; stateAt = Date.now(); serverNow = m.now; lcdAt = m.lcdAt; ui(); }\n    if (m.type === 'action') {\n      const labels = { gun: 'Guns fired', missile: 'Guided missile launched', photon: 'Photon torpedo launched', warp: 'Warp jump complete' };\n      feedback = m.accepted ? labels[m.action] : 'Weapon recharging or ship unavailable'; feedbackUntil = Date.now() + 1400; ui();\n    }\n    if (m.type === 'error') { feedback = m.message; feedbackUntil = Date.now() + 1400; $('message').textContent = m.message; }\n  };\n  ws.onclose = () => { connected = false; slot = null; clearControls(); ui(); setTimeout(connect, retry); retry = Math.min(8000, retry * 2); };\n  ws.onerror = () => ws.close();\n}\n$('join').onclick = () => send({ type: 'join' });\n$('leave').onclick = () => { clearControls(); send({ type: 'leave' }); slot = null; ui(); };\nconst keyMap = { ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', ArrowUp: 'thrust', w: 'thrust', ArrowDown: 'brake', s: 'brake', ' ': 'gun' };\nconst actions = { m: 'missile', t: 'photon', Shift: 'warp' };\nfunction update() {\n  for (const k in input) input[k] = [...held].some(v => keyMap[v] === k || v === k);\n  document.querySelectorAll('[data-control]').forEach(b => b.classList.toggle('active', input[b.dataset.control]));\n  if (slot !== null) send({ type: 'input', ...input });\n}\nwindow.onkeydown = e => {\n  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;\n  if (slot === null || (!keyMap[key] && !actions[key])) return;\n  e.preventDefault();\n  if (actions[key]) { if (!e.repeat) send({ type: 'action', action: actions[key] }); }\n  else { held.add(key); update(); }\n};\nwindow.onkeyup = e => { held.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key); update(); };\nwindow.onblur = clearControls;\ndocument.addEventListener('visibilitychange', () => { if (document.hidden) clearControls(); });\ndocument.querySelectorAll('[data-control]').forEach(b => {\n  b.onpointerdown = e => { e.preventDefault(); if (b.disabled) return; b.setPointerCapture(e.pointerId); held.add(b.dataset.control); update(); };\n  b.onpointerup = b.onpointercancel = b.onlostpointercapture = () => { held.delete(b.dataset.control); update(); };\n});\ndocument.querySelectorAll('[data-action]').forEach(b => b.onclick = () => send({ type: 'action', action: b.dataset.action }));\nsetInterval(() => { if (connected && slot !== null) send({ type: 'input', ...input }); }, 50);\nsetInterval(() => { if (connected) send({ type: 'ping' }); }, 2000);\nsetInterval(ui, 100);\nconst c = $('arena').getContext('2d');\nconst stars = Array.from({ length: 95 }, (_, i) => ({ x: (i * 73 + 17) % 800, y: (i * 137 + 41) % 800, r: i % 5 === 0 ? 2 : 1 }));\nfunction draw(t) {\n  c.clearRect(0, 0, 800, 800); c.save(); c.beginPath(); c.arc(400, 400, 365, 0, Math.PI * 2); c.clip();\n  const g = c.createRadialGradient(360, 320, 0, 400, 400, 400);\n  g.addColorStop(0, '#152a3d'); g.addColorStop(.6, '#0d182b'); g.addColorStop(1, '#070d19'); c.fillStyle = g; c.fillRect(0, 0, 800, 800);\n  for (const s of stars) { c.globalAlpha = .3 + .4 * (1 + Math.sin(t * .0006 + s.x)) * .5; c.fillStyle = '#c4e7ff'; c.beginPath(); c.arc(s.x, s.y, s.r, 0, 7); c.fill(); }\n  c.globalAlpha = 1; c.strokeStyle = '#23364b'; c.lineWidth = 1;\n  for (const r of [115, 230, 325]) { c.beginPath(); c.arc(400, 400, r, 0, 7); c.stroke(); }\n  c.setLineDash([3, 10]); c.beginPath(); c.moveTo(400, 30); c.lineTo(400, 770); c.moveTo(30, 400); c.lineTo(770, 400); c.stroke(); c.setLineDash([]);\n  c.fillStyle = '#263d52'; c.beginPath(); c.arc(400, 400, 12, 0, 7); c.fill();\n  const now = serverNow + Date.now() - stateAt, age = Math.min(.12, (Date.now() - stateAt) / 1000);\n  for (const e of effects) {\n    const life = Math.max(0, Math.min(1, (now - e.born) / 1000));\n    if (life >= 1) continue;\n    c.globalAlpha = 1 - life; c.strokeStyle = e.kind === 2 ? '#70e7da' : e.kind === 3 ? '#d2acff' : '#ffb36b';\n    c.lineWidth = e.kind === 2 ? 3 : 2; c.beginPath(); c.arc(e.x * 5, e.y * 5, 5 + life * (e.kind === 3 ? 90 : 50), 0, 7); c.stroke();\n    if (e.kind !== 2) { c.fillStyle = c.strokeStyle; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; c.fillRect(e.x * 5 + Math.cos(a) * life * 55, e.y * 5 + Math.sin(a) * life * 55, 3, 3); } }\n  }\n  c.globalAlpha = 1;\n  for (const p of projectiles) {\n    c.save(); c.translate(p.x * 5, p.y * 5); c.rotate(p.a);\n    c.strokeStyle = p.kind === 2 ? '#bc9cff' : p.kind === 1 ? '#fbb969' : colors[p.owner];\n    c.fillStyle = c.strokeStyle; c.shadowColor = c.strokeStyle; c.shadowBlur = p.kind === 2 ? 25 : 10;\n    if (p.kind === 0) { c.lineWidth = 3; c.beginPath(); c.moveTo(-8, 0); c.lineTo(4, 0); c.stroke(); }\n    if (p.kind === 1) { c.beginPath(); c.moveTo(7, 0); c.lineTo(-5, -3); c.lineTo(-5, 3); c.closePath(); c.fill(); c.fillStyle = '#fff2ac'; c.fillRect(-11, -1, 6, 2); }\n    if (p.kind === 2) { c.beginPath(); c.arc(0, 0, 8, 0, 7); c.fill(); c.fillStyle = 'white'; c.beginPath(); c.arc(0, 0, 3, 0, 7); c.fill(); }\n    c.restore();\n  }\n  for (const s of ships) {\n    if (s.hp === 0) continue;\n    c.save(); c.translate((s.x + s.vx * age) * 5, (s.y + s.vy * age) * 5);\n    if (s.shield || s.warp) { c.strokeStyle = colors[s.slot]; c.globalAlpha = .45 + .2 * Math.sin(t * .01); c.lineWidth = 2; c.beginPath(); c.arc(0, 0, s.warp ? 32 : 26, 0, 7); c.stroke(); c.globalAlpha = 1; }\n    c.rotate(s.a);\n    if (s.thrust) { c.fillStyle = colors[s.slot]; c.globalAlpha = .7; c.beginPath(); c.moveTo(-12, -6); c.lineTo(-28 - Math.random() * 12, 0); c.lineTo(-12, 6); c.fill(); c.globalAlpha = 1; }\n    c.shadowColor = colors[s.slot]; c.shadowBlur = 22; c.fillStyle = s.hit ? '#ffffff' : colors[s.slot];\n    c.beginPath(); c.moveTo(20, 0); c.lineTo(-13, -11); c.lineTo(-7, 0); c.lineTo(-13, 11); c.closePath(); c.fill();\n    c.shadowBlur = 0; c.fillStyle = '#f7ffff'; c.beginPath(); c.arc(1, 0, 3, 0, 7); c.fill(); c.restore();\n    c.fillStyle = colors[s.slot]; c.font = '12px monospace'; c.textAlign = 'center';\n    c.fillText(names[s.slot].toUpperCase() + (slot === s.slot ? ' / YOU' : s.bot ? ' / AI' : ''), s.x * 5, s.y * 5 + 33);\n    c.fillStyle = '#27394d'; c.fillRect(s.x * 5 - 17, s.y * 5 + 39, 34, 3);\n    c.fillStyle = s.hp > 30 ? colors[s.slot] : '#ff789a'; c.fillRect(s.x * 5 - 17, s.y * 5 + 39, 34 * s.hp / 100, 3);\n  }\n  if (!ships.length) { c.textAlign = 'center'; c.fillStyle = '#91a4bd'; c.font = '14px monospace'; c.fillText('AWAITING PILOTS', 400, 510); }\n  c.restore(); c.strokeStyle = '#39536e'; c.lineWidth = 2; c.beginPath(); c.arc(400, 400, 365, 0, 7); c.stroke(); requestAnimationFrame(draw);\n}\nui(); connect(); requestAnimationFrame(draw);\n</script></body></html>\n";
const ARENA_RADIUS = 64;
const SHIP_RADIUS = 4;

// The circular map identifies opposite points on its boundary. Preserve overshoot
// and velocity so crossing an edge feels continuous instead of bouncing off it.
function wrapShip(ship) {
  const dx = ship.x - 80, dy = ship.y - 80;
  const distance = Math.hypot(dx, dy);
  if (distance > ARENA_RADIUS) {
    const radius = ((distance + ARENA_RADIUS) % (2 * ARENA_RADIUS)) - ARENA_RADIUS;
    ship.x = 80 + dx / distance * radius;
    ship.y = 80 + dy / distance * radius;
  }
}

function collideShips(ships) {
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

function advanceShips(ships, dt, now) {
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

const WEAPONS = {
  gun: { kind: 0, speed: 95, damage: 8, radius: 1, ttl: 1400, cooldown: 180 },
  missile: { kind: 1, speed: 45, damage: 24, radius: 2, ttl: 3500, cooldown: 1500 },
  photon: { kind: 2, speed: 32, damage: 40, radius: 3, ttl: 3500, cooldown: 2500 },
  warp: { cooldown: 5000 },
};
const MAX_PROJECTILES = 24;
const MAX_EFFECTS = 8;
function newWorld(now) { return { last: now, nextId: 1, projectiles: [], effects: [], bots: [] }; }
function newShip(slot, now) {
  const a = slot * Math.PI / 2;
  return { slot, x: 80 + 35 * Math.cos(a), y: 80 + 35 * Math.sin(a), a: a + Math.PI / 2,
    vx: 0, vy: 0, hp: 100, kills: 0, deaths: 0, shieldUntil: now + 2000,
    respawnAt: 0, hitUntil: 0, warpUntil: 0, ready: { gun: 0, missile: 0, photon: 0, warp: 0 },
    input: {}, inputAt: 0, thrust: false };
}

// AI pilots chase the nearest opponent, fire guns when lined up and use heavier
// weapons when their cooldowns allow. They reuse the human input model, so physics
// and weapons treat them exactly like any other ship.
function steerBot(world, ships, bot, now) {
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
function fireAction(world, ships, ship, action, now) {
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
function advanceWorld(world, ships, now) {
  // Substeps prevent fast gun rounds passing through ships between network messages.
  const elapsed = Math.max(0, Math.min(250, now - world.last));
  const steps = Math.max(1, Math.ceil(elapsed / 20));
  for (let i = 0; i < steps; i++) step(world, ships, now - elapsed + elapsed * (i + 1) / steps, elapsed / steps / 1000);
  world.last = now; world.effects = world.effects.filter(e => e.until > now);
}

const noCache = { 'Cache-Control': 'no-store' };
export class SpaceRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS arena_world (id INTEGER PRIMARY KEY, value TEXT NOT NULL)');
    const saved = this.ctx.storage.sql.exec('SELECT value FROM arena_world WHERE id = 1').toArray()[0];
    this.world = saved ? JSON.parse(saved.value) : newWorld(Date.now());
    this.world.bots ??= [];
    this.savedActive = !!saved; this.lcdAt = 0;
  }
  humans(sessions = this.sessions()) { return sessions.map(s => s.data).filter(s => s.slot !== null); }
  pilots(sessions = this.sessions()) { return [...this.humans(sessions), ...this.world.bots]; }
  // AI pilots fill every open seat while at least one human is flying, and the
  // arena empties when the last human leaves.
  syncBots(sessions, now) {
    const humans = this.humans(sessions), taken = humans.map(s => s.slot);
    const keep = humans.length ? this.world.bots.filter(b => !taken.includes(b.slot)) : [];
    const removed = this.world.bots.filter(b => !keep.includes(b)).map(b => b.slot);
    if (removed.length) this.world.projectiles = this.world.projectiles.filter(p => !removed.includes(p.owner));
    this.world.bots = keep;
    if (!humans.length) return;
    for (const slot of [0, 1, 2, 3]) {
      if (!taken.includes(slot) && !keep.some(b => b.slot === slot)) keep.push({ ...newShip(slot, now), bot: true });
    }
    keep.sort((a, b) => a.slot - b.slot);
  }
  sessions() { return this.ctx.getWebSockets().filter(ws => ws.readyState === 1).map(ws => ({ ws, data: ws.deserializeAttachment() })); }
  save(sessions) {
    for (const { ws, data } of sessions) ws.serializeAttachment(data);
    const active = this.world.projectiles.length > 0 || this.world.effects.length > 0 || this.world.bots.length > 0;
    if (active) this.ctx.storage.sql.exec('INSERT OR REPLACE INTO arena_world (id, value) VALUES (1, ?)', JSON.stringify(this.world));
    else if (this.savedActive) this.ctx.storage.sql.exec('DELETE FROM arena_world WHERE id = 1');
    this.savedActive = active;
  }
  advance() {
    const sessions = this.sessions(), now = Date.now();
    this.syncBots(sessions, now);
    advanceWorld(this.world, this.pilots(sessions), now);
    this.save(sessions);
  }
  state() {
    const now = Date.now();
    return { type: 'state', physics: 'collisions-wrap-v1', now, lcdAt: this.lcdAt, projectiles: this.world.projectiles, effects: this.world.effects,
      ships: this.pilots().sort((a, b) => a.slot - b.slot).map(s => ({
        slot: s.slot, bot: !!s.bot, x: s.x, y: s.y, a: s.a, vx: s.vx, vy: s.vy, thrust: s.thrust,
        hp: s.hp, kills: s.kills, deaths: s.deaths, shield: now < s.shieldUntil,
        hit: now < s.hitUntil, warp: now < s.warpUntil,
        respawnMs: Math.max(0, s.respawnAt - now),
        cooldowns: Object.fromEntries(Object.entries(s.ready).map(([k, at]) => [k, Math.max(0, at - now)])),
      })) };
  }
  broadcast() {
    const state = this.state(), value = JSON.stringify(state);
    // Multiple pilots can produce 80 broadcasts/sec. The LCD only needs the
    // newest motion state; keep its TLS connection from accumulating old frames.
    const lcdValue = JSON.stringify({ type: 'state', now: state.now,
      ships: state.ships.map(({ slot, x, y, a, vx, vy, thrust, hp, shield, warp }) =>
        ({ slot, x, y, a, vx, vy, thrust, hp, shield, warp })),
      projectiles: state.projectiles.map(({ kind, owner, target, x, y, a }) => ({ kind, owner, target, x, y, a })),
      effects: state.effects.map(({ kind, slot, x, y, born }) => ({ kind, slot, x, y, born })) });
    for (const { ws, data } of this.sessions()) {
      if (data.lcd && state.now - (data.lcdSentAt ?? 0) < 33) continue;
      try {
        ws.send(data.lcd ? lcdValue : value);
        if (data.lcd) { data.lcdSentAt = state.now; ws.serializeAttachment(data); }
      } catch { ws.close(1011, 'Connection error'); }
    }
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
    const lcd = url.searchParams.get('lcd') === '1';
    if (lcd) this.lcdAt = Date.now();
    server.serializeAttachment({ slot: null, lastMessage: 0, inputAt: 0, input: {}, lcd });
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
    if (s.lcd) this.lcdAt = now;
    if (m.type === 'join' && s.slot === null) {
      // A human takes a free seat, or otherwise replaces an AI pilot.
      const used = this.humans().map(s => s.slot), open = [0, 1, 2, 3].filter(i => !used.includes(i));
      const slot = open.find(i => !this.world.bots.some(b => b.slot === i)) ?? open[0];
      if (slot === undefined) { ws.send(JSON.stringify({ type: 'error', message: 'All four seats are taken.' })); return; }
      s = { ...s, ...newShip(slot, now) }; ws.serializeAttachment(s);
      this.syncBots(this.sessions(), now); this.save(this.sessions());
      ws.send(JSON.stringify({ type: 'joined', slot })); this.broadcast(); return;
    }
    if (m.type === 'leave') {
      this.world.projectiles = this.world.projectiles.filter(p => p.owner !== s.slot);
      s.slot = null; s.input = {}; ws.serializeAttachment(s); this.syncBots(this.sessions(), now); this.save(this.sessions()); this.broadcast(); return;
    }
    if (m.type === 'action' && s.slot !== null) {
      if (!['gun', 'missile', 'photon', 'warp'].includes(m.action)) return;
      const accepted = fireAction(this.world, this.pilots(), s, m.action, now);
      ws.send(JSON.stringify({ type: 'action', action: m.action, accepted }));
    }
    if (m.type === 'input' && s.slot !== null) {
      s.input = { left: m.left === true, right: m.right === true, thrust: m.thrust === true, brake: m.brake === true, gun: m.gun === true }; s.inputAt = now;
    }
    ws.serializeAttachment(s); this.save(this.sessions()); this.broadcast();
  }
  release(ws) {
    const s = ws.deserializeAttachment(); this.world.projectiles = this.world.projectiles.filter(p => p.owner !== s.slot);
    s.slot = null; ws.serializeAttachment(s); this.syncBots(this.sessions(), Date.now()); this.save(this.sessions()); this.broadcast();
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
